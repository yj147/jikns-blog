import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { useRealtimeComments } from "@/hooks/use-realtime-comments"
import { createSupabaseRealtimeMock, type SupabaseRealtimeMock } from "../helpers/realtime-mock"

const createClientMock = vi.hoisted(() => vi.fn())

let supabaseCtx: SupabaseRealtimeMock

vi.mock("@/lib/supabase", () => ({
  __esModule: true,
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

const waitForChannel = async (index?: number) => {
  await waitFor(() => expect(supabaseCtx.channels.length).toBeGreaterThan(0))
  const targetIndex = index !== undefined ? index : supabaseCtx.channels.length - 1
  return supabaseCtx.channels[targetIndex]
}

describe("useRealtimeComments", () => {
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

  it("订阅成功并处理插入事件，使用查询结果回填", async () => {
    const onInsert = vi.fn()

    supabaseCtx.tables.comments = {
      c1: { id: "c1", content: "hello", postId: "p1", authorId: "u1" },
    }

    renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p1",
        onInsert,
      })
    )

    await flushEffects()
    const channel = await waitForChannel()
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "INSERT",
        new: { id: "c1", postId: "p1", authorId: "u1" },
        old: null,
      })
    })

    expect(onInsert).toHaveBeenCalledWith(supabaseCtx.tables.comments.c1)
  })

  it("更新回调保持稳定，不触发重复订阅", async () => {
    const firstUpdate = vi.fn()
    const nextUpdate = vi.fn()

    const { rerender } = renderHook(
      ({ handler }) =>
        useRealtimeComments({
          targetType: "post",
          targetId: "p2",
          onUpdate: handler,
        }),
      { initialProps: { handler: firstUpdate } }
    )

    await flushEffects()
    const channel = await waitForChannel()
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "UPDATE",
        new: { id: "c2", postId: "p2", authorId: "u2" },
        old: null,
      })
    })
    expect(firstUpdate).toHaveBeenCalledTimes(1)

    rerender({ handler: nextUpdate })
    expect(supabaseCtx.supabase.channel).toHaveBeenCalledTimes(1)

    await act(async () => {
      await channel.emitChange({
        eventType: "UPDATE",
        new: { id: "c2", postId: "p2", authorId: "u2" },
        old: null,
      })
    })
    expect(nextUpdate).toHaveBeenCalledTimes(1)
  })

  it("无 session 时也能直接订阅", async () => {
    supabaseCtx.supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p3",
      })
    )

    await flushEffects()

    await waitFor(() => expect(supabaseCtx.channels.length).toBeGreaterThan(0))

    const channel = await waitForChannel(0)
    act(() => channel.emitStatus("SUBSCRIBED"))

    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))
    expect(vi.getTimerCount()).toBe(0)
    expect(supabaseCtx.supabase.auth.getSession).not.toHaveBeenCalled()
  })

  it("多次失败后启用轮询降级", async () => {
    const pollFetcher = vi.fn()

    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p4",
        pollFetcher,
        pollInterval: 4000,
      })
    )

    const emitFailure = async (advanceMs: number) => {
      const channel = await waitForChannel()
      await act(async () => {
        channel.emitStatus("CHANNEL_ERROR")
        vi.advanceTimersByTime(advanceMs)
        await Promise.resolve()
      })
    }

    await flushEffects()

    await emitFailure(1000)
    await flushEffects()
    await emitFailure(2000)
    await flushEffects()
    await emitFailure(4000)
    await flushEffects()
    await emitFailure(0)
    await flushEffects()

    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
    })

    expect(result.current.isPollingFallback).toBe(true)
    expect(result.current.connectionState).toBe("polling")
    expect(pollFetcher).toHaveBeenCalled()
  })

  it("轮询进行中再次失败不会重复启动计时器", async () => {
    const pollFetcher = vi.fn()

    renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p4",
        pollFetcher,
        pollInterval: 2000,
      })
    )

    await flushEffects()

    const fail = async (advance: number) => {
      const channel = await waitForChannel()
      await act(async () => {
        channel.emitStatus("CHANNEL_ERROR")
        vi.advanceTimersByTime(advance)
        await Promise.resolve()
      })
      await flushEffects()
    }

    await fail(1000)
    await fail(2000)
    await fail(4000)
    await fail(0)

    const before = pollFetcher.mock.calls.length
    await fail(0)

    expect(pollFetcher.mock.calls.length).toBeGreaterThanOrEqual(before)
  })

  it("没有 pollFetcher 也会进入轮询降级状态", async () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p4",
      })
    )

    await flushEffects()

    const emitFailure = async (advanceMs: number) => {
      const channel = await waitForChannel()
      await act(async () => {
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

    expect(result.current.isPollingFallback).toBe(true)
    expect(result.current.connectionState).toBe("polling")
  })

  it("离线时暂停，恢复在线后重新建立订阅", async () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p5",
      })
    )

    await flushEffects()
    const firstChannel = await waitForChannel(0)
    act(() => firstChannel.emitStatus("SUBSCRIBED"))

    setOnline(false)
    act(() => window.dispatchEvent(new Event("offline")))
    expect(result.current.connectionState).toBe("disconnected")

    setOnline(true)
    act(() => window.dispatchEvent(new Event("online")))
    act(() => vi.runOnlyPendingTimers())
    await flushEffects()

    const secondChannel = await waitForChannel()
    act(() => secondChannel.emitStatus("SUBSCRIBED"))

    expect(result.current.connectionState).toBe("realtime")
  })

  it("删除事件触发 onDelete 回调", async () => {
    const onDelete = vi.fn()

    renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p6",
        onDelete,
      })
    )

    await flushEffects()
    const channel = await waitForChannel()
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "DELETE",
        new: null,
        old: { id: "c-delete" },
      })
    })

    expect(onDelete).toHaveBeenCalledWith("c-delete")
  })

  it("回调抛错时会捕获错误", async () => {
    const onInsert = vi.fn(() => {
      throw new Error("boom")
    })

    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p7",
        onInsert,
      })
    )

    await flushEffects()
    const channel = await waitForChannel()
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "INSERT",
        new: { id: "err", postId: "p7", authorId: "u1" },
        old: null,
      })
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })

  it("禁用或缺少 targetId 时跳过订阅", async () => {
    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "",
        enabled: false,
      })
    )

    await flushEffects()
    expect(supabaseCtx.channels.length).toBe(0)
    expect(result.current.connectionState).toBe("disconnected")
  })

  it("初始离线时不建立订阅", async () => {
    setOnline(false)
    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "offline",
      })
    )

    await flushEffects()
    expect(result.current.connectionState).toBe("disconnected")
    expect(supabaseCtx.channels.length).toBe(0)
  })

  it("Supabase 客户端创建失败时降级轮询", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("fail")
    })

    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p8",
      })
    )

    await flushEffects()
    await waitFor(() => expect(result.current.isPollingFallback).toBe(true))
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
  })

  it("缺少 channel 方法时直接降级", async () => {
    // @ts-expect-error override for test
    supabaseCtx.supabase.channel = undefined

    const { result } = renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p9",
      })
    )

    await flushEffects()
    expect(result.current.isPollingFallback).toBe(true)
  })

  it("查询评论失败时使用原始 payload", async () => {
    supabaseCtx.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error("fetch fail") }),
        })),
      })),
    }))

    const onUpdate = vi.fn()
    renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p10",
        onUpdate,
      })
    )

    await flushEffects()
    const channel = await waitForChannel()
    act(() => channel.emitStatus("SUBSCRIBED"))

    await act(async () => {
      await channel.emitChange({
        eventType: "UPDATE",
        new: { id: "c-fetch", postId: "p10", authorId: "u1" },
        old: null,
      })
    })

    expect(onUpdate).toHaveBeenCalled()
  })

  it("订阅状态超时同样触发重试", async () => {
    renderHook(() =>
      useRealtimeComments({
        targetType: "post",
        targetId: "p11",
      })
    )
    await flushEffects()

    const channel = await waitForChannel()
    act(() => channel.emitStatus("TIMED_OUT"))
    await act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })

    await flushEffects()
    expect(supabaseCtx.channels.length).toBeGreaterThan(1)
  })
})
