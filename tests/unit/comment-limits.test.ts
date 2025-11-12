/**
 * 评论限流模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { checkCommentRate, extractClientIP, loadConfig } from "@/lib/rate-limit/comment-limits"
import { RateLimiter } from "@/lib/security"
import { getRedisClient } from "@/lib/rate-limit/redis-client"
import { performanceMonitor } from "@/lib/performance-monitor"

// Mock RateLimiter
vi.mock("@/lib/security", () => ({
  RateLimiter: {
    checkRateLimit: vi.fn(),
    getRateLimitState: vi.fn(),
  },
}))

vi.mock("@/lib/rate-limit/redis-client", () => ({
  getRedisClient: vi.fn(() => null),
}))

describe("Comment Rate Limiting", () => {
  const recordMetricSpy = vi.spyOn(performanceMonitor, "recordMetric")
  let memoryState: Map<string, { count: number; resetTime: number }>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-09-27T00:00:00.000Z"))
    vi.clearAllMocks()
    recordMetricSpy.mockClear()

    vi.mocked(getRedisClient).mockReturnValue(null as any)
    memoryState = new Map()

    vi.mocked(RateLimiter.checkRateLimit).mockImplementation(
      (identifier: string, limit: number = 100, windowMs: number = 60_000) => {
        const now = Date.now()
        const record = memoryState.get(identifier)

        if (!record || now > record.resetTime) {
          memoryState.set(identifier, {
            count: 1,
            resetTime: now + windowMs,
          })
          return true
        }

        if (record.count >= limit) {
          return false
        }

        record.count += 1
        return true
      }
    )

    vi.mocked(RateLimiter.getRateLimitState).mockImplementation((identifier: string) => {
      const record = memoryState.get(identifier)
      if (!record) {
        return null
      }
      return { count: record.count, resetTime: record.resetTime }
    })

    // Reset environment variables
    process.env.COMMENTS_RATE_LIMIT_ENABLED = "false"
    process.env.COMMENTS_RATE_LIMIT_WINDOW_MS = "60000"
    process.env.COMMENTS_RATE_LIMIT_CREATE_USER = "20"
    process.env.COMMENTS_RATE_LIMIT_CREATE_IP = "60"
    process.env.COMMENTS_RATE_LIMIT_DELETE_USER = "10"
    process.env.COMMENTS_RATE_LIMIT_DELETE_IP = "30"
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const primeLimit = (identifier: string, count: number, windowMs: number) => {
    memoryState.set(identifier, {
      count,
      resetTime: Date.now() + windowMs,
    })
  }

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
      expect(recordMetricSpy).not.toHaveBeenCalled()
    })

    it("should check user rate limit for create action", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"

      await checkCommentRate({ userId: "user1", action: "create" })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:user:user1",
        20,
        60000
      )
      expect(recordMetricSpy).toHaveBeenCalledTimes(1)
      const metric = recordMetricSpy.mock.calls[0]?.[0]
      expect(metric?.context?.additionalData).toMatchObject({
        action: "create",
        dimension: "user",
        backend: "memory",
        allowed: "true",
      })
    })

    it("should check IP rate limit for create action", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"

      await checkCommentRate({ ip: "192.168.1.1", action: "create" })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:create:ip:192.168.1.1",
        60,
        60000
      )
      expect(recordMetricSpy).toHaveBeenCalledTimes(1)
      const metric = recordMetricSpy.mock.calls[0]?.[0]
      expect(metric?.context?.additionalData?.dimension).toBe("ip")
    })

    it("should check both user and IP limits when both provided", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"

      await checkCommentRate({ userId: "user1", ip: "192.168.1.1", action: "create" })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledTimes(2)
      expect(recordMetricSpy).toHaveBeenCalledTimes(2)
    })

    it("should return not allowed when user limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      primeLimit("comment:create:user:user1", 20, 60000)

      const result = await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "create",
      })

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(60)
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledTimes(1)
      const metric = recordMetricSpy.mock.calls[0]?.[0]
      expect(metric?.context?.additionalData).toMatchObject({ allowed: "false", dimension: "user" })
    })

    it("should return not allowed when IP limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      primeLimit("comment:create:ip:192.168.1.1", 60, 60000)

      const result = await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "create",
      })

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(60)
    })

    it("should use redis when client is available", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      const incr = vi.fn().mockResolvedValue(1)
      const pexpire = vi.fn().mockResolvedValue("OK")
      const pttl = vi.fn().mockResolvedValue(60000)

      vi.mocked(getRedisClient).mockReturnValue({ incr, pexpire, pttl } as any)

      const result = await checkCommentRate({ userId: "user1", action: "create" })

      expect(result.allowed).toBe(true)
      expect(incr).toHaveBeenCalledWith("comment:create:user:user1")
      expect(RateLimiter.checkRateLimit).not.toHaveBeenCalled()
      const metric = recordMetricSpy.mock.calls[0]?.[0]
      expect(metric?.context?.additionalData?.backend).toBe("redis")
      expect(metric?.context?.additionalData?.remaining).toBe(19)
    })

    it("should return redis ttl when limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      const incr = vi.fn().mockResolvedValue(21)
      const pexpire = vi.fn().mockResolvedValue("OK")
      const pttl = vi.fn().mockResolvedValue(4500)

      vi.mocked(getRedisClient).mockReturnValue({ incr, pexpire, pttl } as any)

      const result = await checkCommentRate({ userId: "user1", action: "create" })

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(5)
    })

    it("should use delete action limits correctly", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"

      await checkCommentRate({
        userId: "user1",
        ip: "192.168.1.1",
        action: "delete",
      })

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:delete:user:user1",
        10,
        60000
      )
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "comment:delete:ip:192.168.1.1",
        30,
        60000
      )
    })

    it("should handle window restoration after limit exceeded", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
      primeLimit("comment:create:user:user1", 20, 60000)

      const result1 = await checkCommentRate({ userId: "user1", action: "create" })
      expect(result1.allowed).toBe(false)

      memoryState.clear()

      const result2 = await checkCommentRate({ userId: "user1", action: "create" })
      expect(result2.allowed).toBe(true)
    })
  })

  describe("Rate limit dimensions", () => {
    beforeEach(() => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
    })

    it("should handle per-user dimension correctly", async () => {
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
