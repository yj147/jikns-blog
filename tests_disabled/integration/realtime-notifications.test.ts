import { randomUUID } from "node:crypto"
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { createClient } from "@/lib/supabase"
import { NotificationType } from "@/lib/generated/prisma"
import type { Database } from "@/types/database"
import type { NotificationView } from "@/components/notifications/types"
import { realPrisma, disconnectRealDb } from "./setup-real-db"

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

function createChannelMock() {
  let postgresHandler: ((payload: NotificationRow) => void) | null = null
  let broadcastHandler: ((payload: NotificationRow) => void) | null = null
  let statusHandler: ((status: string) => void) | null = null

  const channel = {
    on: vi.fn((event, _filter, cb) => {
      if (event === "postgres_changes") {
        postgresHandler = (payload) => cb({ new: payload })
      } else if (event === "broadcast") {
        broadcastHandler = (payload) => cb({ event: "INSERT", payload })
      }
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      statusHandler = cb ?? null
      return channel
    }),
    triggerInsert(row: NotificationRow) {
      postgresHandler?.(row)
    },
    triggerBroadcast(row: NotificationRow) {
      broadcastHandler?.(row)
    },
    emitStatus(status: string) {
      statusHandler?.(status)
    },
  }

  return channel
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const missingSupabaseEnv = !supabaseUrl || !supabaseServiceRoleKey

if (missingSupabaseEnv) {
  // eslint-disable-next-line no-console
  console.warn("Skipping realtime notifications integration test: Supabase env not configured")
}

;(missingSupabaseEnv ? describe.skip : describe)("实时通知 - 集成", () => {
  let channel: ReturnType<typeof createChannelMock>
  let supabaseMock: any
  let singleMock: ReturnType<typeof vi.fn>
  let eqMock: ReturnType<typeof vi.fn>
  let selectMock: ReturnType<typeof vi.fn>
  let getSessionMock: ReturnType<typeof vi.fn>
  const createdUserIds: string[] = []
  const createdNotificationIds: string[] = []

  beforeEach(() => {
    channel = createChannelMock()
    singleMock = vi.fn()
    eqMock = vi.fn(() => ({ single: singleMock }))
    selectMock = vi.fn(() => ({ eq: eqMock }))

    const realClient = createSupabaseClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { access_token: "service-role-session" } },
      error: null,
    })

    Object.assign(realClient, {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({ select: selectMock })),
      auth: { ...realClient.auth, getSession: getSessionMock },
    })

    supabaseMock = realClient
    vi.mocked(createClient).mockReturnValue(supabaseMock as any)
  })

  afterEach(async () => {
    if (createdNotificationIds.length) {
      await realPrisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } })
      createdNotificationIds.length = 0
    }

    if (createdUserIds.length) {
      await realPrisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
      createdUserIds.length = 0
    }

    vi.clearAllMocks()
  })

  afterAll(async () => {
    await disconnectRealDb()
  })

  it("插入通知后回调应返回包含 actor 信息的完整数据", async () => {
    const recipient = await realPrisma.user.create({
      data: {
        id: randomUUID(),
        email: `recipient-${Date.now()}@example.com`,
        name: "Realtime Recipient",
        role: "USER",
        status: "ACTIVE",
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
    })
    const actor = await realPrisma.user.create({
      data: {
        id: randomUUID(),
        email: `actor-${Date.now()}@example.com`,
        name: "Realtime Actor",
        role: "USER",
        status: "ACTIVE",
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
    })

    createdUserIds.push(recipient.id, actor.id)

    const onInsert = vi.fn()

    const { unmount, result } = renderHook(() =>
      useRealtimeNotifications({ userId: recipient.id, enabled: true, onInsert })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))
    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    const record = await realPrisma.notification.create({
      data: {
        id: randomUUID(),
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.LIKE,
        createdAt: new Date(),
      },
    })
    createdNotificationIds.push(record.id)

    const hydratedNotification: NotificationView = {
      id: record.id,
      type: NotificationType.LIKE,
      readAt: null,
      createdAt: record.createdAt.toISOString(),
      recipientId: recipient.id,
      actorId: actor.id,
      actor: { id: actor.id, name: actor.name, avatarUrl: null, email: actor.email },
      post: null,
      comment: null,
    }
    singleMock.mockResolvedValue({ data: hydratedNotification, error: null })

    act(() => {
      channel.triggerInsert({
        id: record.id,
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.LIKE,
        activityId: null,
        postId: null,
        commentId: null,
        readAt: null,
        createdAt: record.createdAt.toISOString(),
      })
    })

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1), { timeout: 8000 })
    const received = onInsert.mock.calls[0][0] as NotificationView

    expect(received.actor?.id).toBe(actor.id)
    expect(received.actor?.name).toBe(actor.name)
    expect(received.recipientId).toBe(recipient.id)

    unmount()
  })
})
