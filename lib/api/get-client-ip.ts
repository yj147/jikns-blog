import { NextRequest } from "next/server"

type HeaderGetter = Pick<Headers, "get">

const TRUSTED_PROXY_ENABLED =
  process.env.TRUST_PROXY === "true" || process.env.TRUSTED_PROXY === "true"

// 本地开发/测试环境下，当无法获取真实 IP 时自动启用 fallback
const IS_LOCAL_ENVIRONMENT =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost") ||
  !process.env.NEXT_PUBLIC_SITE_URL

function isValidIp(ip: string | null | undefined): ip is string {
  if (!ip) return false
  const value = ip.trim()
  if (value.length === 0 || value.length > 100) {
    return false
  }

  const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(value)) {
    return value.split(".").every((segment) => {
      const num = Number.parseInt(segment, 10)
      return num >= 0 && num <= 255
    })
  }

  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  if (ipv6Regex.test(value) || value.includes("::")) {
    return true
  }

  return false
}

function pickForwardedFor(headers: HeaderGetter): string | null {
  if (!TRUSTED_PROXY_ENABLED) return null

  const header = headers.get("x-forwarded-for")
  if (!header) return null

  const first = header.split(",")[0]?.trim()
  return isValidIp(first) ? first : null
}

function pickRealIp(headers: HeaderGetter): string | null {
  if (!TRUSTED_PROXY_ENABLED) return null
  const real = headers.get("x-real-ip")
  return isValidIp(real) ? real : null
}

export function getClientIp(request: NextRequest): string {
  // request.ip 在 Vercel 部署时可用，类型为 string | undefined
  const reqIp = (request as unknown as { ip?: string }).ip
  const directIp = isValidIp(reqIp) ? reqIp.trim() : null
  if (directIp) {
    return directIp
  }

  const forwarded = pickForwardedFor(request.headers)
  if (forwarded) {
    return forwarded
  }

  const realIp = pickRealIp(request.headers)
  if (realIp) {
    return realIp
  }

  // 本地环境 fallback：基于请求特征生成唯一标识符
  // 避免所有请求共享 "unknown" 导致限流桶冲突
  if (IS_LOCAL_ENVIRONMENT) {
    return generateFallbackIdentifier(request.headers)
  }

  return "unknown"
}

/**
 * 基于请求头生成 fallback 标识符
 * 用于本地环境无法获取真实 IP 时的限流隔离
 */
function generateFallbackIdentifier(headers: HeaderGetter): string {
  const components = [
    headers.get("user-agent") ?? "",
    headers.get("accept-language") ?? "",
    headers.get("accept-encoding") ?? "",
  ]

  // 简单哈希算法生成标识符
  let hash = 0
  const str = components.join("|")
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  return `local-${Math.abs(hash).toString(16)}`
}

export function getClientIpOrNull(request: NextRequest): string | null {
  const ip = getClientIp(request)
  return ip === "unknown" ? null : ip
}

export function getClientIpFromHeaders(headers: HeaderGetter): string {
  const forwarded = pickForwardedFor(headers)
  if (forwarded) {
    return forwarded
  }

  const realIp = pickRealIp(headers)
  if (realIp) {
    return realIp
  }

  return "unknown"
}

export function getClientIpOrNullFromHeaders(headers: HeaderGetter): string | null {
  const ip = getClientIpFromHeaders(headers)
  return ip === "unknown" ? null : ip
}
