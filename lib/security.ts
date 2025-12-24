/**
 * 安全配置和工具函数
 * Phase 4.1 安全性加强 - 实现 CSRF 保护、XSS 防护和会话安全管理
 */

import { NextRequest, NextResponse } from "next/server"
import { getClientIp } from "@/lib/api/get-client-ip"
import { logger } from "./utils/logger"

// 动态导入 DOMPurify，仅在客户端或支持的环境中使用
let DOMPurify: any = null
if (typeof window !== "undefined") {
  // 客户端环境，动态导入
  import("isomorphic-dompurify").then((module) => {
    DOMPurify = module.default
  })
}

function getSecureCrypto(): Crypto {
  const cryptoObj = globalThis.crypto

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    return cryptoObj
  }

  throw new Error("安全随机数不可用：当前环境缺少 Web Crypto 支持")
}

function generateRandomBytes(length: number): Uint8Array {
  const cryptoObj = getSecureCrypto()
  const array = new Uint8Array(length)
  cryptoObj.getRandomValues(array)
  return array
}

/**
 * CSP (Content Security Policy) 配置
 * 防止 XSS 攻击的核心配置
 */
type CspDirectives = Record<string, string[]>

// 生产基线：Next.js hydration 和主题切换需要 'unsafe-inline'
export const CSP_DIRECTIVES: Readonly<CspDirectives> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://unpkg.com",
    "https://static.cloudflareinsights.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.supabase.co",
    "https://avatars.githubusercontent.com",
    "https://github.com",
    "https://images.unsplash.com",
    "https://picsum.photos",
  ],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "ws://localhost:*",
    "ws://127.0.0.1:*",
    "wss://*.supabase.co",
  ],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
}

const DEV_SCRIPT_EXCEPTIONS = ["'unsafe-eval'", "'unsafe-inline'"]
const DEV_STYLE_EXCEPTIONS = ["'unsafe-inline'"]
const DEV_IMAGE_WILDCARD = ["*"]
// 生产环境只移除 unsafe-eval，保留 unsafe-inline（Next.js 需要）
const UNSAFE_TOKENS = new Set(["'unsafe-eval'"])

function cloneDirectives(base: Readonly<CspDirectives>): CspDirectives {
  return Object.fromEntries(
    Object.entries(base).map(([directive, sources]) => [directive, [...sources]])
  )
}

function applyNonce(directives: CspDirectives, nonce?: string): void {
  if (!nonce) return

  directives["script-src"] = [...directives["script-src"], `'nonce-${nonce}'`, "'strict-dynamic'"]
  directives["style-src"] = [...directives["style-src"], `'nonce-${nonce}'`]
}

function applyDevelopmentRelaxations(directives: CspDirectives): void {
  directives["script-src"].push(...DEV_SCRIPT_EXCEPTIONS)
  directives["style-src"].push(...DEV_STYLE_EXCEPTIONS)
  directives["img-src"] = [...directives["img-src"], ...DEV_IMAGE_WILDCARD]
}

function stripUnsafeTokens(directives: CspDirectives): void {
  // 只移除 unsafe-eval，保留 unsafe-inline（Next.js/Tailwind 需要）
  directives["script-src"] = directives["script-src"].filter((source) => !UNSAFE_TOKENS.has(source))
}

function dedupeSources(sources: string[]): string[] {
  return [...new Set(sources)]
}

/**
 * 生成 CSP 头部字符串
 */
export function generateCSPHeader(options: { nonce?: string; environment?: string } = {}): string {
  const environment = options.environment ?? process.env.NODE_ENV
  const isDevelopment = environment === "development"

  const directives = cloneDirectives(CSP_DIRECTIVES)

  applyNonce(directives, options.nonce)

  if (isDevelopment) {
    applyDevelopmentRelaxations(directives)
  } else {
    stripUnsafeTokens(directives)
  }

  const normalized = Object.entries(directives).map(([directive, sources]) => ({
    directive,
    sources: dedupeSources(sources),
  }))

  return normalized.map(({ directive, sources }) => `${directive} ${sources.join(" ")}`).join("; ")
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
    const bytes = generateRandomBytes(32)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
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
  static setCsrfCookie(response: NextResponse, token?: string): string {
    const csrfToken = token ?? this.generateToken()

    response.cookies.set(this.TOKEN_COOKIE, csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 小时
    })

    return csrfToken
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
        logger.warn("检测到可疑输入模式", { pattern: pattern.toString() })
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
      getClientIp(request) || "",
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

    const randomBytes = generateRandomBytes(length)
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length]
    }

    return result
  }
}

/**
 * 安全头部配置
 */
