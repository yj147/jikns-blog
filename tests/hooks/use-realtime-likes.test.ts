import { act, renderHook, waitFor } from "@testing-library/react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

import { useRealtimeLikes } from "@/hooks/use-realtime-likes"
import { createClient } from "@/lib/supabase"
import * as realtime from "@/lib/realtime"

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }))

const createClientMock = vi.mocked(createClient)

type LikeRow = {
  id: string
  postId: string | null
  activityId: string | null
  authorId: string
  createdAt: string
}

function createChannelStub() {
  const handlers: {
    change?: (payload: RealtimePostgresChangesPayload<LikeRow>) => void
    status?: (status: any) => void
  } = {}

  const channel = {
    on: vi.fn((_event, _filter, cb) => {
      handlers.change = cb
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      handlers.status = cb ?? null
      return channel
    }),
    emitStatus(status: string) {
      handlers.status?.(status)
    },
    emitChange(payload: Partial<RealtimePostgresChangesPayload<LikeRow>>) {
      handlers.change?.(payload as RealtimePostgresChangesPayload<LikeRow>)
    },
  }

  return channel
}

function createSupabaseStub() {
  const channel = createChannelStub()
  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "token", user: { id: "u1" }, expires_at: Date.now() / 1000 + 3600 } },
        error: null,
      }),
    },
  }

  return { supabase, channel }
}

