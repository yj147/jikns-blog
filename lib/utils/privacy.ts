/**
 * 隐私保护工具函数
 * 用于脱敏和保护个人身份信息（PII）
 *
 * ✅ Linus "Pragmatism" 原则：解决真实的合规问题（GDPR、CCPA）
 * ✅ Linus "Simplicity" 原则：简单的脱敏逻辑，易于理解和维护
 */

import { createHash } from "crypto"

/**
 * 邮箱脱敏
 * 保留前 2 个字符和 @ 后的域名，中间部分用 *** 替换
 *
 * @example
 * maskEmail("user@example.com") // "us***@example.com"
 * maskEmail("a@test.com") // "a***@test.com"
 * maskEmail("verylongemail@domain.com") // "ve***@domain.com"
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "***"
  }

  const atIndex = email.indexOf("@")
  if (atIndex === -1) {
    // 无效邮箱格式，完全脱敏
    return "***"
  }

  const localPart = email.slice(0, atIndex)
  const domainPart = email.slice(atIndex)

  if (localPart.length <= 2) {
    // 本地部分太短，保留第一个字符
    return `${localPart[0]}***${domainPart}`
  }

  // 保留前 2 个字符
  return `${localPart.slice(0, 2)}***${domainPart}`
}

/**
 * 邮箱哈希
 * 使用 SHA-256 生成邮箱哈希值，用于审计日志中的用户追踪
 *
 * @example
 * hashEmail("user@example.com") // "sha256:a1b2c3d4..."
 */
export function hashEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "sha256:invalid"
  }

  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex")
  return `sha256:${hash.slice(0, 16)}` // 只保留前 16 个字符，足够唯一
}

/**
 * 手机号脱敏
 * 保留前 3 位和后 4 位，中间部分用 **** 替换
 *
 * @example
 * maskPhone("13812345678") // "138****5678"
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== "string") {
    return "****"
  }

  if (phone.length < 7) {
    // 手机号太短，完全脱敏
    return "****"
  }

  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

/**
 * IP 地址脱敏
 * 保留前两段，后两段用 *.* 替换
 *
 * @example
 * maskIP("192.168.1.100") // "192.168.*.*"
 * maskIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334") // "2001:0db8:*:*:*:*:*:*"
 */
export function maskIP(ip: string): string {
  if (!ip || typeof ip !== "string") {
    return "*.*.*.*"
  }

  // IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".")
    if (parts.length !== 4) {
      return "*.*.*.*"
    }
    return `${parts[0]}.${parts[1]}.*.*`
  }

  // IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":")
    if (parts.length < 3) {
      return "*:*:*:*:*:*:*:*"
    }
    return `${parts[0]}:${parts[1]}:*:*:*:*:*:*`
  }

  return "*.*.*.*"
}
