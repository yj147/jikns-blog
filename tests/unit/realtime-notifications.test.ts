import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { createClient } from "@/lib/supabase"
import type { NotificationView } from "@/components/notifications/types"
import { NotificationType } from "@/lib/generated/prisma"

vi.mock("@/lib/api/fetch-json", () => ({
  fetchJson: vi.fn(),
}))

vi.mock("@/lib/realtime/connection", () => ({
  ensureSessionReady: vi.fn(),
  useNetworkStatus: vi.fn(),
  useOnlineCallback: vi.fn(),
}))

vi.mock("@/lib/realtime/retry", () => ({
  createRetryScheduler: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}))

type NotificationRow = {
  id: string
  recipientId: string
  actorId: string
  type: NotificationType
  activityId: string | null
  postId: string | null
  commentId: string | null
  readAt: string | null
  createdAt: string
}

const fetchJsonMock = vi.mocked((await import("@/lib/api/fetch-json")).fetchJson)
const ensureSessionReadyMock = vi.mocked(
  (await import("@/lib/realtime/connection")).ensureSessionReady
)
const useNetworkStatusMock = vi.mocked((await import("@/lib/realtime/connection")).useNetworkStatus)
const useOnlineCallbackMock = vi.mocked(
  (await import("@/lib/realtime/connection")).useOnlineCallback
)
const createRetrySchedulerMock = vi.mocked(
  (await import("@/lib/realtime/retry")).createRetryScheduler
)

function createChannelMock() {
  let postgresHandler: ((payload: RealtimePostgresChangesPayload<NotificationRow>) => void) | null =
    null
  let broadcastHandler: ((payload: { event: string; payload: NotificationRow }) => void) | null =
    null
  let statusHandler: ((status: string) => void) | null = null

  const channel = {
    on: vi.fn((event, _filter, cb) => {
      if (event === "postgres_changes") {
        postgresHandler = cb
      } else if (event === "broadcast") {
        broadcastHandler = cb
      }
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      statusHandler = cb ?? null
      return channel
    }),
    triggerInsert(payload: NotificationRow) {
      postgresHandler?.({ new: payload } as RealtimePostgresChangesPayload<NotificationRow>)
    },
    triggerBroadcast(payload: NotificationRow) {
      broadcastHandler?.({ event: "INSERT", payload })
    },
    emitStatus(status: string) {
      statusHandler?.(status)
    },
  }

  return channel
}

