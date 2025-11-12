import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { checkLikeRate, loadConfig as loadLikeConfig } from "@/lib/rate-limit/like-limits"
import {
  checkBookmarkRate,
  loadConfig as loadBookmarkConfig,
} from "@/lib/rate-limit/bookmark-limits"
import { RateLimiter } from "@/lib/security"
import { getRedisClient } from "@/lib/rate-limit/redis-client"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"

vi.mock("@/lib/security", () => ({
  RateLimiter: {
    checkRateLimit: vi.fn(),
    getRateLimitState: vi.fn(),
  },
}))

vi.mock("@/lib/rate-limit/redis-client", () => ({
  getRedisClient: vi.fn(() => null),
}))

describe("Toggle rate limits (likes/bookmarks)", () => {
  const recordMetricSpy = vi.spyOn(performanceMonitor, "recordMetric")
  let memoryState: Map<string, { count: number; resetTime: number }>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-09-28T08:00:00.000Z"))
    vi.clearAllMocks()
    recordMetricSpy.mockClear()

    memoryState = new Map()

    vi.mocked(getRedisClient).mockReturnValue(null as any)

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

    process.env.LIKES_RATE_LIMIT_ENABLED = "false"
    process.env.LIKES_RATE_LIMIT_WINDOW_MS = "60000"
    process.env.LIKES_RATE_LIMIT_TOGGLE_USER = "60"
    process.env.LIKES_RATE_LIMIT_TOGGLE_IP = "120"

    process.env.BOOKMARKS_RATE_LIMIT_ENABLED = "false"
    process.env.BOOKMARKS_RATE_LIMIT_WINDOW_MS = "60000"
    process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_USER = "30"
    process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_IP = "60"
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should expose default configs", () => {
    expect(loadLikeConfig()).toEqual({
      enabled: false,
      windowMs: 60000,
      togglePerUser: 60,
      togglePerIP: 120,
    })

    expect(loadBookmarkConfig()).toEqual({
      enabled: false,
      windowMs: 60000,
      togglePerUser: 30,
      togglePerIP: 60,
    })
  })

  describe.each([
    {
      name: "Likes",
      checkFn: checkLikeRate,
      enableEnv: "LIKES_RATE_LIMIT_ENABLED",
      windowEnv: "LIKES_RATE_LIMIT_WINDOW_MS",
      userEnv: "LIKES_RATE_LIMIT_TOGGLE_USER",
      ipEnv: "LIKES_RATE_LIMIT_TOGGLE_IP",
      metricType: MetricType.LIKE_RATE_LIMIT_CHECK,
      keyPrefix: "like",
    },
    {
      name: "Bookmarks",
      checkFn: checkBookmarkRate,
      enableEnv: "BOOKMARKS_RATE_LIMIT_ENABLED",
      windowEnv: "BOOKMARKS_RATE_LIMIT_WINDOW_MS",
      userEnv: "BOOKMARKS_RATE_LIMIT_TOGGLE_USER",
      ipEnv: "BOOKMARKS_RATE_LIMIT_TOGGLE_IP",
      metricType: MetricType.BOOKMARK_RATE_LIMIT_CHECK,
      keyPrefix: "bookmark",
    },
  ])("$name rate limiter", (scenario) => {
    const makeRedisMock = () => ({
      incr: vi.fn(),
      pexpire: vi.fn(),
      pttl: vi.fn(),
    })

    const enableLimiter = () => {
      process.env[scenario.enableEnv] = "true"
      process.env[scenario.windowEnv] = "60000"
    }

    it("should bypass checks when disabled", async () => {
      const result = await scenario.checkFn({ userId: "user-1", ip: "127.0.0.1" })

      expect(result.allowed).toBe(true)
      expect(recordMetricSpy).not.toHaveBeenCalled()
      expect(RateLimiter.checkRateLimit).not.toHaveBeenCalled()
    })

    it("should use Redis backend when available", async () => {
      enableLimiter()

      const redisMock = makeRedisMock()
      redisMock.incr.mockResolvedValueOnce(1)
      redisMock.incr.mockResolvedValueOnce(1)
      redisMock.pttl.mockResolvedValueOnce(55000)
      redisMock.pttl.mockResolvedValueOnce(55000)

      vi.mocked(getRedisClient).mockReturnValue(redisMock as any)

      const result = await scenario.checkFn({ userId: "user-1", ip: "127.0.0.1" })

      expect(result.allowed).toBe(true)
      expect(redisMock.incr).toHaveBeenCalledWith(`${scenario.keyPrefix}:toggle:user:user-1`)
      expect(recordMetricSpy).toHaveBeenCalled()

      const metric = recordMetricSpy.mock.calls[0]?.[0]
      expect(metric?.type).toBe(scenario.metricType)
      expect(metric?.context?.additionalData).toMatchObject({
        backend: "redis",
        dimension: "user",
        allowed: "true",
        action: "toggle",
      })
    })

    it("should propagate retryAfter when Redis blocks", async () => {
      enableLimiter()

      const redisMock = makeRedisMock()
      redisMock.incr.mockResolvedValueOnce(999)
      redisMock.pttl.mockResolvedValueOnce(4000)

      vi.mocked(getRedisClient).mockReturnValue(redisMock as any)
      process.env[scenario.userEnv] = "998"

      const result = await scenario.checkFn({ userId: "user-9" })

      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBe(4)

      const metric = recordMetricSpy.mock.calls.at(-1)?.[0]
      expect(metric?.context?.additionalData).toMatchObject({
        backend: "redis",
        allowed: "false",
        retryAfter: 4,
      })
    })

    it("should fall back to in-memory limiter when Redis unavailable", async () => {
      enableLimiter()
      vi.mocked(getRedisClient).mockReturnValue(null as any)

      const result = await scenario.checkFn({ ip: "10.0.0.1" })

      expect(result.allowed).toBe(true)
      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        `${scenario.keyPrefix}:toggle:ip:10.0.0.1`,
        Number(process.env[scenario.ipEnv]),
        60000
      )

      const metric = recordMetricSpy.mock.calls[0]?.[0]
      expect(metric?.context?.additionalData).toMatchObject({
        backend: "memory",
        dimension: "ip",
      })
    })

    it("should block via memory backend when limit exceeded", async () => {
      enableLimiter()
      vi.mocked(getRedisClient).mockReturnValue(null as any)

      const limit = 2
      process.env[scenario.userEnv] = String(limit)

      const key = `${scenario.keyPrefix}:toggle:user:user-x`

      // prime state to simulate near limit
      for (let i = 0; i < limit; i++) {
        await scenario.checkFn({ userId: "user-x" })
      }

      const blocked = await scenario.checkFn({ userId: "user-x" })

      expect(blocked.allowed).toBe(false)
      expect(blocked.retryAfter).toBeGreaterThanOrEqual(1)

      const metric = recordMetricSpy.mock.calls.at(-1)?.[0]
      expect(metric?.context?.additionalData).toMatchObject({
        backend: "memory",
        allowed: "false",
        dimension: "user",
      })

      // cleanup state traceability
      memoryState.delete(key)
    })
  })
})
