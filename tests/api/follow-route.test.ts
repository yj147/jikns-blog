import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST, DELETE } from "@/app/api/users/[userId]/follow/route"
import * as interactions from "@/lib/interactions"
import * as authSession from "@/lib/auth/session"
import * as auditLog from "@/lib/audit-log"
import * as activityRateLimit from "@/lib/rate-limit/activity-limits"
import * as perfMonitor from "@/lib/performance-monitor"
import { ErrorCode } from "@/lib/api/unified-response"
import { AuthError } from "@/lib/error-handling/auth-error"

vi.mock("@/lib/interactions", async () => {
  const actual = await vi.importActual<typeof interactions>("@/lib/interactions")
  return {
    ...actual,
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  }
})

vi.mock("@/lib/auth/session", () => ({
  assertPolicy: vi.fn(),
  generateRequestId: vi.fn(() => "req-follow-test"),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

const hoistedRateLimitConfig = vi.hoisted(() => ({
  RATE_LIMITS: {
    follow: {
      windowMs: 60_000,
      maxRequests: 30,
      message: "关注操作过于频繁，请稍后再试",
    },
  },
}))

const mockRateLimits = hoistedRateLimitConfig.RATE_LIMITS

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheck: vi.fn().mockResolvedValue({
    success: true,
    remainingRequests: 1,
    backend: "memory",
  }),
  RATE_LIMITS: hoistedRateLimitConfig.RATE_LIMITS,
}))

vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    startTimer: vi.fn(),
    endTimer: vi.fn(),
    recordMetric: vi.fn(),
  },
  MetricType: {
    FOLLOW_ACTION_DURATION: "FOLLOW_ACTION_DURATION",
    FOLLOW_ACTION_RATE_LIMIT: "FOLLOW_ACTION_RATE_LIMIT",
    FEED_FOLLOWING_RESULT_COUNT: "FEED_FOLLOWING_RESULT_COUNT",
    ACTIVITY_RATE_LIMIT_CHECK: "ACTIVITY_RATE_LIMIT_CHECK",
  },
}))

const mockedInteractions = vi.mocked(interactions)
const mockedSession = vi.mocked(authSession)
const mockedAudit = vi.mocked(auditLog)
const mockedRateLimit = vi.mocked(activityRateLimit)
const mockedPerformance = vi.mocked(perfMonitor)

const mockUser = {
  id: "user-1",
  email: "user@example.com",
  status: "ACTIVE",
  role: "USER",
}