export function setSecurityHeaders(
  response: NextResponse,
  options?: { request?: NextRequest; nonce?: string; environment?: string }
): NextResponse {
  const nonce = options?.nonce ?? options?.request?.headers.get("x-nonce") ?? undefined
  const environment = options?.environment ?? process.env.NODE_ENV

  // CSP 头部
  response.headers.set("Content-Security-Policy", generateCSPHeader({ nonce, environment }))

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
  const isDevelopment = process.env.NODE_ENV === "development"

  const normalizeOrigin = (value: string | null): string | null => {
    if (!value) return null
    try {
      return new URL(value).origin
    } catch {
      const trimmed = value.trim().replace(/\/+$/, "")
      return trimmed || null
    }
  }

  const isLocalhost = (value: string | null): boolean => {
    if (!value) return false
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value)
  }

  // 开发环境更宽松的验证
  if (isDevelopment) {
    const normalizedOrigin = normalizeOrigin(origin)
    if (isLocalhost(normalizedOrigin)) {
      return true
    }

    const normalizedReferer = normalizeOrigin(referer)
    if (isLocalhost(normalizedReferer)) {
      return true
    }

    return false
  }

  // 生产/其他环境严格验证
  const siteUrl = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "")
  if (!siteUrl) {
    logger.warn("Origin validation failed: NEXT_PUBLIC_SITE_URL is not configured")
    return false
  }

  const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value))

  const allowedOrigins = Array.from(new Set([siteUrl, ...extraOrigins]))

  const validateOrigin = (testOrigin: string | null): boolean => {
    const normalized = normalizeOrigin(testOrigin)
    if (!normalized) return false
    // 允许 localhost 进行本地生产测试
    if (isLocalhost(normalized)) return true
    return allowedOrigins.includes(normalized)
  }

  if (validateOrigin(origin)) return true
  if (validateOrigin(referer)) return true

  return false
}

/**
 * 速率限制配置
 */
export class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>()
  private static readonly MAX_CAPACITY = (() => {
    if (typeof process === "undefined") return 5000

    const configured = Number(process.env.RATE_LIMIT_MAX_ENTRIES ?? 5000)
    if (!Number.isFinite(configured) || configured <= 0) {
      return 5000
    }

    return configured
  })()
  private static readonly CLEANUP_THRESHOLD = Math.max(
    100,
    Math.floor(RateLimiter.MAX_CAPACITY * 0.8)
  )
  private static readonly CLEANUP_INTERVAL_MS = 60 * 1000
  private static readonly OPERATION_SWEEP_INTERVAL = 500
  private static operationsSinceCleanup = 0
  private static cleanupTimerStarted = false

  /**
   * 检查速率限制
   * 注意：在 E2E 测试环境中（设置 DISABLE_RATE_LIMIT=1）跳过限制
   */
  static checkRateLimit(
    identifier: string,
    limit: number = 100,
    windowMs: number = 15 * 60 * 1000 // 15 分钟
  ): boolean {
    // E2E/开发环境跳过速率限制
    if (process.env.DISABLE_RATE_LIMIT === "1" || process.env.NODE_ENV !== "production") {
      return true
    }

    this.schedulePeriodicCleanup()

    const now = Date.now()
    const record = this.requests.get(identifier)

    if (record) {
      if (now > record.resetTime) {
        this.requests.delete(identifier)
      } else {
        if (record.count >= limit) {
          this.sweepIfNeeded(now)
          return false
        }

        record.count++
        this.sweepIfNeeded(now)
        return true
      }
    }

    if (this.requests.size >= this.MAX_CAPACITY) {
      this.cleanup(now)
      this.enforceCapacity()
    }

    this.requests.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    })

    if (this.requests.size > this.MAX_CAPACITY) {
      this.enforceCapacity()
    }

    this.sweepIfNeeded(now)
    return true
  }

  /**
   * 重置指定标识符的速率限制记录（开发环境使用）
   */
  static resetRateLimit(identifier: string): void {
    this.requests.delete(identifier)
  }

  /**
   * 获取速率限制状态（用于监控和调试）
   */
  static getRateLimitState(identifier: string): { count: number; resetTime: number } | null {
    return this.requests.get(identifier) ?? null
  }

  /**
   * 重置所有速率限制记录（开发环境使用）
   */
  static resetAllRateLimits(): void {
    if (process.env.NODE_ENV === "development") {
      this.requests.clear()
      logger.debug("开发环境已重置所有速率限制记录")
    }
  }

  /**
   * 清理过期记录
   */
  static cleanup(currentTime: number = Date.now()): void {
    const now = currentTime
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key)
      }
    }
  }

  private static isNodeRuntime(): boolean {
    return typeof process !== "undefined" && Boolean(process.versions?.node)
  }

  private static schedulePeriodicCleanup(): void {
    if (this.cleanupTimerStarted || !this.isNodeRuntime()) {
      return
    }

    this.cleanupTimerStarted = true
    const timer = setInterval(() => {
      try {
        this.cleanup()
        this.enforceCapacity()
      } catch (error) {
        logger.warn("RateLimiter cleanup failed", { error })
      }
    }, this.CLEANUP_INTERVAL_MS)

    if (typeof (timer as any).unref === "function") {
      ;(timer as any).unref()
    }
  }

  private static sweepIfNeeded(now: number): void {
    this.operationsSinceCleanup++

    if (
      this.requests.size >= this.CLEANUP_THRESHOLD ||
      this.operationsSinceCleanup >= this.OPERATION_SWEEP_INTERVAL
    ) {
      this.operationsSinceCleanup = 0
      this.cleanup(now)
      this.enforceCapacity()
    }
  }

  private static enforceCapacity(): void {
    if (this.requests.size <= this.MAX_CAPACITY) {
      return
    }

    const overflow = this.requests.size - this.MAX_CAPACITY
    let removed = 0

    for (const key of this.requests.keys()) {
      this.requests.delete(key)
      removed++
      if (removed >= overflow) {
        break
      }
    }
  }
}
