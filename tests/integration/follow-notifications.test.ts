/**
 * Follow 通知端到端集成测试（内存 Prisma Mock）
 *
 * 覆盖点：
 * - follow 操作写入 FOLLOW 通知并包含 actor/recipient 关联
 * - 通知视图 targetUrl 解析正确（指向关注者主页）
 * - 关闭 follow 通知偏好时不落库
 * - unfollow 不产生通知
 * - Realtime 订阅能收到 FOLLOW 插入事件并返回完整 payload
 */

import { randomUUID } from "node:crypto"
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { SupabaseClient } from "@supabase/supabase-js"

import { NotificationType } from "@/lib/generated/prisma"
import type { NotificationView } from "@/components/notifications/types"
import type { Database } from "@/types/database"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { createMockRequest } from "../helpers/test-utils"
import { TEST_USERS } from "../helpers/test-data"
import { assertPolicy } from "@/lib/auth/session"

type UserRecord = {
  id: string
  email: string
  name: string | null
  role: "USER" | "ADMIN"
  status: "ACTIVE" | "BANNED"
  avatarUrl?: string | null
  bio?: string | null
  notificationPreferences?: Record<string, boolean>
}

type FollowRecord = {
  followerId: string
  followingId: string
  createdAt: Date
}

type NotificationRecord = {
  id: string
  recipientId: string
  actorId: string
  type: NotificationType
  postId: string | null
  commentId: string | null
  readAt: Date | null
  createdAt: Date
}

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

const db = {
  users: new Map<string, UserRecord>(),
  follows: new Map<string, FollowRecord>(),
  notifications: new Map<string, NotificationRecord>(),
}

const toFollowKey = (followerId: string, followingId: string) => `${followerId}:${followingId}`

function resetDb() {
  db.users.clear()
  db.follows.clear()
  db.notifications.clear()
}

async function createUser(data: Partial<UserRecord> = {}): Promise<UserRecord> {
  const record: UserRecord = {
    id: data.id ?? randomUUID(),
    email: data.email ?? `user-${Date.now()}@example.com`,
    name: data.name ?? "Test User",
    role: data.role ?? "USER",
    status: data.status ?? "ACTIVE",
    avatarUrl: data.avatarUrl ?? null,
    bio: data.bio ?? null,
    notificationPreferences: data.notificationPreferences ?? {},
  }

  db.users.set(record.id, record)
  return record
}

