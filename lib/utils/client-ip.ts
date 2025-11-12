/**
 * 客户端 IP 解析工具
 *
 * Linus 原则：提取公共逻辑，消除重复代码
 * 修复前：每个路由都有自己的 getClientIP 实现，直接使用完整 x-forwarded-for
 * 修复后：统一的 IP 解析逻辑，正确解析 x-forwarded-for 首段
 */

import { NextRequest } from "next/server"

type HeaderGetter = Pick<Headers, "get">

function resolveClientIP(getHeader: (key: string) => string | null): string {
  const forwardedFor = getHeader("x-forwarded-for")
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0].trim()
    if (firstIP && isValidIP(firstIP)) {
      return firstIP
    }
  }

  const realIP = getHeader("x-real-ip")
  if (realIP && isValidIP(realIP)) {
    return realIP
  }

  const cfIP = getHeader("cf-connecting-ip")
  if (cfIP && isValidIP(cfIP)) {
    return cfIP
  }

  return "unknown"
}

/**
 * 从请求中提取真实客户端 IP
 *
 * 处理 x-forwarded-for 格式：`client-ip, proxy1-ip, proxy2-ip`
 * 只取第一段作为真实 IP，防止攻击者通过拼接不同尾巴绕过速率限制
 *
 * 回落顺序：
 * 1. x-forwarded-for 首段
 * 2. x-real-ip
 * 3. cf-connecting-ip (Cloudflare)
 * 4. "unknown"
 *
 * @param request - Next.js 请求对象
 * @returns 客户端 IP 地址，如果无法获取则返回 "unknown"
 *
 * @example
 * ```typescript
 * const clientIP = getClientIP(request)
 * const limiterKey = `auth:login:${clientIP}`
 * ```
 */
export function getClientIP(request: NextRequest): string {
  return resolveClientIP((key) => request.headers.get(key))
}

/**
 * 从请求中提取真实客户端 IP（可为 null）
 *
 * 与 getClientIP 的区别：
 * - getClientIP 总是返回字符串（回落到 "unknown"）
 * - getClientIPOrNull 在无法获取时返回 null
 *
 * @param request - Next.js 请求对象
 * @returns 客户端 IP 地址，如果无法获取则返回 null
 */
export function getClientIPOrNull(request: NextRequest): string | null {
  const ip = getClientIP(request)
  return ip === "unknown" ? null : ip
}

export function getClientIPFromHeaders(headers: HeaderGetter): string {
  return resolveClientIP((key) => headers.get(key))
}

export function getClientIPOrNullFromHeaders(headers: HeaderGetter): string | null {
  const ip = getClientIPFromHeaders(headers)
  return ip === "unknown" ? null : ip
}

/**
 * 验证 IP 地址格式是否有效
 *
 * 支持 IPv4 和 IPv6 格式
 *
 * @param ip - IP 地址字符串
 * @returns 是否为有效 IP
 */
function isValidIP(ip: string): boolean {
  if (!ip || ip.length === 0) {
    return false
  }

  // IPv4 正则：xxx.xxx.xxx.xxx
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(ip)) {
    // 验证每段是否在 0-255 范围内
    const parts = ip.split(".")
    return parts.every((part) => {
      const num = parseInt(part, 10)
      return num >= 0 && num <= 255
    })
  }

  // IPv6 正则：简化版，支持常见格式
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  if (ipv6Regex.test(ip)) {
    return true
  }

  // IPv6 压缩格式：::1, ::ffff:192.0.2.1
  if (ip.includes("::")) {
    return true
  }

  return false
}
