import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  realPrisma,
  cleanupTestData,
  createTestUser,
  createTestActivity,
  createTestLike,
} from "./setup-real-db"

vi.doUnmock("@/lib/prisma")
vi.doMock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

const mockGetCurrentUser = vi.fn()
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockAuditLogger = { logEvent: vi.fn().mockResolvedValue(undefined) }

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  }
})

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheckForAction: mockRateLimit,
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: mockAuditLogger,
  getClientIP: () => "127.0.0.1",
  getClientUserAgent: () => "vitest-agent",
}))

describe("Likes consistency integration", () => {
  let DELETE: typeof import("@/app/api/activities/route").DELETE
  let dbAvailable = true

  beforeAll(async () => {
    try {
      await realPrisma.$connect()
    } catch {
      dbAvailable = false
      return
    }
    const routes = await import("@/app/api/activities/route")
    DELETE = routes.DELETE
  })

  beforeEach(async () => {
    if (!dbAvailable) return
    await cleanupTestData()
    mockGetCurrentUser.mockReset()
    mockRateLimit.mockReset()
    mockRateLimit.mockResolvedValue({ success: true })
  })

  afterAll(async () => {
    if (dbAvailable) {
      await cleanupTestData()
      await realPrisma.$disconnect().catch(() => {})
    }
  })

  it("删除动态时应级联清理点赞并重置 likesCount", async () => {
    if (!dbAvailable) return
    const author = await createTestUser({ email: "likes-author@example.com" })
    const liker = await createTestUser({ email: "likes-liker@example.com" })
    const anotherLiker = await createTestUser({ email: "likes-liker-2@example.com" })

    const activity = await createTestActivity({ authorId: author.id })

    await createTestLike({ authorId: liker.id, activityId: activity.id })
    await createTestLike({ authorId: anotherLiker.id, activityId: activity.id })

    mockGetCurrentUser.mockResolvedValue(author)

    const request = new NextRequest(`http://localhost:3000/api/activities?id=${activity.id}`, {
      method: "DELETE",
    })

    const response = await DELETE(request)
    expect(response.status).toBe(200)

    const likesAfterDelete = await realPrisma.like.count({
      where: { activityId: activity.id },
    })
    expect(likesAfterDelete).toBe(0)

    const deletedActivity = await realPrisma.activity.findUnique({
      where: { id: activity.id },
    })

    expect(deletedActivity?.deletedAt).not.toBeNull()
    expect(deletedActivity?.likesCount).toBe(0)
  })
})