function createPrismaMock() {
  const mock: any = {
    user: {
      async findUnique({ where, select }: any) {
        let user: UserRecord | undefined
        if (where?.id) user = db.users.get(where.id)
        if (!user) return null
        if (!select) return user
        const result: any = {}
        Object.keys(select).forEach((key) => {
          if (select[key]) {
            result[key] = (user as any)[key] ?? null
          }
        })
        return result
      },
      async create({ data }: any) {
        return createUser(data)
      },
    },
    follow: {
      async findUnique({ where }: any) {
        const key = toFollowKey(
          where.followerId_followingId.followerId,
          where.followerId_followingId.followingId
        )
        return db.follows.get(key) ?? null
      },
      async create({ data }: any) {
        const key = toFollowKey(data.followerId, data.followingId)
        const record: FollowRecord = {
          followerId: data.followerId,
          followingId: data.followingId,
          createdAt: new Date(),
        }
        db.follows.set(key, record)
        return record
      },
      async findMany({ where }: any = {}) {
        const records = [...db.follows.values()].filter((item) => {
          const followerMatch =
            !where?.followerId ||
            item.followerId === where.followerId ||
            (where.followerId.in && where.followerId.in.includes(item.followerId))
          const followingMatch =
            !where?.followingId ||
            item.followingId === where.followingId ||
            (where.followingId.in && where.followingId.in.includes(item.followingId))
          return followerMatch && followingMatch
        })
        return records.map((item) => ({
          ...item,
          followerId: item.followerId,
          followingId: item.followingId,
        }))
      },
      async delete({ where }: any) {
        const key = toFollowKey(
          where.followerId_followingId.followerId,
          where.followerId_followingId.followingId
        )
        const existing = db.follows.get(key)
        if (!existing) {
          const error: any = new Error("Not found")
          error.code = "P2025"
          throw error
        }
        db.follows.delete(key)
        return existing
      },
      async deleteMany({ where }: any) {
        let count = 0
        for (const key of db.follows.keys()) {
          const value = db.follows.get(key)!
          const match =
            (!where?.followerId || value.followerId === where.followerId) &&
            (!where?.followingId || value.followingId === where.followingId)
          if (match) {
            db.follows.delete(key)
            count += 1
          }
        }
        return { count }
      },
    },
    notification: {
      async create({ data }: any) {
        const record: NotificationRecord = {
          id: data.id ?? randomUUID(),
          recipientId: data.recipientId,
          actorId: data.actorId,
          type: data.type,
          postId: data.postId ?? null,
          commentId: data.commentId ?? null,
          readAt: data.readAt ?? null,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        }
        db.notifications.set(record.id, record)
        return record
      },
      async findMany({ where, orderBy, include }: any = {}) {
        let items = [...db.notifications.values()].filter((item) => {
          const matchRecipient = where?.recipientId ? item.recipientId === where.recipientId : true
          const matchType = where?.type ? item.type === where.type : true
          const matchId =
            where?.id?.in && Array.isArray(where.id.in)
              ? where.id.in.includes(item.id)
              : where?.id
                ? item.id === where.id
                : true
          const matchReadAt =
            where?.readAt === null ? item.readAt === null : where?.readAt ? item.readAt === where.readAt : true
          return matchRecipient && matchType && matchId && matchReadAt
        })

        if (orderBy && Array.isArray(orderBy)) {
          items = items.sort((a, b) => {
            for (const clause of orderBy) {
              if ("createdAt" in clause) {
                if (a.createdAt.getTime() !== b.createdAt.getTime()) {
                  return clause.createdAt === "desc"
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime()
                }
              }
              if ("id" in clause) {
                if (a.id === b.id) continue
                return clause.id === "desc" ? (b.id > a.id ? 1 : -1) : a.id > b.id ? 1 : -1
              }
            }
            return 0
          })
        }

        return items.map((item) => {
          const actor = include?.actor ? db.users.get(item.actorId) : undefined
          return {
            ...item,
            actor: actor
              ? {
                  id: actor.id,
                  name: actor.name,
                  avatarUrl: actor.avatarUrl ?? null,
                  email: actor.email,
                }
              : undefined,
            post: null,
            comment: null,
          }
        })
      },
      async count({ where }: any = {}) {
        return [...db.notifications.values()].filter((item) => {
          const matchRecipient = where?.recipientId ? item.recipientId === where.recipientId : true
          const matchType = where?.type ? item.type === where.type : true
          const matchReadAt = where?.readAt === null ? item.readAt === null : true
          return matchRecipient && matchType && matchReadAt
        }).length
      },
      async deleteMany({ where }: any) {
        let count = 0
        for (const [id, item] of db.notifications.entries()) {
          const matchRecipient = where?.recipientId ? item.recipientId === where.recipientId : true
          const matchType = where?.type ? item.type === where.type : true
          if (matchRecipient && matchType) {
            db.notifications.delete(id)
            count += 1
          }
        }
        return { count }
      },
      async findFirstOrThrow({ where }: any) {
        const item = [...db.notifications.values()].find((record) => {
          return Object.entries(where ?? {}).every(([key, value]) => (record as any)[key] === value)
        })
        if (!item) throw new Error("Not found")
        return item
      },
    },
  }

  mock.$transaction = async (cb: any) =>
    cb({
      user: mock.user,
      follow: mock.follow,
      notification: mock.notification,
    })

  return mock
}

const prismaMock = vi.hoisted(() => createPrismaMock())

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session")
  return {
    ...actual,
    assertPolicy: vi.fn(),
    generateRequestId: () => "follow-notification-test",
  }
})

function createChannelMock() {
  let changeHandler: ((payload: NotificationRow) => void) | null = null
  let statusHandler: ((status: string) => void) | null = null

  const channel = {
    on: vi.fn((_event, _filter, cb) => {
      changeHandler = (payload) => cb({ new: payload })
      return channel
    }),
    subscribe: vi.fn((cb?: (status: string) => void) => {
      statusHandler = cb ?? null
      return channel
    }),
    triggerInsert(row: NotificationRow) {
      changeHandler?.(row)
    },
    emitStatus(status: string) {
      statusHandler?.(status)
    },
  }

  return channel
}

let followUser: typeof import("@/lib/interactions/follow").followUser
let unfollowUser: typeof import("@/lib/interactions/follow").unfollowUser
let listNotifications: typeof import("@/app/api/notifications/route").GET

