/**
 * 服务端安全工具函数
 * 仅在服务端环境中使用，包含 Node.js 特定的 crypto 功能
 */

import { createHash, randomBytes } from "crypto"
import { NextRequest } from "next/server"
import { getClientIp } from "@/lib/api/get-client-ip"

/**
 * 安全令牌生成器 (服务端专用)
 */
export class SecureTokenGenerator {
  /**
   * 生成加密安全的随机字符串
   */
  static generateRandomToken(length: number = 32): string {
    return randomBytes(length).toString("hex")
  }

  /**
   * 生成 CSRF 令牌
   */
  static generateCSRFToken(): string {
    return this.generateRandomToken(32)
  }

  /**
   * 生成会话令牌
   */
  static generateSessionToken(): string {
    return this.generateRandomToken(64)
  }
}

/**
 * 会话指纹生成器 (服务端专用)
 */
export class ServerSessionSecurity {
  /**
   * 生成会话指纹
   * 用于检测会话劫持
   */
  static generateSessionFingerprint(request: NextRequest): string {
    const components = [
      request.headers.get("user-agent") || "",
      request.headers.get("accept-language") || "",
      request.headers.get("accept-encoding") || "",
      getClientIp(request) || "",
    ]

    return createHash("sha256").update(components.join("|")).digest("hex")
  }

  /**
   * 验证会话指纹
   */
  static validateSessionFingerprint(request: NextRequest, storedFingerprint: string): boolean {
    const currentFingerprint = this.generateSessionFingerprint(request)
    return currentFingerprint === storedFingerprint
  }

  /**
   * 生成数据签名
   */
  static signData(data: string, secret: string): string {
    return createHash("hmac").update(secret).update(data).digest("hex")
  }

  /**
   * 验证数据签名
   */
  static verifyDataSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.signData(data, secret)
    return this.constantTimeEquals(signature, expectedSignature)
  }

  /**
   * 时间常数比较 (防止时序攻击)
   */
  private static constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }
}

/**
 * 密码哈希工具 (服务端专用)
 */
export class PasswordSecurity {
  /**
   * 生成密码哈希
   */
  static hashPassword(password: string, salt?: string): string {
    const passwordSalt = salt || randomBytes(16).toString("hex")
    const hash = createHash("pbkdf2")
      .update(password + passwordSalt)
      .digest("hex")

    return `${hash}:${passwordSalt}`
  }

  /**
   * 验证密码
   */
  static verifyPassword(password: string, hashedPassword: string): boolean {
    const [hash, salt] = hashedPassword.split(":")
    const expectedHash = this.hashPassword(password, salt).split(":")[0]

    return ServerSessionSecurity["constantTimeEquals"](hash, expectedHash)
  }

  /**
   * 生成安全的重置令牌
   */
  static generateResetToken(): { token: string; expires: Date } {
    const token = SecureTokenGenerator.generateRandomToken(32)
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 小时后过期

    return { token, expires }
  }
}
