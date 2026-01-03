import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getRedisClient } from "@/lib/rate-limit/redis-client"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { getClientIP } from "@/lib/utils/client-ip"
import { logger } from "@/lib/utils/logger"

/**
 * Activity 模块速率限制配置和实现
 * 支持 Redis 集中存储与内存回退
 */

// 速率限制配置
export const RATE_LIMITS = {
  create: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: "发布动态过于频繁，请稍后再试",
  },
  update: {
    windowMs: 5 * 60 * 1000,
    maxRequests: 20,
    message: "更新动态过于频繁，请稍后再试",
  },
  delete: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 15,
    message: "删除动态过于频繁，请稍后再试",
  },
  read: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: "访问过于频繁，请稍后再试",
  },
  like: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: "点赞过于频繁，请稍后再试",
  },
  upload: {
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    message: "上传图片过于频繁，请稍后再试",
  },
  follow: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: "关注操作过于频繁，请稍后再试",
  },
  "follow-status": {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: "关注状态查询过于频繁，请稍后再试",
  },
} as const

export type RateLimitType = keyof typeof RATE_LIMITS
export type RateLimitBackend = "redis" | "memory"

export interface RateLimitResult {
  success: boolean
  remainingRequests?: number
  resetTime?: Date
  message?: string
  backend?: RateLimitBackend
}

interface RateLimitRecord {
  count: number
  windowStart: number
  lastRequest: number
}

interface RateLimitComputation {
  backend: RateLimitBackend
  count: number
  remaining: number
  resetTime: Date
  success: boolean
}

interface RateLimitSnapshot {
  backend: RateLimitBackend
  count: number
  resetTime: Date
}

const redisClient = getRedisClient()
const rateLimitStore = new Map<string, RateLimitRecord>()
let didWarnRedisRateLimitFallback = false

