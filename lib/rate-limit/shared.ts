import { RateLimiter } from "@/lib/security"
import { getRedisClient } from "@/lib/rate-limit/redis-client"

export type RateLimitBackend = "redis" | "memory"

export interface RateLimitComputation {
  allowed: boolean
  retryAfter?: number
  backend: RateLimitBackend
  remaining: number | null
  limit: number
}

/**
 * 统一的限流执行器：优先使用 Redis，失败时回退到进程内存
 */
export async function applyDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitComputation> {
  const redisClient = getRedisClient()

  if (redisClient) {
    try {
      const count = await redisClient.incr(key)

      if (count === 1) {
        await redisClient.pexpire(key, windowMs)
      }

      let ttlMs = await redisClient.pttl(key)
      if (ttlMs < 0) {
        await redisClient.pexpire(key, windowMs)
        ttlMs = windowMs
      }

      const allowed = count <= limit
      const remaining = Math.max(limit - count, 0)
      const retryAfter = allowed || ttlMs <= 0 ? undefined : Math.max(1, Math.ceil(ttlMs / 1000))

      return {
        allowed,
        retryAfter,
        backend: "redis",
        remaining,
        limit,
      }
    } catch (error) {
      // Redis 操作失败时继续使用内存限流，不抛出异常以避免影响主流程
    }
  }

  const allowed = RateLimiter.checkRateLimit(key, limit, windowMs)
  const state = RateLimiter.getRateLimitState(key)

  let remaining: number | null = null
  let retryAfter: number | undefined

  if (state) {
    remaining = Math.max(limit - state.count, 0)
    const seconds = Math.max(0, Math.ceil((state.resetTime - Date.now()) / 1000))
    retryAfter = allowed ? undefined : Math.max(1, seconds)
  } else {
    remaining = allowed ? limit - 1 : 0
    retryAfter = allowed ? undefined : Math.max(1, Math.ceil(windowMs / 1000))
  }

  return {
    allowed,
    retryAfter,
    backend: "memory",
    remaining,
    limit,
  }
}
