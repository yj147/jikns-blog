/**
 * 安全中间件增强 - Phase 4 安全增强
 * 提供统一的安全上下文管理和增强的中间件功能
 */

import { NextRequest, NextResponse } from "next/server"
import type {
  SecurityContext,
  SecurityConfig,
  SecurityEvent,
  SecurityEventType,
  SecurityValidationResult,
} from "./types"
import { JWTSecurity, TokenRefreshManager, SessionStore } from "./jwt-security"
import {
  CSRFProtection,
  XSSProtection,
  RateLimiter,
  setSecurityHeaders,
  validateRequestOrigin,
} from "@/lib/security"

/**
 * 安全中间件类
 */
export class SecurityMiddleware {
  private static readonly config: SecurityConfig = {
    csrf: {
      tokenName: "X-CSRF-Token",
      cookieName: "csrf-token",
      tokenLength: 32,
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24小时
      },
      skipPaths: ["/api/auth/callback", "/api/health", "/api/webhooks", "/api/dev"],
    },
    xss: {
      allowedTags: [
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
      allowedAttributes: ["href", "title", "target"],
      forbiddenTags: ["script", "object", "embed", "iframe", "form"],
      forbiddenAttributes: ["onload", "onerror", "onclick", "onmouseover"],
      maxInputLength: 10000,
      strictMode: process.env.NODE_ENV === "production",
    },
    jwt: {
      accessTokenSecret: process.env.JWT_ACCESS_SECRET || "default-access-secret",
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
      accessTokenExpiresIn: 15 * 60, // 15分钟
      refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7天
      issuer: process.env.JWT_ISSUER || "jikns-blog",
      audience: process.env.JWT_AUDIENCE || "jikns-blog-users",
      algorithm: "HS256",
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分钟
      maxRequests: 100,
      skipSuccessfulRequests: false,
    },
    session: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      refreshThreshold: 30 * 60 * 1000, // 30分钟
      maxConcurrentSessions: 5,
    },
  }

  /**
   * 核心安全中间件处理器
   */
  static async processSecurityChecks(
    request: NextRequest,
    context: SecurityContext
  ): Promise<NextResponse | null> {
    const pathname = request.nextUrl.pathname

    try {
      // 1. 速率限制检查
      const rateLimitResult = await this.checkRateLimit(request, context)
      if (rateLimitResult) return rateLimitResult

      // 2. 请求来源验证
      const originValidationResult = await this.validateOrigin(request, pathname)
      if (originValidationResult) return originValidationResult

      // 3. CSRF 保护检查
      const csrfValidationResult = await this.validateCSRF(request, pathname)
      if (csrfValidationResult) return csrfValidationResult

      // 4. JWT 令牌处理
      const tokenValidationResult = await this.processJWTTokens(request, context)
      if (tokenValidationResult) return tokenValidationResult

      // 5. 会话验证
      const sessionValidationResult = await this.validateSession(request, context)
      if (sessionValidationResult) return sessionValidationResult

      return null // 所有检查通过
    } catch (error) {
      console.error("安全中间件处理错误:", error)
      this.logSecurityEvent("suspicious_activity", "high", request, {
        error: error instanceof Error ? error.message : "未知错误",
        context,
      })

      return NextResponse.json(
        {
          error: "安全检查失败",
          code: "SECURITY_CHECK_FAILED",
        },
        { status: 500 }
      )
    }
  }

  /**
   * 速率限制检查
   */
  private static async checkRateLimit(
    request: NextRequest,
    context: SecurityContext
  ): Promise<NextResponse | null> {
    const pathname = request.nextUrl.pathname

    // 开发环境使用更宽松的限制
    let maxRequests = this.config.rateLimit.maxRequests
    let windowMs = this.config.rateLimit.windowMs

    if (process.env.NODE_ENV === "development") {
      // 开发环境：更高的请求限制，更短的窗口期
      maxRequests = 1000 // 开发环境允许大量请求
      windowMs = 5 * 60 * 1000 // 5分钟窗口期
    } else if (
      pathname.includes("/api/user") ||
      pathname.includes("/auth/") ||
      pathname.includes("/logout")
    ) {
      // 生产环境认证相关路径的优化设置
      maxRequests = 200 // 认证相关操作允许更多请求
      windowMs = 10 * 60 * 1000 // 缩短窗口期到10分钟
    }

    const isLimited = !RateLimiter.checkRateLimit(context.clientIP, maxRequests, windowMs)

    if (isLimited) {
      this.logSecurityEvent("rate_limit_exceeded", "medium", request, {
        clientIP: context.clientIP,
        userAgent: context.userAgent,
      })

      return NextResponse.json(
        {
          error: "请求过于频繁，请稍后重试",
          code: "RATE_LIMITED",
          retryAfter: Math.ceil(windowMs / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(windowMs / 1000).toString(),
          },
        }
      )
    }

    return null
  }

  /**
   * 请求来源验证
   */
  private static async validateOrigin(
    request: NextRequest,
    pathname: string
  ): Promise<NextResponse | null> {
    const requiresOriginCheck = request.method !== "GET" && this.isProtectedPath(pathname)

    if (requiresOriginCheck && !validateRequestOrigin(request)) {
      this.logSecurityEvent("invalid_origin", "high", request, {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
      })

      return NextResponse.json(
        {
          error: "无效的请求来源",
          code: "INVALID_ORIGIN",
        },
        { status: 403 }
      )
    }

    return null
  }

  /**
   * CSRF 验证
   */
  private static async validateCSRF(
    request: NextRequest,
    pathname: string
  ): Promise<NextResponse | null> {
    const requiresCSRFCheck = this.requiresCSRFValidation(request, pathname)

    if (requiresCSRFCheck && !CSRFProtection.validateToken(request)) {
      this.logSecurityEvent("csrf_validation_failed", "high", request, {
        pathname,
        method: request.method,
      })

      return NextResponse.json(
        {
          error: "CSRF 验证失败",
          code: "CSRF_INVALID",
        },
        { status: 403 }
      )
    }

    return null
  }

  /**
   * JWT 令牌处理
   */
  private static async processJWTTokens(
    request: NextRequest,
    context: SecurityContext
  ): Promise<NextResponse | null> {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null // 没有JWT令牌，跳过JWT验证
    }

    const token = authHeader.substring(7)
    const validation = JWTSecurity.validateAccessToken(token)

    if (!validation.isValid) {
      // 尝试使用刷新令牌
      const refreshToken = request.cookies.get("refresh_token")?.value
      if (refreshToken) {
        const refreshResult = await TokenRefreshManager.refreshAccessToken(
          refreshToken,
          SessionStore
        )

        if (refreshResult) {
          // 令牌刷新成功，在响应中设置新令牌
          const response = NextResponse.next()
          response.headers.set("X-New-Access-Token", refreshResult.accessToken)
          if (refreshResult.refreshToken) {
            response.cookies.set("refresh_token", refreshResult.refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: this.config.jwt.refreshTokenExpiresIn,
            })
          }
          return response
        }
      }

      this.logSecurityEvent("token_expired", "low", request, {
        reason: validation.errorMessage,
      })

      return NextResponse.json(
        {
          error: "访问令牌无效或已过期",
          code: validation.errorCode,
        },
        { status: 401 }
      )
    }

    // 更新安全上下文
    const tokenPayload = validation.data as any
    context.userId = tokenPayload.sub
    context.userRole = tokenPayload.role
    context.sessionId = tokenPayload.sessionId

    return null
  }

  /**
   * 会话验证
   */
  private static async validateSession(
    request: NextRequest,
    context: SecurityContext
  ): Promise<NextResponse | null> {
    if (!context.sessionId || !context.sessionFingerprint) {
      return null // 没有会话信息，跳过会话验证
    }

    const validation = await SessionStore.validateSession(
      context.sessionId,
      context.sessionFingerprint,
      {
        checkFingerprint: true,
        updateLastAccessed: true,
        extendSession: false,
      }
    )

    if (!validation.isValid) {
      if (validation.errorCode === "SESSION_HIJACK_DETECTED") {
        this.logSecurityEvent("session_hijack_detected", "critical", request, {
          sessionId: context.sessionId,
          expectedFingerprint: context.sessionFingerprint,
        })
      }

      return NextResponse.json(
        {
          error: "会话验证失败",
          code: validation.errorCode,
        },
        { status: 401 }
      )
    }

    return null
  }

  /**
   * 检查路径是否需要保护
   */
  private static isProtectedPath(pathname: string): boolean {
    const protectedPaths = ["/admin", "/api/admin", "/api/user", "/profile", "/settings"]

    return protectedPaths.some((path) => pathname.startsWith(path))
  }

  /**
   * 检查是否需要CSRF验证
   */
  private static requiresCSRFValidation(request: NextRequest, pathname: string): boolean {
    // 跳过GET请求和配置中的路径
    if (request.method === "GET") return false
    if (this.config.csrf.skipPaths.some((path) => pathname.startsWith(path))) return false

    // 跳过Next.js Server Actions - 它们有自己的安全机制
    const nextAction = request.headers.get("next-action")
    if (nextAction) {
      console.log("跳过Server Action的CSRF验证:", pathname, nextAction)
      return false
    }

    // 开发环境更宽松的CSRF验证
    if (process.env.NODE_ENV === "development") {
      // 开发环境跳过管理员页面的CSRF验证，因为有其他安全层保护
      if (pathname.startsWith("/admin")) {
        console.log("开发环境跳过管理员页面CSRF验证:", pathname)
        return false
      }
    }

    // 状态变更请求需要CSRF验证
    return ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
  }

  /**
   * 记录安全事件
   */
  private static logSecurityEvent(
    type: SecurityEventType,
    severity: "low" | "medium" | "high" | "critical",
    request: NextRequest,
    metadata?: any
  ): void {
    const event: SecurityEvent = {
      type,
      severity,
      description: this.getEventDescription(type),
      request: {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      },
      timestamp: new Date(),
      metadata,
    }

    // 在生产环境中，这里应该发送到日志系统
    if (severity === "critical" || severity === "high") {
      console.warn(`🚨 安全事件 [${severity.toUpperCase()}]: ${type}`, event)
    } else {
    }

    // TODO: 集成外部安全监控系统
    // await SecurityMonitor.reportEvent(event)
  }

  /**
   * 获取事件描述
   */
  private static getEventDescription(type: SecurityEventType): string {
    const descriptions = {
      csrf_validation_failed: "CSRF 令牌验证失败",
      xss_attempt_detected: "检测到XSS攻击尝试",
      rate_limit_exceeded: "请求频率超过限制",
      session_hijack_detected: "检测到会话劫持",
      invalid_origin: "无效的请求来源",
      token_expired: "JWT令牌已过期",
      unauthorized_access: "未授权访问",
      suspicious_activity: "可疑活动",
    }
    return descriptions[type] || "未知安全事件"
  }
}

