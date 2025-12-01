import { randomUUID } from "node:crypto"
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { NotificationType } from "@/lib/generated/prisma"
import { ErrorCode } from "@/lib/api/unified-response"
import { realPrisma, disconnectRealDb } from "./setup-real-db"
import { TEST_USERS } from "../helpers/test-data"
import { createMockRequest } from "../helpers/test-utils"
import { GET as listNotifications, PATCH as batchMarkRead } from "@/app/api/notifications/route"
import { PATCH as markSingleRead } from "@/app/api/notifications/[id]/route"
import { assertPolicy } from "@/lib/auth/session"

vi.doUnmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session")
  return {
    ...actual,
    assertPolicy: vi.fn(),
    generateRequestId: () => "test-request-id",
  }
})

describe("通知中心 API", () => {
  let recipientId: string
  let actorId: string
  let createdUserIds: string[] = []
  let createdNotificationIds: string[] = []
  const now = Date.now()

  async function cleanupArtifacts() {
    const userIds = [...new Set(createdUserIds)]
    const notificationIds = [...new Set(createdNotificationIds)]

    if (notificationIds.length) {
      await realPrisma.notification.deleteMany({ where: { id: { in: notificationIds } } })
    }

    if (userIds.length) {
      await realPrisma.notification.deleteMany({
        where: {
          OR: [{ recipientId: { in: userIds } }, { actorId: { in: userIds } }],
        },
      })

      await realPrisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
  }

  async function createUser(id: string, email: string, name: string) {
    const record = await realPrisma.user.create({
      data: {
        id,
        email,
        name,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: new Date(now),
        updatedAt: new Date(now),
      },
    })
    createdUserIds.push(record.id)
    return record
  }

  async function createNotification(type: NotificationType, offsetMs = 0, targetRecipientId = recipientId) {
    const record = await realPrisma.notification.create({
      data: {
        id: randomUUID(),
        recipientId: targetRecipientId,
        actorId,
        type,
        createdAt: new Date(now - offsetMs),
      },
    })
    createdNotificationIds.push(record.id)
    return record.id
  }

  beforeAll(async () => {
    createdUserIds = []
    createdNotificationIds = []
  })

  afterAll(async () => {
    await cleanupArtifacts()
    await disconnectRealDb()
  })

  beforeEach(async () => {
    createdUserIds = []
    createdNotificationIds = []
    recipientId = randomUUID()
    actorId = randomUUID()
    await createUser(recipientId, `notify-${recipientId}@example.com`, "Notify Recipient")
    await createUser(actorId, `actor-${actorId}@example.com`, "Notify Actor")

    const authUser = { ...TEST_USERS.user, id: recipientId }
    vi.mocked(assertPolicy).mockResolvedValue([authUser as any, null])
  })

  afterEach(async () => {
    await cleanupArtifacts()
  })

  it("非法 type 参数应返回 400", async () => {
    const request = createMockRequest("GET", "/api/notifications", {
      searchParams: { type: "invalid" },
    })

    const response = await listNotifications(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it("limit 超出上限时应被截断并继续分页", async () => {
    const total = 60
    await Promise.all(
      Array.from({ length: total }).map((_, index) =>
        createNotification(NotificationType.LIKE, index * 10)
      )
    )

    const first = await listNotifications(
      createMockRequest("GET", "/api/notifications", { searchParams: { limit: "1001" } })
    )
    const firstPayload = await first.json()

    expect(first.status).toBe(200)
    expect(firstPayload.data.items.length).toBe(50)
    expect(firstPayload.data.pagination.hasMore).toBe(true)
    expect(firstPayload.data.pagination.nextCursor).toBeTruthy()

    const second = await listNotifications(
      createMockRequest("GET", "/api/notifications", {
        searchParams: { limit: "1001", cursor: firstPayload.data.pagination.nextCursor },
      })
    )
    const secondPayload = await second.json()

    expect(second.status).toBe(200)
    expect(secondPayload.data.items.length).toBe(total - 50)
    expect(secondPayload.data.pagination.hasMore).toBe(false)
  })

  it("空结果查询应返回空列表和零计数", async () => {
    const response = await listNotifications(createMockRequest("GET", "/api/notifications"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.items).toHaveLength(0)
    expect(payload.data.unreadCount).toBe(0)
    expect(payload.data.filteredUnreadCount).toBe(0)
  })

  it("ids 为空数组应返回 400", async () => {
    const request = createMockRequest("PATCH", "/api/notifications", { body: { ids: [] } })

    const response = await batchMarkRead(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it("用户不得标记他人通知", async () => {
    const otherRecipient = randomUUID()
    await createUser(otherRecipient, `other-${otherRecipient}@example.com`, "Other User")
    const foreignId = await createNotification(NotificationType.LIKE, 0, otherRecipient)

    const response = await batchMarkRead(
      createMockRequest("PATCH", "/api/notifications", { body: { ids: [foreignId] } })
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe(ErrorCode.FORBIDDEN)

    const record = await realPrisma.notification.findUnique({ where: { id: foreignId } })
    expect(record?.readAt).toBeNull()
  })

  it("并发标记应保持幂等", async () => {
    const id1 = await createNotification(NotificationType.LIKE)
    const id2 = await createNotification(NotificationType.COMMENT, 5)

    const [first, second] = await Promise.all([
      batchMarkRead(createMockRequest("PATCH", "/api/notifications", { body: { ids: [id1, id2] } })),
      batchMarkRead(createMockRequest("PATCH", "/api/notifications", { body: { ids: [id1, id2] } })),
    ])

    const firstPayload = await first.json()
    const secondPayload = await second.json()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(firstPayload.data.updated + secondPayload.data.updated).toBeGreaterThanOrEqual(2)

    const records = await realPrisma.notification.findMany({ where: { id: { in: [id1, id2] } } })
    expect(records.every((item) => item.readAt !== null)).toBe(true)
  })

  it("列表按类型过滤应只返回匹配通知", async () => {
    const likeId = await createNotification(NotificationType.LIKE)
    await createNotification(NotificationType.COMMENT, 10)

    const request = createMockRequest("GET", "/api/notifications", {
      searchParams: { type: "LIKE", limit: "10" },
    })

    const response = await listNotifications(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.items).toHaveLength(1)
    expect(payload.data.items[0].id).toBe(likeId)
    expect(payload.data.filteredUnreadCount).toBe(1)
    expect(payload.data.unreadCount).toBe(2)
  })

  it("单条标记已读应写入 readAt", async () => {
    const targetId = await createNotification(NotificationType.SYSTEM)
    const request = createMockRequest("PATCH", `/api/notifications/${targetId}`)

    const response = await markSingleRead(request, { params: { id: targetId } })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.updated).toBe(1)

    const record = await realPrisma.notification.findUnique({ where: { id: targetId } })
    expect(record?.readAt).not.toBeNull()
  })

  it("批量标记已读应更新多条记录", async () => {
    const id1 = await createNotification(NotificationType.LIKE)
    const id2 = await createNotification(NotificationType.COMMENT, 5)
    const id3 = await createNotification(NotificationType.FOLLOW, 10)

    const request = createMockRequest("PATCH", "/api/notifications", {
      body: { ids: [id1, id2] },
    })

    const response = await batchMarkRead(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.updated).toBe(2)

    const records = await realPrisma.notification.findMany({
      where: { id: { in: [id1, id2, id3] } },
    })

    const readCount = records.filter((item) => item.readAt !== null).length
    expect(readCount).toBe(2)
    expect(records.find((item) => item.id === id3)?.readAt).toBeNull()
  })

  it("未读数量应在标记后减少", async () => {
    const id1 = await createNotification(NotificationType.LIKE)
    await createNotification(NotificationType.COMMENT, 5)
    await createNotification(NotificationType.SYSTEM, 10)

    const first = await listNotifications(createMockRequest("GET", "/api/notifications"))
    const firstPayload = await first.json()
    expect(firstPayload.data.unreadCount).toBe(3)

    await markSingleRead(createMockRequest("PATCH", `/api/notifications/${id1}`), {
      params: { id: id1 },
    })

    const next = await listNotifications(createMockRequest("GET", "/api/notifications"))
    const nextPayload = await next.json()
    expect(nextPayload.data.unreadCount).toBe(2)
  })
})