describe("useRealtimeLikes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("正常订阅并触发点赞/取消回调", async () => {
    const onLike = vi.fn()
    const onUnlike = vi.fn()
    const { supabase, channel } = createSupabaseStub()
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-1", onLike, onUnlike })
    )

    await waitFor(() => expect(supabase.channel).toHaveBeenCalled())

    act(() => channel.emitStatus("SUBSCRIBED"))
    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))

    const inserted: LikeRow = {
      id: "like-1",
      postId: "post-1",
      activityId: null,
      authorId: "user-1",
      createdAt: new Date().toISOString(),
    }

    act(() => channel.emitChange({ eventType: "INSERT", new: inserted } as any))
    await waitFor(() => expect(onLike).toHaveBeenCalledWith(inserted))

    act(() => channel.emitChange({ eventType: "DELETE", old: inserted } as any))
    await waitFor(() => expect(onUnlike).toHaveBeenCalledWith("like-1"))

    expect(result.current.isPollingFallback).toBe(false)
  })

  it("重试失败后回退到轮询并保持降级状态", async () => {
    vi.useFakeTimers()
    const pollFetcher = vi.fn().mockResolvedValue(undefined)
    const channelFactory = () => {
      const channel = createChannelStub()
      channel.subscribe = vi.fn((cb?: (status: string) => void) => {
        cb?.("CHANNEL_ERROR")
        return channel
      })
      return channel
    }

    const supabase = {
      channel: vi.fn(() => channelFactory()),
      removeChannel: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token", user: { id: "u1" }, expires_at: Date.now() / 1000 + 3600 } },
          error: null,
        }),
      },
    }

    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({
        targetType: "post",
        targetId: "post-2",
        pollInterval: 500,
        pollFetcher,
      })
    )

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    await waitFor(() => expect(result.current.isPollingFallback).toBe(true))
    await waitFor(() => expect(pollFetcher).toHaveBeenCalled())
    expect(result.current.isPollingFallback).toBe(true)
    expect(result.current.connectionState).toBe("polling")
    expect(result.current.isSubscribed).toBe(false)
  })

  it("离线时断开，恢复在线后重新订阅", async () => {
    const { supabase, channel } = createSupabaseStub()
    channel.subscribe = vi.fn((cb?: (status: string) => void) => {
      cb?.("SUBSCRIBED")
      return channel
    })
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "activity", targetId: "activity-1", pollInterval: 500 })
    )

    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false })
      window.dispatchEvent(new Event("offline"))
    })

    await waitFor(() => expect(result.current.connectionState).toBe("disconnected"))
    expect(supabase.removeChannel).toHaveBeenCalled()

    act(() => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true })
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))
    expect(result.current.isSubscribed).toBe(true)
  })

  it("创建 Supabase 客户端失败时启动轮询降级并在卸载时清理", async () => {
    vi.useFakeTimers()
    const creationError = new Error("boom")
    createClientMock.mockImplementation(() => {
      throw creationError
    })

    const pollFetcher = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-3", pollFetcher, pollInterval: 300 })
    )

    await waitFor(() => expect(result.current.connectionState).toBe("polling"))
    expect(result.current.error).toBe(creationError)
    expect(result.current.isPollingFallback).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(pollFetcher).toHaveBeenCalled()

    unmount()
  })

  it("Supabase 创建抛出非 Error 也会进入轮询降级", async () => {
    vi.useFakeTimers()
    createClientMock.mockImplementation(() => {
      throw "string-error"
    })

    const pollFetcher = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-non-error", pollFetcher, pollInterval: 300 })
    )

    await waitFor(() => expect(result.current.connectionState).toBe("polling"))

    await act(async () => {
      vi.advanceTimersByTime(1200)
    })

    expect(pollFetcher).toHaveBeenCalled()
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it("缺少 pollFetcher 时不启用轮询降级", async () => {
    const supabase = {
      removeChannel: vi.fn(),
    }
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-4", pollFetcher: undefined, pollInterval: 200 })
    )

    await waitFor(() => expect(result.current.connectionState).toBe("error"))
    expect(result.current.isPollingFallback).toBe(false)
  })

  it("初始离线时跳过订阅并保持断开状态", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false })
    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-5", pollFetcher: undefined })
    )

    expect(result.current.connectionState).toBe("disconnected")
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("会话未就绪时经过重试后回退到轮询", async () => {
    const pollFetcher = vi.fn().mockResolvedValue(undefined)
    const channel = createChannelStub()
    const supabase = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    }
    createClientMock.mockReturnValue(supabase as any)

    const retrySpy = vi.spyOn(await import("@/lib/realtime"), "createRetryScheduler")
    const scheduler = {
      attempts: 0,
      schedule: vi.fn(() => null),
      reset: vi.fn(() => {
        scheduler.attempts = 0
      }),
      clear: vi.fn(),
    }
    retrySpy.mockReturnValue(scheduler as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "activity", targetId: "activity-2", pollFetcher, pollInterval: 200 })
    )

    await waitFor(() => expect(result.current.isPollingFallback).toBe(true))
    expect(result.current.connectionState).toBe("polling")
    retrySpy.mockRestore()
  })

  it("轮询函数抛错时不会中断降级", async () => {
    vi.useFakeTimers()
    const pollFetcher = vi.fn().mockRejectedValue(new Error("poll boom"))
    createClientMock.mockImplementation(() => {
      throw new Error("no client")
    })

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-6", pollFetcher, pollInterval: 200 })
    )

    await act(async () => {
      vi.advanceTimersByTime(500)
      vi.advanceTimersByTime(1200)
    })

    expect(result.current.isPollingFallback).toBe(true)
    expect(pollFetcher).toHaveBeenCalledTimes(2)
  })

  it("处理 payload 失败时会暴露错误状态", async () => {
    const onLike = vi.fn(() => {
      throw new Error("handler failed")
    })
    const { supabase, channel } = createSupabaseStub()
    channel.subscribe = vi.fn((cb?: (status: string) => void) => {
      cb?.("SUBSCRIBED")
      return channel
    })
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-7", onLike })
    )

    await waitFor(() => expect(result.current.isSubscribed).toBe(true))
    const inserted: LikeRow = {
      id: "like-err",
      postId: "post-7",
      activityId: null,
      authorId: "u-err",
      createdAt: new Date().toISOString(),
    }

    act(() => channel.emitChange({ eventType: "INSERT", new: inserted } as any))

    await waitFor(() => {
      expect(onLike).toHaveBeenCalled()
      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  it("处理 payload 抛出非 Error 时也会包装为 Error", async () => {
    const onLike = vi.fn(() => {
      throw "handler failed"
    })
    const { supabase, channel } = createSupabaseStub()
    channel.subscribe = vi.fn((cb?: (status: string) => void) => {
      cb?.("SUBSCRIBED")
      return channel
    })
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-8", onLike })
    )

    await waitFor(() => expect(result.current.isSubscribed).toBe(true))
    const inserted: LikeRow = {
      id: "like-non-error",
      postId: "post-8",
      activityId: null,
      authorId: "u-non-error",
      createdAt: new Date().toISOString(),
    }

    act(() => channel.emitChange({ eventType: "INSERT", new: inserted } as any))

    await waitFor(() => {
      expect(onLike).toHaveBeenCalled()
      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  it("禁用时跳过初始化并在清理阶段关闭重试调度", () => {
    const scheduler = {
      schedule: vi.fn(),
      reset: vi.fn(),
      clear: vi.fn(),
      attempts: 0,
    }
    const retrySpy = vi.spyOn(realtime, "createRetryScheduler").mockReturnValue(scheduler as any)

    const { unmount, result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-disabled", enabled: false })
    )

    expect(result.current.connectionState).toBe("disconnected")
    expect(createClientMock).not.toHaveBeenCalled()

    unmount()
    expect(scheduler.clear).toHaveBeenCalled()

    retrySpy.mockRestore()
  })

  it("缺少 targetId 时直接退出并清理", async () => {
    const scheduler = {
      schedule: vi.fn(),
      reset: vi.fn(),
      clear: vi.fn(),
      attempts: 0,
    }
    const retrySpy = vi.spyOn(realtime, "createRetryScheduler").mockReturnValue(scheduler as any)

    const { unmount, result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "", pollFetcher: vi.fn() })
    )

    await waitFor(() => expect(result.current.connectionState).toBe("disconnected"))
    expect(createClientMock).not.toHaveBeenCalled()

    unmount()
    expect(scheduler.clear).toHaveBeenCalled()

    retrySpy.mockRestore()
  })

  it("会话延迟时执行重试回调并在下一次尝试订阅成功", async () => {
    vi.useFakeTimers()

    const ensureSpy = vi.spyOn(realtime, "ensureSessionReady")
    ensureSpy.mockResolvedValueOnce(false)
    ensureSpy.mockResolvedValueOnce(true)

    let pendingTimer: ReturnType<typeof setTimeout> | null = null
    const scheduler = {
      schedule: vi.fn((task: () => void) => {
        pendingTimer = setTimeout(task, 5)
        return 5
      }),
      reset: vi.fn(() => {
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          pendingTimer = null
        }
      }),
      clear: vi.fn(() => {
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          pendingTimer = null
        }
      }),
      attempts: 0,
    }
    const retrySpy = vi.spyOn(realtime, "createRetryScheduler").mockReturnValue(scheduler as any)

    const { supabase, channel } = createSupabaseStub()
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-retry-success" })
    )

    await act(async () => {
      vi.advanceTimersByTime(6)
    })

    await waitFor(() => expect(supabase.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))

    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))
    expect(scheduler.schedule).toHaveBeenCalledTimes(1)
    expect(ensureSpy).toHaveBeenCalledTimes(2)

    retrySpy.mockRestore()
    ensureSpy.mockRestore()
  })

  it("卸载后会跳过已排队的重试与状态回调", async () => {
    let scheduledTask: (() => void) | null = null
    let executedAfterUnmount = false
    const scheduler = {
      schedule: vi.fn((task: () => void) => {
        scheduledTask = () => {
          executedAfterUnmount = true
          task()
        }
        return 5
      }),
      reset: vi.fn(),
      clear: vi.fn(),
      attempts: 0,
    }
    const retrySpy = vi.spyOn(realtime, "createRetryScheduler").mockReturnValue(scheduler as any)

    const { supabase, channel } = createSupabaseStub()
    createClientMock.mockReturnValue(supabase as any)

    const { unmount } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-cancel" })
    )

    await waitFor(() => expect(supabase.channel).toHaveBeenCalled())

    act(() => channel.emitStatus("CHANNEL_ERROR"))
    expect(scheduler.schedule).toHaveBeenCalledTimes(1)

    unmount()

    act(() => scheduledTask?.())
    act(() => channel.emitStatus("SUBSCRIBED"))

    expect(executedAfterUnmount).toBe(true)

    retrySpy.mockRestore()
  })

  it("轮询已运行时再次触发 startPolling 会被短路", async () => {
    vi.useFakeTimers()
    const pollFetcher = vi.fn().mockResolvedValue(undefined)

    const scheduler = {
      schedule: vi.fn(() => null),
      reset: vi.fn(),
      clear: vi.fn(),
      attempts: 0,
    }
    const retrySpy = vi.spyOn(realtime, "createRetryScheduler").mockReturnValue(scheduler as any)

    const { supabase, channel } = createSupabaseStub()
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-polling", pollFetcher, pollInterval: 1000 })
    )

    await waitFor(() => expect(supabase.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("CHANNEL_ERROR"))
    await waitFor(() => expect(result.current.isPollingFallback).toBe(true))
    expect(pollFetcher).toHaveBeenCalledTimes(1)

    act(() => channel.emitStatus("CHANNEL_ERROR"))
    expect(pollFetcher).toHaveBeenCalledTimes(1)

    retrySpy.mockRestore()
  })

  it("未知频道状态不会触发订阅或重试", async () => {
    const { supabase, channel } = createSupabaseStub()
    createClientMock.mockReturnValue(supabase as any)

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-unknown" })
    )

    await waitFor(() => expect(supabase.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("CHANNEL_JOINED" as any))

    expect(result.current.connectionState).toBe("disconnected")
    expect(result.current.isSubscribed).toBe(false)
  })

  it("离线时跳过轮询降级", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false })
    const pollFetcher = vi.fn()

    const { result } = renderHook(() =>
      useRealtimeLikes({ targetType: "post", targetId: "post-offline-poll", pollFetcher })
    )

    expect(result.current.connectionState).toBe("disconnected")
    expect(pollFetcher).not.toHaveBeenCalled()
  })
})