/**
 * 创建安全上下文
 */
export function createSecurityContext(request: NextRequest): SecurityContext {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  const userAgent = request.headers.get("user-agent") || "unknown"

  // 生成请求ID
  const requestId = generateRequestId()

  // 生成会话指纹
  const sessionFingerprint = generateSessionFingerprint(request)

  return {
    requestId,
    clientIP,
    userAgent,
    sessionFingerprint,
    csrfToken: request.headers.get("X-CSRF-Token") || undefined,
    timestamp: Date.now(),
  }
}

/**
 * 验证安全头部
 */
export function validateSecurityHeaders(request: NextRequest): SecurityValidationResult {
  const requiredHeaders = ["user-agent"]
  const missingHeaders: string[] = []

  for (const header of requiredHeaders) {
    if (!request.headers.get(header)) {
      missingHeaders.push(header)
    }
  }

  if (missingHeaders.length > 0) {
    return {
      isValid: false,
      errorCode: "MISSING_SECURITY_HEADERS",
      errorMessage: `缺少必需的安全头部: ${missingHeaders.join(", ")}`,
    }
  }

  // 检查可疑的用户代理
  const userAgent = request.headers.get("user-agent") || ""
  const suspiciousPatterns = [
    /bot|crawler|spider/i,
    /curl|wget|python|java/i,
    /scanner|hack|exploit/i,
  ]

  const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(userAgent))
  if (isSuspicious && process.env.NODE_ENV === "production") {
    return {
      isValid: false,
      errorCode: "SUSPICIOUS_USER_AGENT",
      errorMessage: "检测到可疑的用户代理",
    }
  }

  return { isValid: true }
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * 生成会话指纹
 */
function generateSessionFingerprint(request: NextRequest): string {
  const components = [
    request.headers.get("user-agent") || "",
    request.headers.get("accept-language") || "",
    request.headers.get("accept-encoding") || "",
  ]

  // 简单哈希算法（Edge Runtime兼容）
  let hash = 0
  const str = components.join("|")
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 转换为32位整数
  }
  return Math.abs(hash).toString(16)
}
