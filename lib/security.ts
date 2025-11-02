/**
 * 安全配置和工具函数
 * Phase 4.1 安全性加强 - 实现 CSRF 保护、XSS 防护和会话安全管理
 */

import { NextRequest, NextResponse } from "next/server"

// 动态导入 DOMPurify，仅在客户端或支持的环境中使用
let DOMPurify: any = null
if (typeof window !== "undefined") {
  // 客户端环境，动态导入
  import("isomorphic-dompurify").then((module) => {
    DOMPurify = module.default
  })
}

/**
 * CSP (Content Security Policy) 配置
 * 防止 XSS 攻击的核心配置
 */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-eval'", // Next.js 开发模式需要
    "'unsafe-inline'", // 某些内联脚本需要，生产环境应该移除
    "https://unpkg.com", // 如果使用 CDN 组件库
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'", // Tailwind CSS 需要
    "https://fonts.googleapis.com",
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co", // Supabase 存储
    "https://avatars.githubusercontent.com", // GitHub 头像
    "https://github.com", // GitHub 相关图片
    "https://images.unsplash.com", // Unsplash 图片
    "https://picsum.photos", // Lorem Picsum 图片
  ],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co", // Supabase API
    "http://localhost:*", // 本地开发服务器
    "http://127.0.0.1:*", // 本地 Supabase API
    "ws://localhost:*", // 开发模式 WebSocket
    "ws://127.0.0.1:*", // 本地 WebSocket
    "wss://*.supabase.co", // Supabase 实时连接
  ],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
} as const

/**
 * 生成 CSP 头部字符串
 */
export function generateCSPHeader(): string {
  // 开发环境对图片源更宽松
  const isDevelopment = process.env.NODE_ENV === "development"

  const directives = { ...CSP_DIRECTIVES }

  if (isDevelopment) {
    // 开发环境允许更多图片源
    directives["img-src"] = [
      ...CSP_DIRECTIVES["img-src"],
      "*", // 允许所有图片源
    ]
  }

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ")
}

/**
 * CSRF 令牌管理 (客户端安全)
 */
export class CSRFProtection {
  private static readonly TOKEN_HEADER = "X-CSRF-Token"
  private static readonly TOKEN_COOKIE = "csrf-token"

  /**
   * 生成简单的 CSRF 令牌 (客户端兼容)
   */
  static generateToken(): string {
    // 使用浏览器兼容的方式生成令牌
    const array = new Uint8Array(32)
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(array)
    } else {
      // 服务端环境的回退方案
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  /**
   * 验证 CSRF 令牌
   */
  static validateToken(request: NextRequest): boolean {
    const tokenFromHeader = request.headers.get(this.TOKEN_HEADER)
    const tokenFromCookie = request.cookies.get(this.TOKEN_COOKIE)?.value

    if (!tokenFromHeader || !tokenFromCookie) {
      return false
    }

    // 使用时间常数比较防止时序攻击
    return this.constantTimeEquals(tokenFromHeader, tokenFromCookie)
  }

  /**
   * 时间常数字符串比较
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

  /**
   * 设置 CSRF Cookie
   */
  static setCsrfCookie(response: NextResponse): void {
    const token = this.generateToken()

    response.cookies.set(this.TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 小时
    })
  }
}

/**
 * XSS 防护工具
 */
export class XSSProtection {
  /**
   * 清理用户输入的 HTML 内容
   */
  static sanitizeHTML(dirty: string): string {
    // 如果 DOMPurify 不可用（如在 Edge Runtime 中），使用基础清理
    if (!DOMPurify) {
      return this.basicSanitize(dirty)
    }

    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "code",
        "pre",
        "blockquote",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "a",
      ],
      ALLOWED_ATTR: ["href", "title", "target"],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ["script", "object", "embed", "iframe", "form"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover"],
    })
  }

  /**
   * 基础 HTML 清理（Edge Runtime 备用方案）
   */
  private static basicSanitize(dirty: string): string {
    // 移除所有 script 标签
    let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")

    // 移除危险的标签
    const dangerousTags = ["object", "embed", "iframe", "form", "input", "button"]
    for (const tag of dangerousTags) {
      const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, "gi")
      clean = clean.replace(regex, "")
    }

    // 移除事件处理器属性
    clean = clean.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    clean = clean.replace(/\son\w+\s*=\s*[^>\s]+/gi, "")

    // 移除 javascript: 和 vbscript: URL
    clean = clean.replace(/href\s*=\s*["']?(javascript|vbscript):[^"'>]+["']?/gi, 'href="#"')

    return clean
  }

  /**
   * 验证和清理用户输入
   */
  static validateAndSanitizeInput(input: unknown): string | null {
    if (typeof input !== "string") {
      return null
    }

    // 检查输入长度
    if (input.length > 10000) {
      throw new Error("输入内容过长")
    }

    // 检查可疑模式
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(input)) {
        console.warn("检测到可疑输入模式:", pattern.toString())
        return this.sanitizeHTML(input)
      }
    }

    return this.sanitizeHTML(input)
  }

  /**
   * 转义 HTML 实体
   */
  static escapeHTML(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
}