describe("Follow notifications", () => {
  beforeAll(async () => {
    ;({ followUser, unfollowUser } = await import("@/lib/interactions/follow"))
    ;({ GET: listNotifications } = await import("@/app/api/notifications/route"))
  })

  beforeEach(() => {
    resetDb()
    vi.mocked(assertPolicy).mockReset()
  })

  afterAll(() => {
    resetDb()
  })

  it("follow 会创建 FOLLOW 通知并携带 actorId / recipientId / targetUrl", async () => {
    const follower = await createUser({ name: "Follower" })
    const target = await createUser({ name: "Target" })

    const result = await followUser(follower.id, target.id)
    expect(result.wasNew).toBe(true)

    const notifications = await prismaMock.notification.findMany({
      where: { recipientId: target.id, type: NotificationType.FOLLOW },
    })

    expect(notifications).toHaveLength(1)
    const record = notifications[0]
    expect(record.actorId).toBe(follower.id)
    expect(record.postId).toBeNull()
    expect(record.commentId).toBeNull()

    const authUser = { ...TEST_USERS.user, id: target.id, email: target.email, name: target.name }
    vi.mocked(assertPolicy).mockResolvedValue([authUser as any, null])

    const response = await listNotifications(
      createMockRequest("GET", "/api/notifications", { searchParams: { ids: record.id } })
    )
    const payload = await response.json()
    const item = payload.data.items[0] as NotificationView

    expect(item.actor?.id).toBe(follower.id)
    expect(item.recipientId).toBe(target.id)
    expect(item.targetUrl).toBe(`/profile/${follower.id}`)
  })

  it("关闭 follow 通知偏好时不落库", async () => {
    const follower = await createUser({ name: "Follower pref off" })
    const target = await createUser({
      name: "Target pref off",
      notificationPreferences: { FOLLOW: false },
    })

    const followResult = await followUser(follower.id, target.id)
    expect(followResult.wasNew).toBe(true)

    const notifications = await prismaMock.notification.findMany({
      where: { recipientId: target.id, type: NotificationType.FOLLOW },
    })

    expect(notifications).toHaveLength(0)
    const followRecord = await prismaMock.follow.findUnique({
      where: { followerId_followingId: { followerId: follower.id, followingId: target.id } },
    })
    expect(followRecord).toBeTruthy()
  })

  it("unfollow 不会生成新的通知", async () => {
    const follower = await createUser({ name: "Follower remove" })
    const target = await createUser({ name: "Target remove" })

    await followUser(follower.id, target.id)
    await prismaMock.notification.deleteMany({ where: { recipientId: target.id } })

    const unfollowResult = await unfollowUser(follower.id, target.id)
    expect(unfollowResult.wasDeleted).toBe(true)

    const notifications = await prismaMock.notification.findMany({
      where: { recipientId: target.id, type: NotificationType.FOLLOW },
    })
    expect(notifications).toHaveLength(0)
  })

  it("Realtime 订阅能够收到 FOLLOW 通知并包含 targetUrl", async () => {
    const follower = await createUser({ name: "Realtime follower" })
    const target = await createUser({ name: "Realtime target" })
    await followUser(follower.id, target.id)

    const created = await prismaMock.notification.findFirstOrThrow({
      where: { recipientId: target.id, type: NotificationType.FOLLOW },
    })

    const channel = createChannelMock()
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: created.id,
        type: NotificationType.FOLLOW,
        readAt: null,
        createdAt: created.createdAt.toISOString(),
        recipientId: target.id,
        actorId: follower.id,
        actor: { id: follower.id, name: follower.name, avatarUrl: null, email: follower.email },
        post: null,
        comment: null,
      } satisfies NotificationView,
      error: null,
    })
    const eqMock = vi.fn(() => ({ single: singleMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))

    const supabaseMock = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({ select: selectMock })),
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token", user: { id: target.id } } },
          error: null,
        }),
      },
    } as unknown as SupabaseClient<Database>

    const onInsert = vi.fn()
    const { result, unmount } = renderHook(() =>
      useRealtimeNotifications({
        userId: target.id,
        supabase: supabaseMock,
        enabled: true,
        onInsert,
      })
    )

    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled())
    act(() => channel.emitStatus("SUBSCRIBED"))
    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    act(() =>
      channel.triggerInsert({
        id: created.id,
        recipientId: target.id,
        actorId: follower.id,
        type: NotificationType.FOLLOW,
        postId: null,
        commentId: null,
        readAt: null,
        createdAt: created.createdAt.toISOString(),
      })
    )

    await waitFor(() => expect(onInsert).toHaveBeenCalledTimes(1), { timeout: 8000 })
    const payload = onInsert.mock.calls[0][0] as NotificationView

    expect(payload.actor?.id).toBe(follower.id)
    expect(payload.recipientId).toBe(target.id)
    expect(payload.targetUrl).toBe(`/profile/${follower.id}`)

    unmount()
  })
})
