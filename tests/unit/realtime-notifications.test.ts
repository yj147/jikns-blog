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
  let postgresHandler:
    | ((payload: RealtimePostgresChangesPayload<NotificationRow>) => void)
    | null = null
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
})
