import { applyDistributedRateLimit } from "@/lib/rate-limit/shared"
import { getClientIP, getClientIPFromHeaders } from "@/lib/utils/client-ip"
import type { NextRequest } from "next/server"

const TAG_LIMITS = {
  mutation: {
    windowMs: 60 * 1000,
    maxRequests: 8,
    message: "标签操作过于频繁，请稍后再试",
  },
  search: {
    windowMs: 30 * 1000,
    maxRequests: 30,
    message: "标签搜索请求过多，请稍后再试",
  },
} as const

type TagLimitType = keyof typeof TAG_LIMITS

function buildKey(type: TagLimitType, identifier: string) {
  return `tag:${type}:${identifier}`
}

function asRateLimitError(message: string, retryAfter: number) {
  const error = new Error(message)
  ;(error as any).statusCode = 429
  ;(error as any).retryAfter = retryAfter
  return error
}

export async function enforceTagRateLimitForRequest(
  type: TagLimitType,
  request: NextRequest,
  userId?: string | null
) {
  const config = TAG_LIMITS[type]
  const identifier = userId ?? getClientIP(request) ?? "anonymous"
  const result = await applyDistributedRateLimit(
    buildKey(type, identifier),
    config.maxRequests,
    config.windowMs
  )

  if (!result.allowed) {
    throw asRateLimitError(config.message, result.retryAfter ?? Math.ceil(config.windowMs / 1000))
  }

  return result
}

export async function enforceTagRateLimitForUser(type: TagLimitType, userId: string | null) {
  const config = TAG_LIMITS[type]
  const identifier = userId ?? "anonymous"
  const result = await applyDistributedRateLimit(
    buildKey(type, identifier),
    config.maxRequests,
    config.windowMs
  )

  if (!result.allowed) {
    throw asRateLimitError(config.message, result.retryAfter ?? Math.ceil(config.windowMs / 1000))
  }

  return result
}

export async function enforceTagRateLimitForHeaders(
  type: TagLimitType,
  headers: Headers,
  userId?: string | null
) {
  const config = TAG_LIMITS[type]
  const ip = getClientIPFromHeaders(headers)
  const identifier = userId ?? (ip === "unknown" ? "anonymous" : ip)
  const result = await applyDistributedRateLimit(
    buildKey(type, identifier),
    config.maxRequests,
    config.windowMs
  )

  if (!result.allowed) {
    throw asRateLimitError(config.message, result.retryAfter ?? Math.ceil(config.windowMs / 1000))
  }

  return result
}
