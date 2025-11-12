import { describe, it, expect, vi, beforeEach } from "vitest"
import { followUserAction, unfollowUserAction, toggleFollowAction } from "@/lib/actions/follow"
import { assertPolicy } from "@/lib/auth/session"
import { rateLimitCheckForAction } from "@/lib/rate-limit/activity-limits"
import { followUser, unfollowUser, getFollowStatus } from "@/lib/interactions/follow"

// Mock 依赖
vi.mock("@/lib/auth/session", () => ({
  assertPolicy: vi.fn(),
  generateRequestId: vi.fn(() => "test-request-id"),
}))

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheckForAction: vi.fn(),
  RATE_LIMITS: {
    "follow-action": {
      maxRequests: 10,
      windowMs: 60000,
    },
  },
}))

vi.mock("@/lib/interactions/follow", () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  getFollowStatus: vi.fn(),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: {
    logEvent: vi.fn(),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "test-agent"),
}))

vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  },
  MetricType: {
    FOLLOW_SUCCESS: "FOLLOW_SUCCESS",
    FOLLOW_FAILURE: "FOLLOW_FAILURE",
  },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn(() => "127.0.0.1"),
  })),
}))

describe("Follow Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("followUserAction", () => {
    it("未登录用户调用 → 返回 UNAUTHORIZED", async () => {
      // Mock 未登录场景
      vi.mocked(assertPolicy).mockResolvedValue([
        null,
        { code: "UNAUTHORIZED", message: "未登录", statusCode: 401 },
      ])

      const result = await followUserAction("target-user-id")

      expect(result).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "未登录",
        },
      })
    })

    it("超过速率限制 → 返回 RATE_LIMIT_EXCEEDED 且 retryAfter ≥ 1", async () => {
      // Mock 已登录用户
      vi.mocked(assertPolicy).mockResolvedValue([
        { id: "user-123", role: "USER", status: "ACTIVE" },
        null,
      ])

      // Mock 限流失败，resetTime 早于当前时间（测试 Math.max(1, ...) 逻辑）
      const pastResetTime = new Date(Date.now() - 5000) // 5 秒前
      vi.mocked(rateLimitCheckForAction).mockResolvedValue({
        success: false,
        message: "操作过于频繁",
        resetTime: pastResetTime,
      })

      const result = await followUserAction("target-user-id")

      expect(result).toEqual({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "操作过于频繁",
          retryAfter: expect.any(Number),
        },
      })

      // 验证 retryAfter 永远 ≥ 1（即使 resetTime 早于当前时间）
      expect(result.error?.retryAfter).toBeGreaterThanOrEqual(1)
    })

    it("成功关注 → 返回 { success: true, data: { isFollowing: true } }", async () => {
      // Mock 已登录用户
      vi.mocked(assertPolicy).mockResolvedValue([
        { id: "user-123", role: "USER", status: "ACTIVE" },
        null,
      ])

      // Mock 限流通过
      vi.mocked(rateLimitCheckForAction).mockResolvedValue({
        success: true,
      })

      // Mock 关注成功
      const followResult = {
        followerId: "user-123",
        followingId: "target-user-id",
        createdAt: new Date().toISOString(),
        wasNew: true,
        targetName: "目标用户",
      }
      vi.mocked(followUser).mockResolvedValue({
        ...followResult,
      })

      const result = await followUserAction("target-user-id")

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(followResult)
        expect(result.message).toBeDefined()
      }

      // 验证调用了 followUser
      expect(followUser).toHaveBeenCalledWith("user-123", "target-user-id")
    })
  })

  describe("unfollowUserAction", () => {
    it("未登录用户调用 → 返回 UNAUTHORIZED", async () => {
      vi.mocked(assertPolicy).mockResolvedValue([
        null,
        { code: "UNAUTHORIZED", message: "未登录", statusCode: 401 },
      ])

      const result = await unfollowUserAction("target-user-id")

      expect(result).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "未登录",
        },
      })
    })

    it("成功取消关注 → 返回 { success: true, data: { isFollowing: false } }", async () => {
      vi.mocked(assertPolicy).mockResolvedValue([
        { id: "user-123", role: "USER", status: "ACTIVE" },
        null,
      ])

      vi.mocked(rateLimitCheckForAction).mockResolvedValue({
        success: true,
      })

      const unfollowResult = {
        followerId: "user-123",
        followingId: "target-user-id",
        wasDeleted: true,
      }
      vi.mocked(unfollowUser).mockResolvedValue({
        ...unfollowResult,
      })

      const result = await unfollowUserAction("target-user-id")

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(unfollowResult)
        expect(result.message).toBeDefined()
      }

      expect(unfollowUser).toHaveBeenCalledWith("user-123", "target-user-id")
    })
  })

  describe("toggleFollowAction", () => {
    it("shouldFollow=true → 关注成功", async () => {
      vi.mocked(assertPolicy).mockResolvedValue([
        { id: "user-123", role: "USER", status: "ACTIVE" },
        null,
      ])

      vi.mocked(rateLimitCheckForAction).mockResolvedValue({
        success: true,
      })

      // Mock 关注成功
      const followResult = {
        followerId: "user-123",
        followingId: "target-user-id",
        createdAt: new Date().toISOString(),
        wasNew: true,
        targetName: "目标用户",
      }
      vi.mocked(followUser).mockResolvedValue({
        ...followResult,
      })

      const result = await toggleFollowAction("target-user-id", true)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(followResult)
        expect(result.message).toBeDefined()
      }

      expect(followUser).toHaveBeenCalledWith("user-123", "target-user-id")
    })

    it("shouldFollow=false → 取消关注成功", async () => {
      vi.mocked(assertPolicy).mockResolvedValue([
        { id: "user-123", role: "USER", status: "ACTIVE" },
        null,
      ])

      vi.mocked(rateLimitCheckForAction).mockResolvedValue({
        success: true,
      })

      // Mock 取消关注成功
      const unfollowResult = {
        followerId: "user-123",
        followingId: "target-user-id",
        wasDeleted: true,
      }
      vi.mocked(unfollowUser).mockResolvedValue({
        ...unfollowResult,
      })

      const result = await toggleFollowAction("target-user-id", false)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(unfollowResult)
        expect(result.message).toBeDefined()
      }

      expect(unfollowUser).toHaveBeenCalledWith("user-123", "target-user-id")
    })
  })
})