describe("useRealtimeNotifications", () => {
  let channel: ReturnType<typeof createChannelMock>
  let supabaseMock: any
  let singleMock: ReturnType<typeof vi.fn>
  let eqMock: ReturnType<typeof vi.fn>
  let selectMock: ReturnType<typeof vi.fn>
  let getSessionMock: ReturnType<typeof vi.fn>
  let scheduledTask: (() => void) | null
  let retryScheduler: {
    schedule: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    readonly attempts: number
  }
  let onlineCallback: (() => void) | null

  beforeEach(() => {
    channel = createChannelMock()
    singleMock = vi.fn()
    eqMock = vi.fn(() => ({ single: singleMock }))
    selectMock = vi.fn(() => ({ eq: eqMock }))
    getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    })
    supabaseMock = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({ select: selectMock })),
      auth: { getSession: getSessionMock },
    }

    fetchJsonMock.mockResolvedValue({ success: true, data: { items: [] } } as any)
    let attempts = 0
    scheduledTask = null
    onlineCallback = null
    retryScheduler = {
      schedule: vi.fn((task: () => void) => {
        attempts += 1
        scheduledTask = task
        return 0
      }),
      reset: vi.fn(() => {
        attempts = 0
      }),
      clear: vi.fn(() => {
        scheduledTask = null
      }),
      get attempts() {
        return attempts
      },
    }
    createRetrySchedulerMock.mockReturnValue(retryScheduler as any)
    ensureSessionReadyMock.mockResolvedValue(true)
    useNetworkStatusMock.mockReturnValue(true)
    useOnlineCallbackMock.mockImplementation((cb) => {
      onlineCallback = cb
    })

    vi.mocked(createClient).mockReturnValue(supabaseMock)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("INSERT 事件应触发 onInsert 回调并返回补全后的通知", async () => {
    const onInsert = vi.fn()
    const hydrated: NotificationView = {
      id: "notif-1",
      type: NotificationType.LIKE,
      readAt: null,
      createdAt: new Date().toISOString(),
      recipientId: "user-1",
      actorId: "actor-1",
      actor: { id: "actor-1", name: "Tester", avatarUrl: null, email: "actor@example.com" },
      post: null,
      comment: null,
    }

    singleMock.mockResolvedValue({ data: hydrated, error: null })

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-1", enabled: true, onInsert })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())

    act(() => {
      channel.emitStatus("SUBSCRIBED")
    })

    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    act(() => {
      channel.triggerInsert({
        id: "notif-1",
        recipientId: "user-1",
        actorId: "actor-1",
        type: NotificationType.LIKE,
        activityId: null,
        postId: null,
        commentId: null,
        readAt: null,
        createdAt: hydrated.createdAt,
      })
    })

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1))
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ...hydrated,
        activityId: null,
        targetUrl: null,
      })
    )
    expect(singleMock).toHaveBeenCalled()
  })

  it("broadcast 事件也会触发 onInsert 并使用回退数据", async () => {
    const onInsert = vi.fn()
    fetchJsonMock.mockRejectedValueOnce(new Error("api down"))
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "not found" } })

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-broadcast", enabled: true, onInsert })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))
    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    const createdAt = new Date().toISOString()

    act(() => {
      channel.triggerBroadcast({
        id: "notif-broadcast",
        recipientId: "user-broadcast",
        actorId: "actor-broadcast",
        type: NotificationType.LIKE,
        activityId: null,
        postId: null,
        commentId: null,
        readAt: null,
        createdAt,
      })
    })

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1))
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "notif-broadcast",
        actorId: "actor-broadcast",
        targetUrl: null,
        createdAt,
      })
    )
  })

  it("卸载时应移除订阅通道", async () => {
    const { result, unmount } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-2", enabled: true, onInsert: vi.fn() })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())

    act(() => channel.emitStatus("SUBSCRIBED"))
    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    unmount()

    expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channel)
  })

  it("会话未就绪时应调度重试并在下一次尝试成功订阅", async () => {
    ensureSessionReadyMock.mockResolvedValueOnce(false).mockResolvedValue(true)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-3", enabled: true, onInsert: vi.fn() })
    )

    await waitFor(() => expect(retryScheduler.schedule).toHaveBeenCalledTimes(1))

    act(() => {
      scheduledTask?.()
    })

    await waitFor(() => expect(ensureSessionReadyMock).toHaveBeenCalledTimes(2))

    act(() => channel.emitStatus("SUBSCRIBED"))

    await waitFor(() => expect(result.current.isSubscribed).toBe(true))
    expect(retryScheduler.reset).toHaveBeenCalled()
  })

  it("离线时跳过订阅，上线回调触发重试", async () => {
    useNetworkStatusMock.mockReturnValueOnce(false).mockReturnValue(true)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-4", enabled: true, onInsert: vi.fn() })
    )

    expect(supabaseMock.channel).not.toHaveBeenCalled()

    act(() => {
      onlineCallback?.()
    })

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())

    act(() => channel.emitStatus("SUBSCRIBED"))

    await waitFor(() => expect(result.current.isSubscribed).toBe(true))
  })

  it("重试 3 次后降级到轮询并继续拉取通知", async () => {
    vi.useFakeTimers()
    ensureSessionReadyMock.mockResolvedValue(false)

    const scheduleSequence: Array<number | null> = [0, 0, null]
    retryScheduler.schedule.mockImplementation((task: () => void) => {
      const delay = scheduleSequence.shift() ?? null
      if (delay !== null) {
        scheduledTask = task
      } else {
        scheduledTask = null
      }
      return delay
    })

    const onInsert = vi.fn()
    const pollNotification: NotificationView = {
      id: "poll-1",
      type: NotificationType.LIKE,
      readAt: null,
      createdAt: new Date().toISOString(),
      recipientId: "user-poll",
      actorId: "actor-1",
      actor: { id: "actor-1", name: null, avatarUrl: null, email: null },
      post: null,
      comment: null,
    }
    fetchJsonMock.mockResolvedValue({
      success: true,
      data: {
        items: [pollNotification],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
        unreadCount: 1,
        filteredUnreadCount: 1,
      },
    } as any)

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: "user-poll",
        enabled: true,
        onInsert,
        pollInterval: 10,
      })
    )

    await waitFor(() => expect(retryScheduler.schedule).toHaveBeenCalledTimes(1))

    act(() => {
      scheduledTask?.()
    })
    await waitFor(() => expect(retryScheduler.schedule).toHaveBeenCalledTimes(2))

    act(() => {
      scheduledTask?.()
    })

    await waitFor(() => expect(retryScheduler.schedule).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(result.current.isPollingFallback).toBe(true))
    await waitFor(() =>
      expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: "poll-1" }))
    )

    act(() => {
      vi.advanceTimersByTime(10)
    })

    await waitFor(() => expect(fetchJsonMock).toHaveBeenCalledTimes(2))
    vi.useRealTimers()
  })

  it("refresh 可以手动触发一次轮询请求", async () => {
    const onInsert = vi.fn()
    fetchJsonMock.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: "manual-1",
            type: NotificationType.LIKE,
            readAt: null,
            createdAt: new Date().toISOString(),
            recipientId: "user-refresh",
            actorId: "actor-2",
            actor: { id: "actor-2", name: null, avatarUrl: null, email: null },
            post: null,
            comment: null,
          } satisfies NotificationView,
        ],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
        unreadCount: 1,
        filteredUnreadCount: 1,
      },
    } as any)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-refresh", enabled: true, onInsert })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))
    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    await act(async () => {
      await result.current.refresh()
    })

    expect(fetchJsonMock).toHaveBeenCalled()
    await waitFor(() =>
      expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: "manual-1" }))
    )
  })

  it("网络恢复后应停止轮询并重新尝试 realtime 订阅", async () => {
    vi.useFakeTimers()
    ensureSessionReadyMock.mockResolvedValueOnce(false).mockResolvedValue(true)
    retryScheduler.schedule.mockReturnValueOnce(null)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-recover", enabled: true, onInsert: vi.fn() })
    )

    await waitFor(() => expect(result.current.isPollingFallback).toBe(true))

    act(() => {
      onlineCallback?.()
    })

    await waitFor(() => expect(retryScheduler.reset).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalledTimes(1))

    act(() => channel.emitStatus("SUBSCRIBED"))

    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))
    expect(result.current.isPollingFallback).toBe(false)
    vi.useRealTimers()
  })

  it("禁用时应跳过订阅并复用外部 supabase 客户端", async () => {
    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: undefined,
        enabled: false,
        onInsert: vi.fn(),
        supabase: supabaseMock,
      })
    )

    expect(supabaseMock.channel).not.toHaveBeenCalled()
    expect(result.current.connectionState).toBe("disconnected")
  })

  it("轮询时应构建各类型通知的 targetUrl 覆盖分支", async () => {
    const onInsert = vi.fn()
    const now = new Date().toISOString()
    fetchJsonMock.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: "follow-1",
            type: NotificationType.FOLLOW,
            readAt: null,
            createdAt: now,
            recipientId: "user-target",
            actorId: "actor-follow",
            actor: { id: "actor-follow", name: null, avatarUrl: null, email: null },
            post: null,
            comment: null,
          },
          {
            id: "comment-activity",
            type: NotificationType.COMMENT,
            readAt: null,
            createdAt: now,
            recipientId: "user-target",
            actorId: "actor-comment",
            actor: { id: "actor-comment", name: null, avatarUrl: null, email: null },
            post: null,
            comment: { postId: null, activityId: "activity-1" },
          },
          {
            id: "comment-post",
            type: NotificationType.COMMENT,
            readAt: null,
            createdAt: now,
            recipientId: "user-target",
            actorId: "actor-comment-2",
            actor: { id: "actor-comment-2", name: null, avatarUrl: null, email: null },
            post: { id: "post-1", slug: "slug-1" },
            comment: { postId: "slug-1", activityId: null },
          },
          {
            id: "like-activity",
            type: NotificationType.LIKE,
            readAt: null,
            createdAt: now,
            recipientId: "user-target",
            actorId: "actor-like",
            actor: { id: "actor-like", name: null, avatarUrl: null, email: null },
            activityId: "activity-like",
            post: null,
            comment: null,
          },
          {
            id: "system-1",
            type: NotificationType.SYSTEM,
            readAt: null,
            createdAt: now,
            recipientId: "user-target",
            actorId: "actor-system",
            actor: { id: "actor-system", name: null, avatarUrl: null, email: null },
            post: null,
            comment: null,
          },
        ],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
        unreadCount: 5,
        filteredUnreadCount: 5,
      },
    } as any)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-target", enabled: true, onInsert })
    )

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(5))
    const calls = onInsert.mock.calls.map(([payload]) => ({
      id: (payload as NotificationView).id,
      targetUrl: (payload as NotificationView).targetUrl,
    }))

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "follow-1", targetUrl: "/profile/actor-follow" }),
        expect.objectContaining({
          id: "comment-activity",
          targetUrl: "/feed?highlight=activity-1",
        }),
        expect.objectContaining({ id: "comment-post", targetUrl: "/blog/slug-1#comments" }),
        expect.objectContaining({
          id: "like-activity",
          targetUrl: "/feed?highlight=activity-like",
        }),
        expect.objectContaining({ id: "system-1", targetUrl: null }),
      ])
    )
  })

  it("轮询重复数据时应去重避免重复触发 onInsert", async () => {
    const onInsert = vi.fn()
    const duplicate: NotificationView = {
      id: "dup-1",
      type: NotificationType.LIKE,
      readAt: null,
      createdAt: new Date().toISOString(),
      recipientId: "user-dup",
      actorId: "actor-dup",
      actor: { id: "actor-dup", name: null, avatarUrl: null, email: null },
      post: null,
      comment: null,
    }
    fetchJsonMock.mockResolvedValue({
      success: true,
      data: {
        items: [duplicate],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
        unreadCount: 1,
        filteredUnreadCount: 1,
      },
    } as any)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-dup", enabled: true, onInsert })
    )

    await act(async () => {
      await result.current.refresh()
    })
    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1))

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1))
    expect(fetchJsonMock).toHaveBeenCalledTimes(2)
  })

  it("轮询失败时应记录错误并结束刷新状态", async () => {
    const pollError = new Error("poll failed")
    fetchJsonMock.mockRejectedValueOnce(pollError)

    const { result } = renderHook(() =>
      useRealtimeNotifications({ userId: "user-error", enabled: true, onInsert: vi.fn() })
    )

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.error).toBe(pollError))
    expect(result.current.isRefreshing).toBe(false)
    expect(result.current.connectionState).toBe("error")
  })

  it("hydrate 失败时应捕获错误并转换 createdAt", async () => {
    const hydrateError = new Error("hydrate failed")
    singleMock.mockRejectedValueOnce(hydrateError)

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: "user-hydrate-error",
        enabled: true,
        onInsert: vi.fn(),
      })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))

    const createdAt = new Date("2024-01-01T00:00:00.000Z")

    act(() => {
      channel.triggerInsert({
        id: "hydrate-error",
        recipientId: "user-hydrate-error",
        actorId: "actor-x",
        type: NotificationType.LIKE,
        activityId: null,
        postId: null,
        commentId: null,
        readAt: null,
        createdAt,
      })
    })

    await waitFor(() => expect(result.current.error).toBe(hydrateError))
  })

  it("fallback 应为评论通知构建 comment 对象和 targetUrl", async () => {
    const onInsert = vi.fn()
    fetchJsonMock.mockResolvedValue({ success: true, data: { items: [] } } as any)
    singleMock.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: "user-comment-fallback",
        enabled: true,
        onInsert,
      })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))

    act(() => {
      channel.triggerBroadcast({
        id: "comment-fallback",
        recipientId: "user-comment-fallback",
        actorId: "actor-c1",
        type: NotificationType.COMMENT,
        activityId: "act-c1",
        postId: "post-c1",
        commentId: "comment-c1",
        readAt: null,
        createdAt: new Date().toISOString(),
      })
    })

    await waitFor(() =>
      expect(onInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "comment-fallback",
          comment: expect.objectContaining({ id: "comment-c1", postId: "post-c1" }),
          targetUrl: "/feed?highlight=act-c1",
        })
      )
    )
  })

  it("订阅通道异常时应设置错误并触发重试", async () => {
    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: "user-channel-error",
        enabled: true,
        onInsert: vi.fn(),
      })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())

    act(() => {
      channel.emitStatus("CHANNEL_ERROR")
    })

    await waitFor(() =>
      expect(result.current.error?.message).toBe("Failed to subscribe to notifications")
    )
    expect(retryScheduler.schedule).toHaveBeenCalled()
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled())
  })

  it("订阅异常且获取 session 返回错误时也应记录日志并重试", async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "boom" } })

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: "user-session-error",
        enabled: true,
        onInsert: vi.fn(),
      })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())

    act(() => {
      channel.emitStatus("TIMED_OUT")
    })

    await waitFor(() =>
      expect(result.current.error?.message).toBe("Failed to subscribe to notifications")
    )
    expect(retryScheduler.schedule).toHaveBeenCalled()
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled())
  })

  it("订阅异常且获取 session 抛出异常时仍应调度重试", async () => {
    getSessionMock.mockRejectedValueOnce(new Error("session crash"))

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        userId: "user-session-throw",
        enabled: true,
        onInsert: vi.fn(),
      })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())

    act(() => {
      channel.emitStatus("CLOSED")
    })

    await waitFor(() =>
      expect(result.current.error?.message).toBe("Failed to subscribe to notifications")
    )
    expect(retryScheduler.schedule).toHaveBeenCalled()
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled())
  })
})
