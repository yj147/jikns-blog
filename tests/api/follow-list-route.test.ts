import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET as getFollowers } from "@/app/api/users/[userId]/followers/route"
import { GET as getFollowing } from "@/app/api/users/[userId]/following/route"
import * as interactions from "@/lib/interactions"
import * as auditLog from "@/lib/audit-log"
import * as rateLimit from "@/lib/rate-limit/activity-limits"
import * as authSession from "@/lib/auth/session"
import * as perfMonitor from "@/lib/performance-monitor"
import { ErrorCode } from "@/lib/api/unified-response"

// 使用 vi.hoisted 确保 mock 函数在正确的作用域中创建
const { userCountMock, userFindUniqueMock, followCountMock, followFindUniqueMock } = vi.hoisted(
  () => ({
    userCountMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
    followCountMock: vi.fn(),
    followFindUniqueMock: vi.fn(),
  })
)

vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      user: {
        count: userCountMock,
        findUnique: userFindUniqueMock,
      },
      follow: {
        count: followCountMock,
        findUnique: followFindUniqueMock,
      },
    },
  }
})

vi.mock("@/lib/interactions", async () => {
  const actual = await vi.importActual<typeof interactions>("@/lib/interactions")
  return {
    ...actual,
    listFollowers: vi.fn(),
    listFollowing: vi.fn(),
  }
})

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheck: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/auth/session", () => ({
  fetchAuthenticatedUser: vi.fn(),
  getOptionalViewer: vi.fn(),
  assertPolicy: vi.fn().mockResolvedValue([null, null]),
  generateRequestId: vi.fn(() => "req-test-follow-list"),
}))

vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
  },
  MetricType: {
    FEED_FOLLOWING_RESULT_COUNT: "FEED_FOLLOWING_RESULT_COUNT",
  },
}))

const mockedInteractions = vi.mocked(interactions)
const mockedAudit = vi.mocked(auditLog)
const mockedRateLimit = vi.mocked(rateLimit)
const mockedSession = vi.mocked(authSession)
const mockedPerformance = vi.mocked(perfMonitor)

