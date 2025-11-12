/**
 * 收藏操作限流模块
 *
 * 为 /api/bookmarks 的 POST 切换操作提供频率限制
 * 默认关闭，通过环境变量控制
 */

import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { applyDistributedRateLimit, type RateLimitComputation } from "@/lib/rate-limit/shared"

interface RateLimitConfig {
  enabled: boolean
  windowMs: number
  togglePerUser: number
  togglePerIP: number
}

interface CheckRateParams {
  userId?: string
  ip?: string
  requestId?: string
}

interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

const loadConfig = (): RateLimitConfig => ({
  enabled: process.env.BOOKMARKS_RATE_LIMIT_ENABLED === "true",
  windowMs: parseInt(process.env.BOOKMARKS_RATE_LIMIT_WINDOW_MS || "60000", 10),
  togglePerUser: parseInt(process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_USER || "30", 10),
  togglePerIP: parseInt(process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_IP || "60", 10),
})

export async function checkBookmarkRate(params: CheckRateParams): Promise<RateLimitResult> {
  const config = loadConfig()

  if (!config.enabled) return { allowed: true }

  const { userId, ip } = params
  const windowMs = config.windowMs

  if (userId) {
    const userKey = `bookmark:toggle:user:${userId}`
    const result = await applyDistributedRateLimit(userKey, config.togglePerUser, windowMs)

    recordBookmarkRateLimitMetric({
      dimension: "user",
      result,
      userId,
      ip,
    })

    if (!result.allowed) {
      return {
        allowed: false,
        retryAfter: result.retryAfter,
      }
    }
  }

  if (ip) {
    const ipKey = `bookmark:toggle:ip:${ip}`
    const result = await applyDistributedRateLimit(ipKey, config.togglePerIP, windowMs)

    recordBookmarkRateLimitMetric({
      dimension: "ip",
      result,
      userId,
      ip,
    })

    if (!result.allowed) {
      return {
        allowed: false,
        retryAfter: result.retryAfter,
      }
    }
  }

  return { allowed: true }
}

export { loadConfig }

function recordBookmarkRateLimitMetric(params: {
  dimension: "user" | "ip"
  result: RateLimitComputation
  userId?: string
  ip?: string
  requestId?: string
}) {
  performanceMonitor.recordMetric({
    type: MetricType.BOOKMARK_RATE_LIMIT_CHECK,
    value: params.result.allowed ? 1 : 0,
    unit: "count",
    timestamp: new Date(),
    context: {
      userId: params.userId,
      ip: params.ip,
      additionalData: {
        requestId: params.requestId ?? null,
        action: "toggle",
        dimension: params.dimension,
        backend: params.result.backend,
        allowed: params.result.allowed ? "true" : "false",
        remaining: params.result.remaining,
        limit: params.result.limit,
        retryAfter: params.result.retryAfter ?? null,
      },
    },
  })
}
