import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { realPrisma } from "../integration/setup-real-db"

vi.doUnmock("@/lib/prisma")
vi.doMock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

const mockGetCurrentUser = vi.fn<[], Promise<any> | any>()
const mockRateLimitCheck = vi.fn().mockResolvedValue({ success: true })

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  }
})

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheckForAction: mockRateLimitCheck,
}))

const mockAuditLogger = { logEvent: vi.fn() }

vi.mock("@/lib/audit-log", () => ({
  auditLogger: mockAuditLogger,
  getClientIP: () => "127.0.0.1",
  getClientUserAgent: () => "vitest-agent",
}))

const defaultHeaders = {
  "x-forwarded-for": "198.51.100.10",
  "user-agent": "vitest-agent",
}

const buildRequest = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(defaultHeaders)
  if (init.headers) {
    const incoming = init.headers instanceof Headers ? init.headers : new Headers(init.headers)
    incoming.forEach((value, key) => headers.set(key, value))
  }

  return new NextRequest(url, {
    ...init,
    headers,
  })
}

describe("Activity API integration", () => {
  let GET: typeof import("@/app/api/activities/route").GET
  let POST: typeof import("@/app/api/activities/route").POST
  let DELETE: typeof import("@/app/api/activities/route").DELETE

  let adminUser: Awaited<ReturnType<typeof realPrisma.user.findUniqueOrThrow>>
  let writerUser: Awaited<ReturnType<typeof realPrisma.user.findUniqueOrThrow>>
  let readerUser: Awaited<ReturnType<typeof realPrisma.user.findUniqueOrThrow>>
  let opsUser: Awaited<ReturnType<typeof realPrisma.user.findUniqueOrThrow>>
  let analystUser: Awaited<ReturnType<typeof realPrisma.user.findUniqueOrThrow>>

  const cleanupActivityIds: string[] = []
  const originalFixture = process.env.ACTIVITY_API_FIXTURE

  beforeAll(async () => {
    const routeModule = await import("@/app/api/activities/route")
    GET = routeModule.GET
    POST = routeModule.POST
    DELETE = routeModule.DELETE

    adminUser = await realPrisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } })
    writerUser = await realPrisma.user.findUniqueOrThrow({
      where: { email: "feed-writer@example.com" },
    })
    readerUser = await realPrisma.user.findUniqueOrThrow({
      where: { email: "feed-reader@example.com" },
    })
    opsUser = await realPrisma.user.findUniqueOrThrow({ where: { email: "feed-ops@example.com" } })
    analystUser = await realPrisma.user.findUniqueOrThrow({
      where: { email: "feed-analyst@example.com" },
    })

    process.env.ACTIVITY_API_FIXTURE = "disabled"
  })

  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockGetCurrentUser.mockResolvedValue(null)
    mockRateLimitCheck.mockReset()
    mockRateLimitCheck.mockResolvedValue({ success: true })
    mockAuditLogger.logEvent.mockReset()
  })

  afterEach(async () => {
    while (cleanupActivityIds.length) {
      const id = cleanupActivityIds.pop()
      if (!id) continue
      try {
        await realPrisma.activity.delete({ where: { id } })
      } catch {
        // already removed
      }
    }
  })

  afterAll(async () => {
    process.env.ACTIVITY_API_FIXTURE = originalFixture
    await realPrisma.$disconnect()
  })

  it("returns real feed data without fixture fallback", async () => {
    const response = await GET(
      buildRequest("http://localhost:3000/api/activities?limit=20", {
        headers: { "x-request-id": "integration-get" },
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(Array.isArray(payload.data)).toBe(true)
    expect(payload.data.length).toBeGreaterThan(0)
    expect(payload.meta?.filters?.source).toBeUndefined()
    expect(payload.meta?.pagination?.total).toBeGreaterThanOrEqual(payload.data.length)
    expect(payload.data.map((item: any) => item.id)).toContain("act-feed-lcp-cutover")

    expect(mockRateLimitCheck).toHaveBeenCalledWith("read", expect.any(Object))
  })

  it("requires authentication for following feed", async () => {
    const response = await GET(
      buildRequest("http://localhost:3000/api/activities?orderBy=following")
    )

    expect(response.status).toBe(401)
  })

  it("returns following feed scoped to viewer's relations", async () => {
    mockGetCurrentUser.mockResolvedValue(readerUser)

    const response = await GET(
      buildRequest("http://localhost:3000/api/activities?orderBy=following&limit=10")
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.data.length).toBeGreaterThan(0)

    const allowedAuthors = new Set([writerUser.id, opsUser.id, analystUser.id])
    expect(payload.data.every((item: any) => allowedAuthors.has(item.authorId))).toBe(true)
  })

  it("supports hasImages filter with trending ordering", async () => {
    const response = await GET(
      buildRequest("http://localhost:3000/api/activities?hasImages=true&orderBy=trending&limit=5")
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.data.length).toBeGreaterThan(0)
    expect(payload.data.every((item: any) => item.imageUrls.length > 0)).toBe(true)

    const likesCounts = payload.data.map((item: any) => item.likesCount)
    for (let i = 1; i < likesCounts.length; i += 1) {
      expect(likesCounts[i - 1]).toBeGreaterThanOrEqual(likesCounts[i])
    }
  })

  it("creates a new activity for an authenticated user", async () => {
    mockGetCurrentUser.mockResolvedValue(writerUser)

    const requestBody = {
      content: "Integration create activity #Performance",
      imageUrls: ["https://picsum.photos/seed/integration-activity/640/360"],
      isPinned: false,
    }

    const response = await POST(
      buildRequest("http://localhost:3000/api/activities", {
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: { "content-type": "application/json" },
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.success).toBe(true)
    expect(payload.data.content).toContain("Integration create activity")
    expect(payload.data.authorId).toBe(writerUser.id)

    cleanupActivityIds.push(payload.data.id)

    const record = await realPrisma.activity.findUnique({ where: { id: payload.data.id } })
    expect(record).not.toBeNull()
    expect(record?.deletedAt).toBeNull()
  })

  it("rejects creation from banned users", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...writerUser, status: "BANNED" })

    const response = await POST(
      buildRequest("http://localhost:3000/api/activities", {
        method: "POST",
        body: JSON.stringify({ content: "should fail" }),
        headers: { "content-type": "application/json" },
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe("ACCOUNT_BANNED")
  })

  it("soft deletes the author's own activity", async () => {
    const activity = await realPrisma.activity.create({
      data: {
        authorId: writerUser.id,
        content: "pending delete",
      },
    })
    cleanupActivityIds.push(activity.id)

    mockGetCurrentUser.mockResolvedValue(writerUser)

    const response = await DELETE(
      buildRequest(`http://localhost:3000/api/activities?id=${activity.id}`, {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.id).toBe(activity.id)

    const record = await realPrisma.activity.findUnique({ where: { id: activity.id } })
    expect(record?.deletedAt).not.toBeNull()
  })

  it("prevents non-admins from deleting other users' activities", async () => {
    mockGetCurrentUser.mockResolvedValue(readerUser)

    const response = await DELETE(
      buildRequest("http://localhost:3000/api/activities?id=act-feed-lcp-cutover", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload.error.code).toBe("FORBIDDEN")
  })

  it("allows admins to delete any activity", async () => {
    const activity = await realPrisma.activity.create({
      data: {
        authorId: writerUser.id,
        content: "admin delete target",
      },
    })
    cleanupActivityIds.push(activity.id)

    mockGetCurrentUser.mockResolvedValue(adminUser)

    const response = await DELETE(
      buildRequest(`http://localhost:3000/api/activities?id=${activity.id}`, {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.data.id).toBe(activity.id)

    const record = await realPrisma.activity.findUnique({ where: { id: activity.id } })
    expect(record?.deletedAt).not.toBeNull()
  })

  it("returns validation error when deleting without id", async () => {
    mockGetCurrentUser.mockResolvedValue(writerUser)

    const response = await DELETE(
      buildRequest("http://localhost:3000/api/activities", { method: "DELETE" })
    )

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error.code).toBe("VALIDATION_ERROR")
  })

  it("returns not found when deleting missing activity", async () => {
    mockGetCurrentUser.mockResolvedValue(writerUser)

    const response = await DELETE(
      buildRequest("http://localhost:3000/api/activities?id=act-non-existent", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.error.code).toBe("ACTIVITY_NOT_FOUND")
  })
})
