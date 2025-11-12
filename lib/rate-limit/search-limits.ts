import { applyDistributedRateLimit } from "@/lib/rate-limit/shared"

interface SearchRateLimitConfig {
  enabled: boolean
  windowMs: number
  perUser: number
  perIP: number
}

export interface SearchRateLimitResult {
  allowed: boolean
  retryAfter?: number
}

interface CheckSearchRateLimitParams {
  userId?: string | null
  ip?: string | null
  requestId?: string
}

const loadSearchRateLimitConfig = (): SearchRateLimitConfig => ({
  enabled: process.env.SEARCH_RATE_LIMIT_ENABLED !== "false",
  windowMs: parseInt(process.env.SEARCH_RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  perUser: parseInt(process.env.SEARCH_RATE_LIMIT_PER_USER ?? "60", 10),
  perIP: parseInt(process.env.SEARCH_RATE_LIMIT_PER_IP ?? "120", 10),
})

export async function checkSearchRateLimit(
  params: CheckSearchRateLimitParams
): Promise<SearchRateLimitResult> {
  const config = loadSearchRateLimitConfig()
  if (!config.enabled) {
    return { allowed: true }
  }

  const windowMs = config.windowMs
  const userKey = params.userId ? `search:content:user:${params.userId}` : null
  const ipKey = `search:content:ip:${params.ip ?? "anonymous"}`

  if (userKey) {
    const result = await applyDistributedRateLimit(userKey, config.perUser, windowMs)
    if (!result.allowed) {
      return {
        allowed: false,
        retryAfter: result.retryAfter,
      }
    }
  }

  const result = await applyDistributedRateLimit(ipKey, config.perIP, windowMs)
  if (!result.allowed) {
    return {
      allowed: false,
      retryAfter: result.retryAfter,
    }
  }

  return { allowed: true }
}

export { loadSearchRateLimitConfig }