describe("/api/users/[userId]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
    mockedRateLimit.rateLimitCheck.mockResolvedValue({
      success: true,
      remainingRequests: 10,
      backend: "memory",
    } as any)
    mockedPerformance.performanceMonitor.startTimer.mockClear()
    mockedPerformance.performanceMonitor.endTimer.mockClear()
  })

  describe("POST", () => {
    it("returns success when follow created", async () => {
      mockedInteractions.followUser.mockResolvedValueOnce({
        followerId: "user-1",
        followingId: "user-2",
        createdAt: "2025-09-28T00:00:00.000Z",
        wasNew: true,
        targetName: "User Two",
      })

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "POST",
      })
      const response = await POST(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toEqual(
        expect.objectContaining({
          followerId: "user-1",
          followingId: "user-2",
          wasNew: true,
          targetName: "User Two",
          message: "已关注 User Two",
        })
      )
      expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_FOLLOW",
          success: true,
          userId: "user-1",
          resource: "user:user-2",
        })
      )
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30")
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("10")
      expect(response.headers.get("X-RateLimit-Backend")).toBe("memory")
      expect(response.headers.get("X-RateLimit-Reset")).toBeNull()
    })

    it("returns success for idempotent follow", async () => {
      mockedInteractions.followUser.mockResolvedValueOnce({
        followerId: "user-1",
        followingId: "user-2",
        createdAt: "2025-09-20T00:00:00.000Z",
        wasNew: false,
        targetName: "User Two",
      })

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "POST",
      })
      const response = await POST(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.wasNew).toBe(false)
      expect(body.data.targetName).toBe("User Two")
      expect(body.data.message).toBe("已关注 User Two")
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30")
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("10")
      expect(response.headers.get("X-RateLimit-Backend")).toBe("memory")
      expect(response.headers.get("X-RateLimit-Reset")).toBeNull()
    })

    it("returns validation error when following self", async () => {
      mockedInteractions.followUser.mockRejectedValueOnce(
        new interactions.FollowServiceError("cannot follow self", "SELF_FOLLOW")
      )

      const request = new NextRequest("http://localhost:3000/api/users/user-1/follow", {
        method: "POST",
      })
      const response = await POST(request, { params: Promise.resolve({ userId: "user-1" }) })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, action: "USER_FOLLOW" })
      )
    })

    it("returns 404 when target missing", async () => {
      mockedInteractions.followUser.mockRejectedValueOnce(
        new interactions.FollowServiceError("target missing", "TARGET_NOT_FOUND")
      )

      const request = new NextRequest("http://localhost:3000/api/users/missing/follow", {
        method: "POST",
      })
      const response = await POST(request, { params: Promise.resolve({ userId: "missing" }) })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })

    it("propagates auth errors", async () => {
      const authError = new AuthError("Unauthorized", "UNAUTHORIZED", 401)
      mockedSession.assertPolicy.mockResolvedValue([null, authError])

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "POST",
      })
      const response = await POST(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED)
      expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "USER_FOLLOW", success: false })
      )
      expect(mockedInteractions.followUser).not.toHaveBeenCalled()
    })

    it("falls back to shared rate limit config when message missing", async () => {
      mockedRateLimit.rateLimitCheck.mockResolvedValueOnce({
        success: false,
        remainingRequests: 0,
        backend: "memory",
      } as any)

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "POST",
      })

      const response = await POST(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
      expect(body.error.message).toBe(mockRateLimits.follow.message)
      expect(response.headers.get("Retry-After")).toBe(
        String(Math.ceil(mockRateLimits.follow.windowMs / 1000))
      )
      expect(response.headers.get("X-RateLimit-Limit")).toBe(
        String(mockRateLimits.follow.maxRequests)
      )
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0")
      expect(response.headers.get("X-RateLimit-Backend")).toBe("memory")
    })
  })

  describe("DELETE", () => {
    it("returns success when unfollow succeeds", async () => {
      mockedInteractions.unfollowUser.mockResolvedValueOnce({
        followerId: "user-1",
        followingId: "user-2",
        wasDeleted: true,
      })

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "DELETE",
      })
      const response = await DELETE(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.message).toBe("已取消关注")
      expect(body.data.wasDeleted).toBe(true)
      expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "USER_UNFOLLOW", success: true })
      )
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30")
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("10")
      expect(response.headers.get("X-RateLimit-Backend")).toBe("memory")
      expect(response.headers.get("X-RateLimit-Reset")).toBeNull()
    })

    it("returns success when no follow relation", async () => {
      mockedInteractions.unfollowUser.mockResolvedValueOnce({
        followerId: "user-1",
        followingId: "user-2",
        wasDeleted: false,
      })

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "DELETE",
      })
      const response = await DELETE(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.message).toBe("已取消关注")
      expect(body.data.wasDeleted).toBe(false)
      expect(mockedAudit.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "USER_UNFOLLOW", success: true })
      )
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30")
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("10")
      expect(response.headers.get("X-RateLimit-Backend")).toBe("memory")
      expect(response.headers.get("X-RateLimit-Reset")).toBeNull()
    })

    it("maps follow service errors", async () => {
      mockedInteractions.unfollowUser.mockRejectedValueOnce(
        new interactions.FollowServiceError("target missing", "TARGET_NOT_FOUND")
      )

      const request = new NextRequest("http://localhost:3000/api/users/user-2/follow", {
        method: "DELETE",
      })
      const response = await DELETE(request, { params: Promise.resolve({ userId: "user-2" }) })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND)
    })
  })
})
