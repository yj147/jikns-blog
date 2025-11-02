/**
 * 安全相关类型定义 - Phase 4 安全增强
 */

import { NextRequest } from "next/server"

/**
 * 安全上下文
 */
export interface SecurityContext {
  /** 请求 ID */
  requestId: string
  /** 客户端 IP */
  clientIP: string
  /** 用户代理 */
  userAgent: string
  /** 会话指纹 */
  sessionFingerprint: string
  /** CSRF 令牌 */
  csrfToken?: string
  /** 请求时间戳 */
  timestamp: number
  /** 用户 ID */
  userId?: string
  /** 用户角色 */
  userRole?: "USER" | "ADMIN"
  /** 会话 ID */
  sessionId?: string
}

/**
 * JWT 令牌载荷
 */
export interface TokenPayload {
  /** 用户 ID */
  sub: string
  /** 用户邮箱 */
  email?: string
  /** 用户角色 */
  role?: "USER" | "ADMIN"
  /** 会话 ID */
  sessionId: string
  /** 令牌类型 */
  type: "access" | "refresh"
  /** 签发时间 */
  iat: number
  /** 过期时间 */
  exp: number
  /** 签发者 */
  iss: string
  /** 受众 */
  aud: string
}

/**
 * 会话数据
 */
export interface SessionData {
  /** 会话 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 会话指纹 */
  fingerprint: string
  /** 创建时间 */
  createdAt: Date
  /** 最后访问时间 */
  lastAccessedAt: Date
  /** 过期时间 */
  expiresAt: Date
  /** 是否活跃 */
  isActive: boolean
  /** 刷新令牌 */
  refreshToken?: string
  /** 元数据 */
  metadata?: {
    userAgent?: string
    ipAddress?: string
    location?: string
  }
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  /** CSRF 配置 */
  csrf: CSRFConfig
  /** XSS 配置 */
  xss: XSSConfig
  /** JWT 配置 */
  jwt: JWTConfig
  /** 速率限制配置 */
  rateLimit: {
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests: boolean
  }
  /** 会话配置 */
  session: {
    maxAge: number
    refreshThreshold: number
    maxConcurrentSessions: number
  }
}

/**
 * CSRF 配置
 */
export interface CSRFConfig {
  /** 令牌名称 */
  tokenName: string
  /** Cookie 名称 */
  cookieName: string
  /** 令牌长度 */
  tokenLength: number
  /** Cookie 选项 */
  cookieOptions: {
    httpOnly: boolean
    secure: boolean
    sameSite: "strict" | "lax" | "none"
    maxAge: number
  }
  /** 跳过验证的路径 */
  skipPaths: string[]
}

/**
 * XSS 配置
 */
export interface XSSConfig {
  /** 允许的HTML标签 */
  allowedTags: string[]
  /** 允许的属性 */
  allowedAttributes: string[]
  /** 禁止的标签 */
  forbiddenTags: string[]
  /** 禁止的属性 */
  forbiddenAttributes: string[]
  /** 最大输入长度 */
  maxInputLength: number
  /** 是否启用严格模式 */
  strictMode: boolean
}

/**
 * JWT 配置
 */
export interface JWTConfig {
  /** 访问令牌密钥 */
  accessTokenSecret: string
  /** 刷新令牌密钥 */
  refreshTokenSecret: string
  /** 访问令牌有效期（秒） */
  accessTokenExpiresIn: number
  /** 刷新令牌有效期（秒） */
  refreshTokenExpiresIn: number
  /** 签发者 */
  issuer: string
  /** 受众 */
  audience: string
  /** 算法 */
  algorithm: "HS256" | "HS384" | "HS512"
}

/**
 * 安全头部
 */
export interface SecurityHeaders {
  /** 内容安全策略 */
  contentSecurityPolicy?: string
  /** XSS保护 */
  xssProtection?: string
  /** 内容类型选项 */
  contentTypeOptions?: string
  /** 框架选项 */
  frameOptions?: string
  /** 严格传输安全 */
  strictTransportSecurity?: string
  /** 引用策略 */
  referrerPolicy?: string
  /** 权限策略 */
  permissionsPolicy?: string
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  /** 是否被限制 */
  isLimited: boolean
  /** 剩余请求数 */
  remaining: number
  /** 限制重置时间 */
  resetTime: number
  /** 总限制数 */
  limit: number
}

/**
 * 安全验证结果
 */
export interface SecurityValidationResult {
  /** 是否通过验证 */
  isValid: boolean
  /** 错误代码 */
  errorCode?: string
  /** 错误消息 */
  errorMessage?: string
  /** 附加数据 */
  data?: any
}

/**
 * 会话验证选项
 */
export interface SessionValidationOptions {
  /** 是否检查指纹 */
  checkFingerprint: boolean
  /** 是否更新最后访问时间 */
  updateLastAccessed: boolean
  /** 是否延长会话 */
  extendSession: boolean
}

/**
 * 令牌刷新结果
 */
export interface TokenRefreshResult {
  /** 新的访问令牌 */
  accessToken: string
  /** 新的刷新令牌 */
  refreshToken?: string
  /** 过期时间 */
  expiresIn: number
  /** 令牌类型 */
  tokenType: "Bearer"
}

/**
 * 输入清理选项
 */
export interface SanitizeOptions {
  /** 允许的HTML */
  allowHtml: boolean
  /** 移除脚本 */
  removeScripts: boolean
  /** 移除样式 */
  removeStyles: boolean
  /** 移除链接 */
  removeLinks: boolean
  /** 最大长度 */
  maxLength?: number
  /** 自定义过滤器 */
  customFilters?: Array<(input: string) => string>
}

/**
 * 内容验证规则
 */
export interface ContentValidationRule {
  /** 规则名称 */
  name: string
  /** 验证函数 */
  validate: (input: string) => boolean
  /** 错误消息 */
  errorMessage: string
  /** 严重级别 */
  severity: "low" | "medium" | "high" | "critical"
}

/**
 * 安全事件类型
 */
export type SecurityEventType =
  | "csrf_validation_failed"
  | "xss_attempt_detected"
  | "rate_limit_exceeded"
  | "session_hijack_detected"
  | "invalid_origin"
  | "token_expired"
  | "unauthorized_access"
  | "suspicious_activity"

/**
 * 安全事件
 */
export interface SecurityEvent {
  /** 事件类型 */
  type: SecurityEventType
  /** 严重级别 */
  severity: "low" | "medium" | "high" | "critical"
  /** 事件描述 */
  description: string
  /** 请求信息 */
  request: {
    method: string
    url: string
    headers: Record<string, string>
    ip: string
    userAgent: string
  }
  /** 用户信息 */
  user?: {
    id: string
    email: string
    role: string
  }
  /** 时间戳 */
  timestamp: Date
  /** 附加数据 */
  metadata?: Record<string, any>
}