/**
 * 会话安全管理
 */
export class SessionSecurity {
  private static readonly SESSION_TIMEOUT = 60 * 60 * 1000 // 1 小时
  private static readonly REFRESH_THRESHOLD = 30 * 60 * 1000 // 30 分钟

  /**
   * 检查会话是否需要刷新
   */
  static shouldRefreshSession(lastRefresh: Date): boolean {
    const now = new Date().getTime()
    const lastRefreshTime = new Date(lastRefresh).getTime()

    return now - lastRefreshTime > this.REFRESH_THRESHOLD
  }

  /**
   * 检查会话是否过期
   */
  static isSessionExpired(sessionStart: Date): boolean {
    const now = new Date().getTime()
    const sessionStartTime = new Date(sessionStart).getTime()

    return now - sessionStartTime > this.SESSION_TIMEOUT
  }

  /**
   * 生成简单的会话指纹 (客户端兼容)
   * 用于检测会话劫持的基础检查
   */
  static generateSessionFingerprint(request: NextRequest): string {
    const components = [
      request.headers.get("user-agent") || "",
      request.headers.get("accept-language") || "",
      request.headers.get("accept-encoding") || "",
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
    ]

    // 使用简单的哈希算法代替 crypto
    let hash = 0
    const str = components.join("|")
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * 验证会话指纹
   * 检测是否存在会话劫持
   */
  static validateSessionFingerprint(request: NextRequest, storedFingerprint: string): boolean {
    const currentFingerprint = this.generateSessionFingerprint(request)
    return currentFingerprint === storedFingerprint
  }

  /**
   * 生成安全的会话令牌 (客户端兼容)
   */
  static generateSecureToken(length: number = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let result = ""

    if (typeof window !== "undefined" && window.crypto) {
      const array = new Uint8Array(length)
      window.crypto.getRandomValues(array)
      for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length]
      }
    } else {
      // 服务端环境的回退方案
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
      }
    }

    return result
  }
}

/**
 * 安全头部配置
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  // CSP 头部
  response.headers.set("Content-Security-Policy", generateCSPHeader())

  // XSS 保护
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")

  // HSTS (仅在生产环境启用)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    )
  }

  // 引用策略
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // 权限策略
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  return response
}

/**
 * 验证请求来源
 */
export function validateRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  // 开发环境更宽松的验证
  if (process.env.NODE_ENV === "development") {
    if (origin) {
      // 开发环境允许 localhost 和 127.0.0.1 的任意端口
      return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    }

    if (referer) {
      try {
        const refererUrl = new URL(referer)
        return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(refererUrl.origin)
      } catch {
        return false
      }
    }

    return false
  }

  // 生产环境严格验证
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    "https://yourdomain.com", // 替换为实际域名
  ]

  if (origin) {
    return allowedOrigins.includes(origin)
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer)
      return allowedOrigins.includes(refererUrl.origin)
    } catch {
      return false
    }
  }

  return false
}

/**
 * 速率限制配置
 */
export class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>()

  /**
   * 检查速率限制
   */
  static checkRateLimit(
    identifier: string,
    limit: number = 100,
    windowMs: number = 15 * 60 * 1000 // 15 分钟
  ): boolean {
    const now = Date.now()
    const record = this.requests.get(identifier)

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      })
      return true
    }

    if (record.count >= limit) {
      return false
    }

    record.count++
    return true
  }

  /**
   * 重置指定标识符的速率限制记录（开发环境使用）
   */
  static resetRateLimit(identifier: string): void {
    this.requests.delete(identifier)
  }

  /**
   * 重置所有速率限制记录（开发环境使用）
   */
  static resetAllRateLimits(): void {
    if (process.env.NODE_ENV === "development") {
      this.requests.clear()
      console.log("🔄 开发环境：已重置所有速率限制记录")
    }
  }

  /**
   * 清理过期记录
   */
  static cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key)
      }
    }
  }
}
