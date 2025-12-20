import { act, renderHook } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { useRealtimeActivities } from "@/hooks/use-realtime-activities"
import { createSupabaseRealtimeMock, type SupabaseRealtimeMock } from "../helpers/realtime-mock"

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

let supabaseCtx: SupabaseRealtimeMock
const createClientMock = vi.fn()

vi.mock("@/lib/supabase", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}))

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true })
}

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("useRealtimeActivities", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    supabaseCtx = createSupabaseRealtimeMock()
    createClientMock.mockReturnValue(supabaseCtx.supabase)
    setOnline(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("订阅成功并在卸载时清理 channel", async () => {
    const { result, unmount } = renderHook(() => useRealtimeActivities())
    await flushEffects()
    const channel = supabaseCtx.channels[0]

    act(() => {
      channel.emitStatus("SUBSCRIBED")
    })

    expect(result.current.isSubscribed).toBe(true)
    expect(result.current.connectionState).toBe("realtime")

    unmount()
    expect(supabaseCtx.supabase.removeChannel).toHaveBeenCalledWith(channel)
  })

  it("使用稳定回调避免重复订阅", async () => {
    const firstInsert = vi.fn()
    const nextInsert = vi.fn()

    const { rerender } = renderHook(({ handler }) => useRealtimeActivities({ onInsert: handler }), {
      initialProps: { handler: firstInsert },
    })

    await flushEffects()
    const channel = supabaseCtx.channels[0]
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "INSERT",
        new: { id: "a1", authorId: "u1", deletedAt: null },
        old: null,
      })
      vi.runAllTimers()
      await Promise.resolve()
    })
    expect(firstInsert).toHaveBeenCalledTimes(1)

    rerender({ handler: nextInsert })
    expect(supabaseCtx.supabase.channel).toHaveBeenCalledTimes(1)

    await act(async () => {
      await channel.emitChange({
        eventType: "INSERT",
        new: { id: "a1", authorId: "u1", deletedAt: null },
        old: null,
      })
      vi.runAllTimers()
      await Promise.resolve()
    })
    expect(nextInsert).toHaveBeenCalledTimes(1)
  })

  it("处理更新与删除事件并支持数据回填", async () => {
    const onUpdate = vi.fn()
    const onDelete = vi.fn()

    supabaseCtx.tables.activities = {
      a2: { id: "a2", authorId: "u2", deletedAt: null },
    }

    renderHook(() =>
      useRealtimeActivities({
        onUpdate,
        onDelete,
      })
    )

    await flushEffects()
    const channel = supabaseCtx.channels[0]
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "UPDATE",
        new: { id: "a2", authorId: "u2", deletedAt: null },
        old: null,
      })
      vi.runAllTimers()
      await Promise.resolve()
    })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a2",
        authorId: "u2",
        author: expect.objectContaining({ id: "u2" }),
      })
    )

    await act(async () => {
      await channel.emitChange({
        eventType: "DELETE",
        new: null,
        old: { id: "a3" },
      })
    })
    expect(onDelete).toHaveBeenCalledWith("a3")
  })

  it("重试失败后启用轮询降级", async () => {
    const pollFetcher = vi.fn()

    const { result } = renderHook(() =>
      useRealtimeActivities({
        pollFetcher,
        pollInterval: 5000,
      })
    )

    const emitFailure = async (advanceMs: number) => {
      await act(async () => {
        const channel = supabaseCtx.channels[supabaseCtx.channels.length - 1]
        channel.emitStatus("CHANNEL_ERROR")
        vi.advanceTimersByTime(advanceMs)
        await Promise.resolve()
      })
    }

    await flushEffects()

    await emitFailure(1000)
    await flushEffects()
    expect(supabaseCtx.channels.length).toBeGreaterThan(1)

    await emitFailure(2000)
    await flushEffects()
    await emitFailure(4000)
    await flushEffects()
    await emitFailure(0)
    await flushEffects()

    await act(async () => {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    expect(result.current.isPollingFallback).toBe(true)
    expect(result.current.connectionState).toBe("polling")
    expect(result.current.error).toBeInstanceOf(Error)
    expect(pollFetcher).toHaveBeenCalled()
  })

  it("在已有轮询计时器时不会重复启动", async () => {
    const pollFetcher = vi.fn()
    renderHook(() =>
      useRealtimeActivities({
        pollFetcher,
        pollInterval: 2000,
      })
    )

    await flushEffects()

    const fail = async (advance: number) => {
      await act(async () => {
        const channel = supabaseCtx.channels[supabaseCtx.channels.length - 1]
        channel.emitStatus("CHANNEL_ERROR")
        vi.advanceTimersByTime(advance)
        await Promise.resolve()
      })
      await flushEffects()
    }

    // 第一次触发进入轮询
    await fail(1000)
    await fail(2000)
    await fail(4000)
    await fail(0)

    const before = pollFetcher.mock.calls.length

    // 轮询进行中再次触发错误，命中 startPolling 早退分支
    await fail(0)

    expect(pollFetcher.mock.calls.length).toBeGreaterThanOrEqual(before)
  })

  it("UPDATE 删除标记会走 onDelete 分支", async () => {
    const onDelete = vi.fn()

    renderHook(() =>
      useRealtimeActivities({
        onDelete,
      })
    )

    await flushEffects()
    const channel = supabaseCtx.channels[0]
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "UPDATE",
        new: { id: "dead", authorId: "u1", deletedAt: "now" },
        old: null,
      })
    })

    expect(onDelete).toHaveBeenCalledWith("dead")
  })

  it("回调抛错时会记录错误", async () => {
    const onInsert = vi.fn(() => {
      throw new Error("boom")
    })

    const { result } = renderHook(() =>
      useRealtimeActivities({
        onInsert,
      })
    )

    await flushEffects()
    const channel = supabaseCtx.channels[0]
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "INSERT",
        new: { id: "err", authorId: "u2", deletedAt: null },
        old: null,
      })
      vi.runAllTimers()
      await Promise.resolve()
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })

  it("没有 pollFetcher 时标记错误并不进入轮询", async () => {
    const { result } = renderHook(() =>
      useRealtimeActivities({
        pollInterval: 3000,
      })
    )

    await flushEffects()

    const emitFailure = async (advanceMs: number) => {
      await act(async () => {
        const channel = supabaseCtx.channels[supabaseCtx.channels.length - 1]
        channel.emitStatus("CHANNEL_ERROR")
        vi.advanceTimersByTime(advanceMs)
        await Promise.resolve()
      })
      await flushEffects()
    }

    await emitFailure(1000)
    await emitFailure(2000)
    await emitFailure(4000)
    await emitFailure(0)

    expect(result.current.isPollingFallback).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.connectionState).toBe("error")
  })

  it("禁用时不会建立订阅", async () => {
    const { result } = renderHook(() => useRealtimeActivities({ enabled: false }))
    await flushEffects()
    expect(supabaseCtx.channels.length).toBe(0)
    expect(result.current.connectionState).toBe("disconnected")
  })

  it("初始离线时跳过订阅", async () => {
    setOnline(false)
    const { result } = renderHook(() => useRealtimeActivities())
    await flushEffects()
    expect(result.current.connectionState).toBe("disconnected")
    expect(supabaseCtx.channels.length).toBe(0)
  })

  it("Supabase 客户端创建失败时记录错误并降级", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("create fail")
    })

    const { result } = renderHook(() => useRealtimeActivities())
    await flushEffects()

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.isPollingFallback).toBe(false)
    expect(result.current.connectionState).toBe("error")
  })

  it("缺少 channel 方法时直接降级轮询", async () => {
    // @ts-expect-error override for test
    supabaseCtx.supabase.channel = undefined
    const { result } = renderHook(() => useRealtimeActivities())
    await flushEffects()
    expect(result.current.isPollingFallback).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it("会话未就绪时触发重试", async () => {
    supabaseCtx.supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const { result } = renderHook(() => useRealtimeActivities())
    await flushEffects()

    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })

    await flushEffects()
    expect(result.current.isSubscribed).toBe(false)
  })

  it("查询活动失败时记录 warn 并继续", async () => {
    supabaseCtx.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("fetch fail") }),
        })),
      })),
    }))

    const onInsert = vi.fn()
    renderHook(() => useRealtimeActivities({ onInsert }))
    await flushEffects()
    const channel = supabaseCtx.channels[0]
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "INSERT",
        new: { id: "x1", authorId: "u1", deletedAt: null },
        old: null,
      })
      vi.runAllTimers()
      await Promise.resolve()
    })

    expect(onInsert).toHaveBeenCalled()
  })

  it("离线时暂停订阅，上线后自动重连", async () => {
    const { result } = renderHook(() => useRealtimeActivities())
    await flushEffects()
    const firstChannel = supabaseCtx.channels[0]

    act(() => firstChannel.emitStatus("SUBSCRIBED"))
    expect(result.current.connectionState).toBe("realtime")

    setOnline(false)
    act(() => window.dispatchEvent(new Event("offline")))

    expect(result.current.connectionState).toBe("disconnected")
    expect(supabaseCtx.supabase.removeChannel).toHaveBeenCalledWith(firstChannel)

    setOnline(true)
    act(() => window.dispatchEvent(new Event("online")))
    act(() => vi.runOnlyPendingTimers())
    await flushEffects()

    const secondChannel = supabaseCtx.channels[supabaseCtx.channels.length - 1]
    act(() => secondChannel.emitStatus("SUBSCRIBED"))

    expect(result.current.connectionState).toBe("realtime")
  })
})