describe("follow list routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.rateLimitCheck.mockResolvedValue({ success: true } as any)
    mockedPerformance.performanceMonitor.recordMetric.mockClear()
    userFindUniqueMock.mockReset().mockResolvedValue({
      id: "user-1",
      privacySettings: { profileVisibility: "public" },
    })
    followFindUniqueMock.mockReset().mockResolvedValue(null)
    userCountMock.mockReset()
    followCountMock.mockReset().mockResolvedValue(0)
  })

  it("returns followers list", async () => {
    // 重置 mock 并设置新的返回值
    followCountMock.mockReset().mockResolvedValue(12) // 粉丝总数查询
    mockedInteractions.listFollowers.mockResolvedValueOnce({
      items: [
        {
          id: "user-2",
          name: "User Two",
          avatarUrl: null,
          bio: null,
          status: "ACTIVE",
          isMutual: true,
          followedAt: "2025-09-28T00:00:00.000Z",
        },
      ],
      hasMore: false,
      nextCursor: undefined,
    })

    mockedSession.getOptionalViewer.mockResolvedValueOnce({ id: "viewer-1" } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/users/user-1/followers?page=3&limit=10&includeTotal=true"
    )
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.meta.pagination.hasMore).toBe(false)
    expect(body.meta.pagination.page).toBe(3)
    expect(body.meta.pagination.total).toBe(12)
    expect(mockedInteractions.listFollowers).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ limit: 10, offset: 20 })
    )
    expect(followCountMock).toHaveBeenCalledWith({ where: { followingId: "user-1" } })
    expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_FOLLOW_LIST_VIEW",
        success: true,
        userId: "viewer-1",
      })
    )
    expect(mockedPerformance.performanceMonitor.recordMetric).toHaveBeenCalled()
  })

  it("returns 404 when target user missing (followers)", async () => {
    userFindUniqueMock.mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost:3000/api/users/missing/followers")
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "missing" }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    expect(mockedInteractions.listFollowers).not.toHaveBeenCalled()
  })

  it("returns 422 when limit exceeds max (followers)", async () => {
    const request = new NextRequest("http://localhost:3000/api/users/user-1/followers?limit=80")
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(mockedInteractions.listFollowers).not.toHaveBeenCalled()
    expect(userCountMock).not.toHaveBeenCalled()
  })

  it("returns 400 when cursor invalid (followers)", async () => {
    followCountMock.mockResolvedValueOnce(1)
    mockedInteractions.listFollowers.mockRejectedValueOnce(
      new interactions.FollowServiceError("invalid cursor", "INVALID_CURSOR")
    )

    const request = new NextRequest(
      "http://localhost:3000/api/users/user-1/followers?cursor=YmFkLWNhcnNvcg=="
    )
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(mockedInteractions.listFollowers).toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mockedRateLimit.rateLimitCheck.mockResolvedValueOnce({
      success: false,
      message: "too many",
    } as any)

    const request = new NextRequest("http://localhost:3000/api/users/user-1/followers")
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
  })

  it("returns following list", async () => {
    // 重置 mock 并设置新的返回值
    followCountMock.mockReset().mockResolvedValue(8) // 关注总数查询
    mockedInteractions.listFollowing.mockResolvedValueOnce({
      items: [
        {
          id: "user-3",
          name: "User Three",
          avatarUrl: null,
          bio: null,
          status: "ACTIVE",
          isMutual: false,
          followedAt: "2025-09-28T02:00:00.000Z",
        },
      ],
      hasMore: true,
      nextCursor: "user-9",
    })

    const request = new NextRequest(
      "http://localhost:3000/api/users/user-1/following?page=2&limit=5&includeTotal=true"
    )
    const response = await getFollowing(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.meta.pagination.page).toBe(2)
    expect(body.meta.pagination.nextCursor).toBe("user-9") // 修复：应该返回 mock 的 nextCursor
    expect(body.meta.pagination.total).toBe(8)
    expect(followCountMock).toHaveBeenCalledWith({ where: { followerId: "user-1" } })
    expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_FOLLOW_LIST_VIEW",
        success: true,
      })
    )
    expect(mockedInteractions.listFollowing).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ limit: 5, offset: 5 })
    )
  })

  it("returns 404 when target user missing (following)", async () => {
    userFindUniqueMock.mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost:3000/api/users/missing/following")
    const response = await getFollowing(request, { params: Promise.resolve({ userId: "missing" }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    expect(mockedInteractions.listFollowing).not.toHaveBeenCalled()
  })

  it("returns 422 when limit exceeds max (following)", async () => {
    const request = new NextRequest("http://localhost:3000/api/users/user-1/following?limit=75")
    const response = await getFollowing(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(mockedInteractions.listFollowing).not.toHaveBeenCalled()
    expect(userCountMock).not.toHaveBeenCalled()
  })

  it("returns 400 when cursor invalid (following)", async () => {
    followCountMock.mockResolvedValueOnce(1)
    mockedInteractions.listFollowing.mockRejectedValueOnce(
      new interactions.FollowServiceError("invalid cursor", "INVALID_CURSOR")
    )

    const request = new NextRequest(
      "http://localhost:3000/api/users/user-1/following?cursor=aW52YWxpZC1iYXNlNjQ="
    )
    const response = await getFollowing(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(mockedInteractions.listFollowing).toHaveBeenCalled()
  })

  it("skips total count when includeTotal=false", async () => {
    userCountMock.mockReset().mockResolvedValue(1)
    followCountMock.mockReset()
    mockedInteractions.listFollowers.mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    })

    const request = new NextRequest(
      "http://localhost:3000/api/users/user-1/followers?includeTotal=false"
    )
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.meta.pagination.total).toBeNull()
    expect(followCountMock).not.toHaveBeenCalled()
    expect(mockedInteractions.listFollowers).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ limit: 20 })
    )
  })

  it("returns total when includeTotal is omitted", async () => {
    followCountMock.mockReset().mockResolvedValue(7)
    mockedInteractions.listFollowers.mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    })

    const request = new NextRequest("http://localhost:3000/api/users/user-1/followers")
    const response = await getFollowers(request, { params: Promise.resolve({ userId: "user-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.meta.pagination.total).toBe(7)
    expect(followCountMock).toHaveBeenCalledWith({ where: { followingId: "user-1" } })
  })

  it("blocks followers-only list for non-follower", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "target-followers",
      privacySettings: { profileVisibility: "followers" },
    })
    mockedSession.getOptionalViewer.mockResolvedValueOnce({
      id: "viewer-not-follower",
      role: "USER",
      status: "ACTIVE",
    } as any)

    const request = new NextRequest("http://localhost:3000/api/users/target-followers/followers")
    const response = await getFollowers(request, {
      params: Promise.resolve({ userId: "target-followers" }),
    })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe(ErrorCode.FORBIDDEN)
    expect(mockedInteractions.listFollowers).not.toHaveBeenCalled()
  })

  it("allows followers-only list for follower", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "target-followers",
      privacySettings: { profileVisibility: "followers" },
    })
    mockedSession.getOptionalViewer.mockResolvedValueOnce({
      id: "viewer-follower",
      role: "USER",
      status: "ACTIVE",
    } as any)
    followFindUniqueMock.mockResolvedValueOnce({ followerId: "viewer-follower" } as any)
    mockedInteractions.listFollowers.mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    })

    const request = new NextRequest("http://localhost:3000/api/users/target-followers/followers")
    const response = await getFollowers(request, {
      params: Promise.resolve({ userId: "target-followers" }),
    })

    expect(response.status).toBe(200)
    expect(mockedInteractions.listFollowers).toHaveBeenCalled()
  })

  it("normalizes followers_only visibility alias", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "target-followers-alias",
      privacySettings: { profileVisibility: "followers_only" },
    })
    mockedSession.getOptionalViewer.mockResolvedValueOnce({
      id: "viewer-follower",
      role: "USER",
      status: "ACTIVE",
    } as any)
    followFindUniqueMock.mockResolvedValueOnce({ followerId: "viewer-follower" } as any)
    mockedInteractions.listFollowers.mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    })

    const request = new NextRequest(
      "http://localhost:3000/api/users/target-followers-alias/followers"
    )
    const response = await getFollowers(request, {
      params: Promise.resolve({ userId: "target-followers-alias" }),
    })

    expect(response.status).toBe(200)
  })

  it("blocks private list for non-owner", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "target-private",
      privacySettings: { profileVisibility: "private" },
    })
    mockedSession.getOptionalViewer.mockResolvedValueOnce({
      id: "other-user",
      role: "USER",
      status: "ACTIVE",
    } as any)

    const request = new NextRequest("http://localhost:3000/api/users/target-private/following")
    const response = await getFollowing(request, {
      params: Promise.resolve({ userId: "target-private" }),
    })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe(ErrorCode.FORBIDDEN)
    expect(mockedInteractions.listFollowing).not.toHaveBeenCalled()
  })

  it("allows private list for owner", async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: "target-private",
      privacySettings: { profileVisibility: "private" },
    })
    mockedSession.getOptionalViewer.mockResolvedValueOnce({
      id: "target-private",
      role: "USER",
      status: "ACTIVE",
    } as any)
    mockedInteractions.listFollowing.mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    })

    const request = new NextRequest("http://localhost:3000/api/users/target-private/following")
    const response = await getFollowing(request, {
      params: Promise.resolve({ userId: "target-private" }),
    })

    expect(response.status).toBe(200)
    expect(mockedInteractions.listFollowing).toHaveBeenCalled()
  })
})
