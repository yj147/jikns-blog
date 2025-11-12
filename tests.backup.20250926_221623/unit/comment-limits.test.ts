/**
 * 评论限流模块单元测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { checkCommentRate, extractClientIP, loadConfig } from "@/lib/rate-limit/comment-limits"
import { RateLimiter } from "@/lib/security"

// Mock RateLimiter
vi.mock("@/lib/security", () => ({
  RateLimiter: {
    checkRateLimit: vi.fn(),
  },
}))

describe("Comment Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    process.env.COMMENTS_RATE_LIMIT_ENABLED = "false"
    process.env.COMMENTS_RATE_LIMIT_WINDOW_MS = "60000"
    process.env.COMMENTS_RATE_LIMIT_CREATE_USER = "20"
    process.env.COMMENTS_RATE_LIMIT_CREATE_IP = "60"
    process.env.COMMENTS_RATE_LIMIT_DELETE_USER = "10"
    process.env.COMMENTS_RATE_LIMIT_DELETE_IP = "30"
  })

  describe("loadConfig", () => {
    it("should load default configuration", () => {
      const config = loadConfig()

      expect(config).toEqual({
        enabled: false,
        windowMs: 60000,
        createPerUser: 20,
        createPerIP: 60,
        deletePerUser: 10,
        deletePerIP: 30,
      })
    })

    it("should load custom configuration from environment", () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      process.env.COMMENTS_RATE_LIMIT_WINDOW_MS = "30000"
      process.env.COMMENTS_RATE_LIMIT_CREATE_USER = "5"

      const config = loadConfig()

      expect(config.enabled).toBe(true)
      expect(config.windowMs).toBe(30000)
      expect(config.createPerUser).toBe(5)
    })
  })

  describe("extractClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const headers = new Headers({
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      })

      const ip = extractClientIP(headers)
      expect(ip).toBe("192.168.1.1")
    })

    it("should extract IP from x-real-ip header", () => {
      const headers = new Headers({
        "x-real-ip": "192.168.1.2",
      })

      const ip = extractClientIP(headers)
      expect(ip).toBe("192.168.1.2")
    })

    it("should prefer x-forwarded-for over x-real-ip", () => {
      const headers = new Headers({
        "x-forwarded-for": "192.168.1.1",
        "x-real-ip": "192.168.1.2",
      })

      const ip = extractClientIP(headers)
      expect(ip).toBe("192.168.1.1")
    })

    it("should return undefined if no IP headers present", () => {
      const headers = new Headers()

      const ip = extractClientIP(headers)
      expect(ip).toBeUndefined()
    })
  })

  describe("checkCommentRate", () => {
    it("should allow all operations when rate limiting is disabled", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "false"

      const result = await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "create",
      })

      expect(result.allowed).toBe(true)
      expect(RateLimiter.checkRateLimit).not.toHaveBeenCalled()
    })

    it("should check user rate limit for create action", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)

      await checkCommentRate({
        userId: "user1",
        action: "create",
      })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:user:user1",
        20,
        60000
      )
    })

    it("should check IP rate limit for create action", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)

      await checkCommentRate({
        ip: "192.168.1.1",
        action: "create",
      })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:ip:192.168.1.1",
        60,
        60000
      )
    })

    it("should check both user and IP limits when both provided", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)

      await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "create",
      })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledTimes(2)
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:user:user1",
        20,
        60000
      )
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:ip:192.168.1.1",
        60,
        60000
      )
    })

    it("should return not allowed when user limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValueOnce(false)

      const result = await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "create",
      })

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(60) // windowMs / 1000
      // Should stop after first rejection, not check IP
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledTimes(1)
    })

    it("should return not allowed when IP limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      vi.mocked(RateLimiter.checkRateLimit)
        .mockReturnValueOnce(true) // User check passes
        .mockReturnValueOnce(false) // IP check fails

      const result = await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "create",
      })

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(60) // windowMs / 1000
    })

    it("should use delete action limits correctly", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)

      await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "delete",
      })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:delete:user:user1",
        10, // Delete user limit
        60000
      )
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:delete:ip:192.168.1.1",
        30, // Delete IP limit
        60000
      )
    })

    it("should handle window restoration after limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"

      // First call - limit exceeded
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValueOnce(false)

      const result1 = await checkCommentRate({
        userId: "user1",
        action: "create",
      })

      expect(result1.allowed).toBe(false)

      // Second call - window restored
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValueOnce(true)

      const result2 = await checkCommentRate({
        userId: "user1",
        action: "create",
      })

      expect(result2.allowed).toBe(true)
    })
  })

  describe("Rate limit dimensions", () => {
    beforeEach(() => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
    })

    it("should handle per-user dimension correctly", async () => {
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)

      // Multiple users should have separate limits
      await checkCommentRate({ userId: "user1", action: "create" })
      await checkCommentRate({ userId: "user2", action: "create" })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:user:user1",
        20,
        60000
      )
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:user:user2",
        20,
        60000
      )
    })

    it("should handle per-IP dimension correctly", async () => {
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)

      // Multiple IPs should have separate limits
      await checkCommentRate({ ip: "192.168.1.1", action: "create" })
      await checkCommentRate({ ip: "192.168.1.2", action: "create" })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:ip:192.168.1.1",
        60,
        60000
      )
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:ip:192.168.1.2",
        60,
        60000
      )
    })
  })
})
