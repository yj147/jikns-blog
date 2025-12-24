import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  realPrisma,
  cleanupTestData,
  createTestUser,
  createTestPost,
  createTestActivity,
} from "./setup-real-db"

vi.doUnmock("@/lib/prisma")
vi.doMock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

const mockAssertPolicy = vi.fn()
const mockGenerateRequestId = vi.fn(() => "req-integration-like")
const mockCheckRate = vi.fn().mockResolvedValue({ allowed: true })
const mockAuditLogger = { logEvent: vi.fn().mockResolvedValue(undefined) }

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session")
  return {
    ...actual,
    assertPolicy: mockAssertPolicy,
    generateRequestId: mockGenerateRequestId,
    fetchAuthenticatedUser: vi.fn(),
  }
})

vi.mock("@/lib/rate-limit/like-limits", () => ({
  checkLikeRate: mockCheckRate,
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: mockAuditLogger,
  getClientIP: () => "127.0.0.1",
  getClientUserAgent: () => "vitest-agent",
}))

const defaultHeaders = {
  "content-type": "application/json",
  "x-forwarded-for": "198.51.100.10",
  "user-agent": "vitest-agent",
}

const buildRequest = (url: string, body: any) =>
  new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: defaultHeaders })

describe("Integration | likes flow", () => {
  let POST: typeof import("@/app/api/likes/route").POST
  let dbAvailable = true

  beforeAll(async () => {
    try {
      await realPrisma.$connect()
    } catch {
      dbAvailable = false
      return
    }
    const route = await import("@/app/api/likes/route")
    POST = route.POST
  })

  beforeEach(async () => {
    if (!dbAvailable) return
    await cleanupTestData()
    mockAssertPolicy.mockReset()
    mockAssertPolicy.mockResolvedValue([
      { id: "user-active", email: "user@example.com", role: "USER", status: "ACTIVE" },
      null,
    ])
    mockAuditLogger.logEvent.mockClear()
    mockCheckRate.mockClear()
    mockCheckRate.mockResolvedValue({ allowed: true })
  })

  afterAll(async () => {
    if (dbAvailable) {
      await cleanupTestData()
      await realPrisma.$disconnect().catch(() => {})
    }
  })

  it("likes and unlikes post idempotently", async () => {
    if (!dbAvailable) return
    const author = await createTestUser({ email: "author@example.com" })
    const actor = await createTestUser({ id: "user-active", email: "actor@example.com" })
    const post = await createTestPost({ authorId: author.id })

    const likeReq = buildRequest("http://localhost:3000/api/likes", {
      targetType: "post",
      targetId: post.id,
    })

    let res = await POST(likeReq)
    let data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ isLiked: true, count: 1 })

    // toggle again -> unlike
    res = await POST(likeReq)
    data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ isLiked: false, count: 0 })

    // like again
    res = await POST(likeReq)
    data = await res.json()
    expect(res.status).toBe(200)
    expect(data.data).toMatchObject({ isLiked: true, count: 1 })

    const dbCount = await realPrisma.like.count({ where: { postId: post.id } })
    expect(dbCount).toBe(1)
  })

  it("prevents self-like on activity", async () => {
    if (!dbAvailable) return
    const user = await createTestUser({ id: "user-active", email: "self@example.com" })
    const activity = await createTestActivity({ authorId: user.id })

    const req = buildRequest("http://localhost:3000/api/likes", {
      targetType: "activity",
      targetId: activity.id,
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("rejects liking deleted activity", async () => {
    if (!dbAvailable) return
    const user = await createTestUser({ id: "user-active", email: "viewer@example.com" })
    const author = await createTestUser({ email: "deleted-author@example.com" })
    const activity = await createTestActivity({ authorId: author.id })

    await realPrisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    })

    const req = buildRequest("http://localhost:3000/api/likes", {
      targetType: "activity",
      targetId: activity.id,
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("rejects liking banned author's activity", async () => {
    if (!dbAvailable) return
    const user = await createTestUser({ id: "user-active", email: "viewer@example.com" })
    const bannedAuthor = await createTestUser({
      email: "banned@example.com",
      status: "BANNED" as const,
    })
    const activity = await createTestActivity({ authorId: bannedAuthor.id })

    const req = buildRequest("http://localhost:3000/api/likes", {
      targetType: "activity",
      targetId: activity.id,
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error.code).toBe("FORBIDDEN")
  })
})