const REDIS_RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = ARGV[1]
end
return {count, ttl}
`

if (!redisClient) {
  const CLEANUP_INTERVAL = 5 * 60 * 1000
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      const maxWindow = Math.max(...Object.values(RATE_LIMITS).map((l) => l.windowMs))
      if (now - record.windowStart > maxWindow * 2) {
        rateLimitStore.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)
}

function generateRateLimitKey(userId: string | null, ip: string, type: RateLimitType): string {
  const identifier = userId || ip
  return `activity:${type}:${identifier}`
}

async function applyRateLimit(
  key: string,
  config: (typeof RATE_LIMITS)[RateLimitType]
): Promise<RateLimitComputation> {
  const now = Date.now()

  if (redisClient) {
    try {
      const raw = await redisClient.eval(REDIS_RATE_LIMIT_SCRIPT, [key], [String(config.windowMs)])
      const result = Array.isArray(raw) ? raw : []
      const parsedCount = Number(result[0] ?? 0)
      const parsedTtlMs = Number(result[1] ?? config.windowMs)

      const count = Number.isFinite(parsedCount) ? parsedCount : 0
      const normalizedTtlMs =
        Number.isFinite(parsedTtlMs) && parsedTtlMs > 0 ? parsedTtlMs : config.windowMs

      const resetTime = new Date(now + normalizedTtlMs)
      const remaining = Math.max(config.maxRequests - count, 0)

      return {
        backend: "redis",
        count,
        remaining,
        resetTime,
        success: count <= config.maxRequests,
      }
    } catch (error) {
      if (!didWarnRedisRateLimitFallback) {
        didWarnRedisRateLimitFallback = true
        logger.warn("Redis 限流脚本执行失败，回退到多次调用/内存限流", {
          error: error instanceof Error ? error.message : String(error),
        })
      }

      try {
        const count = await redisClient.incr(key)
        if (count === 1) {
          await redisClient.pexpire(key, config.windowMs)
        }

        let ttlMs = await redisClient.pttl(key)
        if (ttlMs < 0) {
          await redisClient.pexpire(key, config.windowMs)
          ttlMs = config.windowMs
        }

        const resetTime = new Date(now + ttlMs)
        const remaining = Math.max(config.maxRequests - count, 0)

        return {
          backend: "redis",
          count,
          remaining,
          resetTime,
          success: count <= config.maxRequests,
        }
      } catch {
        // Redis 不可用则继续走内存回退（避免 5xx）
      }
    }
  }

  let record = rateLimitStore.get(key)

  if (!record || now - record.windowStart >= config.windowMs) {
    record = { count: 1, windowStart: now, lastRequest: now }
    rateLimitStore.set(key, record)
    return {
      backend: "memory",
      count: 1,
      remaining: config.maxRequests - 1,
      resetTime: new Date(now + config.windowMs),
      success: true,
    }
  }

  record.count += 1
  record.lastRequest = now
  rateLimitStore.set(key, record)

  const remaining = Math.max(config.maxRequests - record.count, 0)
  const resetTime = new Date(record.windowStart + config.windowMs)

  return {
    backend: "memory",
    count: record.count,
    remaining,
    resetTime,
    success: record.count <= config.maxRequests,
  }
}

async function getRateLimitSnapshot(
  key: string,
  config: (typeof RATE_LIMITS)[RateLimitType]
): Promise<RateLimitSnapshot | null> {
  if (redisClient) {
    const value = await redisClient.get<number>(key)
    if (value === null || value === undefined) {
      return null
    }

    const count = typeof value === "number" ? value : Number(value)
    let ttlMs = await redisClient.pttl(key)
    if (ttlMs < 0) {
      ttlMs = config.windowMs
    }

    return {
      backend: "redis",
      count,
      resetTime: new Date(Date.now() + ttlMs),
    }
  }

  const record = rateLimitStore.get(key)
  if (!record) return null

  return {
    backend: "memory",
    count: record.count,
    resetTime: new Date(record.windowStart + config.windowMs),
  }
}

async function resetKey(key: string): Promise<void> {
  if (redisClient) {
    await redisClient.del(key)
  } else {
    rateLimitStore.delete(key)
  }
}

function recordRateLimitMetric(params: {
  type: RateLimitType
  backend: RateLimitBackend
  allowed: boolean
  userId?: string | null
  ip: string
  remaining: number
  maxRequests: number
}) {
  const metricType =
    params.type === "follow" || params.type === "follow-status"
      ? MetricType.FOLLOW_ACTION_RATE_LIMIT
      : MetricType.ACTIVITY_RATE_LIMIT_CHECK

  performanceMonitor.recordMetric({
    type: metricType,
    value: params.allowed ? 1 : 0,
    unit: "count",
    timestamp: new Date(),
    context: {
      userId: params.userId || undefined,
      additionalData: {
        action: params.type,
        backend: params.backend,
        allowed: params.allowed ? "true" : "false",
        remaining: params.remaining,
        maxRequests: params.maxRequests,
        ip: params.ip,
      },
    },
  })
}

export async function rateLimitCheck(
  request: NextRequest,
  type: RateLimitType,
  options?: { userId?: string | null }
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type]
  const ip = getClientIP(request)
  const resolvedUserId =
    options && Object.prototype.hasOwnProperty.call(options, "userId")
      ? (options.userId ?? null)
      : ((await getCurrentUser())?.id ?? null)
  const key = generateRateLimitKey(resolvedUserId, ip, type)

  const computation = await applyRateLimit(key, config)

  recordRateLimitMetric({
    type,
    backend: computation.backend,
    allowed: computation.success,
    userId: resolvedUserId,
    ip,
    remaining: Math.max(computation.remaining, 0),
    maxRequests: config.maxRequests,
  })

  if (!computation.success) {
    return {
      success: false,
      remainingRequests: 0,
      resetTime: computation.resetTime,
      message: config.message,
      backend: computation.backend,
    }
  }

  return {
    success: true,
    remainingRequests: Math.max(computation.remaining, 0),
    resetTime: computation.resetTime,
    backend: computation.backend,
  }
}

export async function rateLimitCheckForAction(
  type: RateLimitType,
  params: { userId: string | null; ip?: string }
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type]
  const normalizedIp = params.ip || "127.0.0.1"
  const key = generateRateLimitKey(params.userId, normalizedIp, type)

  const computation = await applyRateLimit(key, config)

  recordRateLimitMetric({
    type,
    backend: computation.backend,
    allowed: computation.success,
    userId: params.userId || undefined,
    ip: normalizedIp,
    remaining: Math.max(computation.remaining, 0),
    maxRequests: config.maxRequests,
  })

  if (!computation.success) {
    return {
      success: false,
      remainingRequests: 0,
      resetTime: computation.resetTime,
      message: config.message,
      backend: computation.backend,
    }
  }

  return {
    success: true,
    remainingRequests: Math.max(computation.remaining, 0),
    resetTime: computation.resetTime,
    backend: computation.backend,
  }
}

export function withRateLimit(type: RateLimitType) {
  return function <T extends any[]>(
    handler: (request: NextRequest, ...args: T) => Promise<Response>
  ) {
    return async (request: NextRequest, ...args: T): Promise<Response> => {
      const rateLimitResult = await rateLimitCheck(request, type)

      if (!rateLimitResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: rateLimitResult.message,
              resetTime: rateLimitResult.resetTime,
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": RATE_LIMITS[type].maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": rateLimitResult.resetTime?.getTime().toString() || "",
              "X-RateLimit-Backend": rateLimitResult.backend || (redisClient ? "redis" : "memory"),
              "Retry-After": Math.ceil(RATE_LIMITS[type].windowMs / 1000).toString(),
            },
          }
        )
      }

      const response = await handler(request, ...args)

      response.headers.set("X-RateLimit-Limit", RATE_LIMITS[type].maxRequests.toString())
      response.headers.set(
        "X-RateLimit-Remaining",
        (rateLimitResult.remainingRequests || 0).toString()
      )
      response.headers.set(
        "X-RateLimit-Reset",
        rateLimitResult.resetTime?.getTime().toString() || ""
      )
      response.headers.set(
        "X-RateLimit-Backend",
        rateLimitResult.backend || (redisClient ? "redis" : "memory")
      )

      return response
    }
  }
}

export async function resetUserRateLimit(userId: string, type?: RateLimitType): Promise<void> {
  if (redisClient) {
    const types = type ? [type] : (Object.keys(RATE_LIMITS) as RateLimitType[])
    await Promise.all(types.map((entry) => resetKey(generateRateLimitKey(userId, "", entry))))
    return
  }

  if (type) {
    const pattern = generateRateLimitKey(userId, "", type)
    rateLimitStore.delete(pattern)
    return
  }

  for (const key of rateLimitStore.keys()) {
    if (key.includes(userId) && key.startsWith("activity:")) {
      rateLimitStore.delete(key)
    }
  }
}

export async function getRateLimitStatus(
  request: NextRequest,
  type: RateLimitType
): Promise<{
  limit: number
  remaining: number
  resetTime: Date
  blocked: boolean
}> {
  const config = RATE_LIMITS[type]
  const user = await getCurrentUser()
  const ip = getClientIP(request)
  const key = generateRateLimitKey(user?.id || null, ip, type)

  const snapshot = await getRateLimitSnapshot(key, config)
  if (!snapshot) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: new Date(Date.now() + config.windowMs),
      blocked: false,
    }
  }

  const remaining = Math.max(0, config.maxRequests - snapshot.count)
  return {
    limit: config.maxRequests,
    remaining,
    resetTime: snapshot.resetTime,
    blocked: snapshot.count >= config.maxRequests,
  }
}

export async function preCheckRateLimit(
  request: NextRequest,
  type: RateLimitType
): Promise<boolean> {
  const status = await getRateLimitStatus(request, type)
  return !status.blocked && status.remaining > 0
}

export async function checkBatchRateLimit(
  request: NextRequest,
  type: RateLimitType,
  batchSize: number
): Promise<RateLimitResult> {
  const status = await getRateLimitStatus(request, type)

  if (status.blocked) {
    return {
      success: false,
      remainingRequests: 0,
      resetTime: status.resetTime,
      message: RATE_LIMITS[type].message,
      backend: redisClient ? "redis" : "memory",
    }
  }

  if (status.remaining < batchSize) {
    return {
      success: false,
      remainingRequests: status.remaining,
      resetTime: status.resetTime,
      message: `批量操作数量过多，当前剩余 ${status.remaining} 次操作机会`,
      backend: redisClient ? "redis" : "memory",
    }
  }

  return {
    success: true,
    remainingRequests: status.remaining - batchSize,
    resetTime: status.resetTime,
    backend: redisClient ? "redis" : "memory",
  }
}

export const ROLE_MULTIPLIERS = {
  ADMIN: 10,
  USER: 1,
} as const

export function getRateLimitForUser(
  baseLimit: (typeof RATE_LIMITS)[RateLimitType],
  userRole?: "ADMIN" | "USER"
) {
  const multiplier = userRole ? ROLE_MULTIPLIERS[userRole] : ROLE_MULTIPLIERS.USER

  return {
    ...baseLimit,
    maxRequests: baseLimit.maxRequests * multiplier,
  }
}
