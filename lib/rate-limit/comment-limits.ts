/**
 * 评论系统限流模块
 *
 * 提供评论创建和删除操作的频率限制功能
 * 默认关闭，通过环境变量控制开关
 */

import { RateLimiter } from "@/lib/security"
import { getRedisClient } from "@/lib/rate-limit/redis-client"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { getClientIpFromHeaders } from "@/lib/api/get-client-ip"

// 限流配置接口
interface RateLimitConfig {
  enabled: boolean
  windowMs: number
  createPerUser: number
  createPerIP: number
  deletePerUser: number
  deletePerIP: number
}

// 限流检查参数
interface CheckRateParams {
  userId?: string
  ip?: string
  action: "create" | "delete"
}

// 限流检查结果
interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

type RateLimitBackend = "redis" | "memory"

interface RateLimitComputation extends RateLimitResult {
  backend: RateLimitBackend
  remaining: number | null
  limit: number
}

// 从环境变量加载配置
const loadConfig = (): RateLimitConfig => ({
  enabled: process.env.COMMENTS_RATE_LIMIT_ENABLED === "true",
  windowMs: parseInt(process.env.COMMENTS_RATE_LIMIT_WINDOW_MS || "60000", 10),
  createPerUser: parseInt(process.env.COMMENTS_RATE_LIMIT_CREATE_USER || "20", 10),
  createPerIP: parseInt(process.env.COMMENTS_RATE_LIMIT_CREATE_IP || "60", 10),
  deletePerUser: parseInt(process.env.COMMENTS_RATE_LIMIT_DELETE_USER || "10", 10),
  deletePerIP: parseInt(process.env.COMMENTS_RATE_LIMIT_DELETE_IP || "30", 10),
})

/**
 * 检查评论操作的频率限制
 *
 * @param params 检查参数
 * @returns 限流检查结果
 */
export async function checkCommentRate(params: CheckRateParams): Promise<RateLimitResult> {
  const config = loadConfig()

  // 如果限流未启用，直接允许
  if (!config.enabled) {
    return { allowed: true }
  }

  const { userId, ip, action } = params
  const windowMs = config.windowMs

  // 根据操作类型获取对应的限制值
  const limits =
    action === "create"
      ? { perUser: config.createPerUser, perIP: config.createPerIP }
      : { perUser: config.deletePerUser, perIP: config.deletePerIP }

  // 检查用户维度限流
  if (userId) {
    const userKey = `comment:${action}:user:${userId}`
    const userResult = await applyRateLimit(userKey, limits.perUser, windowMs)

    recordCommentRateLimitMetric({
      action,
      backend: userResult.backend,
      dimension: "user",
      allowed: userResult.allowed,
      remaining: userResult.remaining,
      limit: limits.perUser,
      retryAfter: userResult.retryAfter,
      userId,
      ip,
    })

    if (!userResult.allowed) {
      return {
        allowed: false,
        retryAfter: userResult.retryAfter,
      }
    }
  }

  // 检查 IP 维度限流
  if (ip) {
    const ipKey = `comment:${action}:ip:${ip}`
    const ipResult = await applyRateLimit(ipKey, limits.perIP, windowMs)

    recordCommentRateLimitMetric({
      action,
      backend: ipResult.backend,
      dimension: "ip",
      allowed: ipResult.allowed,
      remaining: ipResult.remaining,
      limit: limits.perIP,
      retryAfter: ipResult.retryAfter,
      userId,
      ip,
    })

    if (!ipResult.allowed) {
      return {
        allowed: false,
        retryAfter: ipResult.retryAfter,
      }
    }
  }

  // 两个维度都通过，允许操作
  return { allowed: true }
}

/**
 * 从请求头中提取客户端 IP
 *
 * @param headers 请求头
 * @returns 客户端 IP 地址或 undefined
 */
export function extractClientIP(headers: Headers): string | undefined {
  const ip = getClientIpFromHeaders(headers)
  return ip === "unknown" ? undefined : ip
}

// 导出配置加载函数，用于测试
export { loadConfig }

async function applyRateLimit(
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
      const retryAfter = allowed ? undefined : Math.max(1, Math.ceil(ttlMs / 1000))

      return {
        allowed,
        retryAfter,
        backend: "redis",
        remaining,
        limit,
      }
    } catch (error) {
      // Redis 不可用时回退到内存限流
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

function recordCommentRateLimitMetric(params: {
  action: "create" | "delete"
  dimension: "user" | "ip"
  backend: RateLimitBackend
  allowed: boolean
  remaining: number | null
  limit: number
  retryAfter?: number
  userId?: string
  ip?: string
}): void {
  performanceMonitor.recordMetric({
    type: MetricType.COMMENT_RATE_LIMIT_CHECK,
    value: params.allowed ? 1 : 0,
    unit: "count",
    timestamp: new Date(),
    context: {
      userId: params.userId,
      additionalData: {
        action: params.action,
        dimension: params.dimension,
        backend: params.backend,
        allowed: params.allowed ? "true" : "false",
        remaining: params.remaining,
        limit: params.limit,
        retryAfter: params.retryAfter ?? null,
        ip: params.ip ?? null,
      },
    },
  })
}
