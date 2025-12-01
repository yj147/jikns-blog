import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { createClient } from "@/lib/supabase"
import type { NotificationView } from "@/components/notifications/types"
import { NotificationType } from "@/lib/generated/prisma"

type NotificationRow = {
  id: string
  recipientId: string
  actorId: string
  type: NotificationType
  postId: string | null
  commentId: string | null
  readAt: string | null
  createdAt: string
}

function createChannelMock() {
  let changeHandler: ((payload: RealtimePostgresChangesPayload<NotificationRow>) => void) | null =
    null
  let statusHandler: ((status: string) => void) | null = null

  const channel = {
    on: vi.fn((_event, _filter, cb) => {
      changeHandler = cb
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      statusHandler = cb ?? null
      return channel
    }),
    triggerInsert(payload: NotificationRow) {
      changeHandler?.({ new: payload } as RealtimePostgresChangesPayload<NotificationRow>)
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
        postId: null,
        commentId: null,
        readAt: null,
        createdAt: hydrated.createdAt,
      })
    })

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1))
    expect(onInsert).toHaveBeenCalledWith(hydrated)
    expect(singleMock).toHaveBeenCalled()
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
})
