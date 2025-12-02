/**
 * 安全配置管理 - Phase 4 安全增强
 * 统一管理所有安全相关的配置项
 */

import type { SecurityConfig, CSRFConfig, XSSConfig, JWTConfig } from "./types"
import { logger } from "../utils/logger"

/**
 * 环境变量验证
 */
function validateEnvironment() {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]

  const missing = required.filter((env) => !process.env[env])

  if (missing.length > 0) {
    logger.warn("缺少必需的环境变量", { missing })
  }

  return missing.length === 0
}

/**
 * 默认安全配置
 */
export const defaultSecurityConfig: SecurityConfig = {
  csrf: {
    tokenName: "X-CSRF-Token",
    cookieName: "csrf-token",
    tokenLength: 32,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24小时
    },
    skipPaths: [
      "/api/auth/callback",
      "/api/auth/signin",
      "/api/auth/signout",
      "/api/health",
      "/api/webhooks",
      "/auth/callback",
      "/api/csrf-token",
      "/api/subscribe",
      "/api/subscribe/verify",
      "/api/subscribe/unsubscribe",
      "/api/cron/email-queue",
    ],
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
      "span",
      "div",
    ],
    allowedAttributes: ["href", "title", "target", "class", "id", "data-*"],
    forbiddenTags: [
      "script",
      "object",
      "embed",
      "iframe",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "meta",
      "link",
      "style",
      "base",
      "applet",
      "frame",
      "frameset",
    ],
    forbiddenAttributes: [
      "onload",
      "onerror",
      "onclick",
      "onmouseover",
      "onmouseout",
      "onchange",
      "onsubmit",
      "onfocus",
      "onblur",
      "onkeyup",
      "onkeydown",
      "onkeypress",
      "onabort",
      "oncanplay",
      "oncanplaythrough",
      "ondurationchange",
      "onemptied",
      "onended",
      "onloadeddata",
      "onloadedmetadata",
      "onpause",
      "onplay",
      "onplaying",
      "onprogress",
      "onratechange",
      "onseeked",
      "onseeking",
      "onstalled",
      "onsuspend",
      "ontimeupdate",
      "onvolumechange",
      "onwaiting",
    ],
    maxInputLength: 50000,
    strictMode: process.env.NODE_ENV === "production",
  },

  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || generateFallbackSecret("access"),
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || generateFallbackSecret("refresh"),
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
 * 开发环境安全配置（较宽松）
 */
export const developmentSecurityConfig: Partial<SecurityConfig> = {
  csrf: {
    ...defaultSecurityConfig.csrf,
    cookieOptions: {
      ...defaultSecurityConfig.csrf.cookieOptions,
      secure: false, // 开发环境允许HTTP
    },
  },

  xss: {
    ...defaultSecurityConfig.xss,
    strictMode: false,
    maxInputLength: 100000, // 开发环境允许更长的输入
  },

  rateLimit: {
    ...defaultSecurityConfig.rateLimit,
    maxRequests: 1000, // 开发环境更宽松的限制
    windowMs: 60 * 1000, // 1分钟
  },
}

/**
 * 生产环境安全配置（严格）
 */
export const productionSecurityConfig: Partial<SecurityConfig> = {
  csrf: {
    ...defaultSecurityConfig.csrf,
    cookieOptions: {
      ...defaultSecurityConfig.csrf.cookieOptions,
      secure: true,
      sameSite: "strict",
    },
  },

  xss: {
    ...defaultSecurityConfig.xss,
    strictMode: true,
    allowedTags: [
      // 生产环境更严格的标签限制
      "p",
      "br",
      "strong",
      "em",
      "code",
      "pre",
      "blockquote",
    ],
    allowedAttributes: ["href", "title"], // 最小化允许的属性
  },

  jwt: {
    ...defaultSecurityConfig.jwt,
    accessTokenExpiresIn: 5 * 60, // 生产环境更短的访问令牌有效期：5分钟
  },

  rateLimit: {
    ...defaultSecurityConfig.rateLimit,
    maxRequests: 60, // 生产环境更严格的限制
    windowMs: 15 * 60 * 1000,
  },
}

/**
 * 获取当前环境的安全配置
 */
export function getSecurityConfig(): SecurityConfig {
  const baseConfig = defaultSecurityConfig

  if (process.env.NODE_ENV === "production") {
    return {
      ...baseConfig,
      ...productionSecurityConfig,
    }
  }

  if (process.env.NODE_ENV === "development") {
    return {
      ...baseConfig,
      ...developmentSecurityConfig,
    }
  }

  return baseConfig
}

/**
 * 路径特定的安全配置
 */
export const pathSecurityConfigs = {
  // API 路径配置
  "/api/admin": {
    requireAuth: true,
    requireAdmin: true,
    validateCSRF: true,
    rateLimit: { maxRequests: 200, windowMs: 15 * 60 * 1000 },
  },

  "/api/user": {
    requireAuth: true,
    validateCSRF: true,
    rateLimit: { maxRequests: 300, windowMs: 15 * 60 * 1000 },
  },

  "/api/public": {
    requireAuth: false,
    validateCSRF: false,
    rateLimit: { maxRequests: 100, windowMs: 15 * 60 * 1000 },
  },

  "/api/auth": {
    requireAuth: false,
    validateCSRF: false, // 认证端点通常不需要CSRF
    rateLimit: { maxRequests: 20, windowMs: 5 * 60 * 1000 }, // 认证更严格的限制
  },

  // 页面路径配置
  "/admin": {
    requireAuth: true,
    requireAdmin: true,
    validateCSRF: true,
  },

  "/profile": {
    requireAuth: true,
    validateCSRF: true,
  },
} as const

/**
 * 安全头部配置
 */
export const securityHeaders = {
  // 基础安全头部
  base: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  },

  // 生产环境额外头部
  production: {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": generateCSP(),
  },
}

/**
 * 生成内容安全策略
 */
function generateCSP(): string {
  const cspDirectives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
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
      "https://*.supabase.co",
      "https://avatars.githubusercontent.com",
    ],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      "https://*.supabase.co",
      ...(process.env.NODE_ENV === "development"
        ? ["http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"]
        : []),
    ],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  }

  return Object.entries(cspDirectives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ")
}

/**
 * 生成回退密钥（仅用于开发环境）
 */
function generateFallbackSecret(type: string): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`生产环境必须设置JWT密钥: JWT_${type.toUpperCase()}_SECRET`)
  }

  logger.warn("使用默认 JWT 密钥", { type })
  return `default-${type}-secret-${process.env.NODE_ENV || "development"}-change-in-production`
}

/**
 * 验证安全配置
 */
export function validateSecurityConfig(config: SecurityConfig): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 验证JWT配置
  if (!config.jwt.accessTokenSecret || config.jwt.accessTokenSecret.length < 32) {
    errors.push("JWT访问令牌密钥过短，至少需要32个字符")
  }

  if (!config.jwt.refreshTokenSecret || config.jwt.refreshTokenSecret.length < 32) {
    errors.push("JWT刷新令牌密钥过短，至少需要32个字符")
  }

  if (config.jwt.accessTokenExpiresIn < 60) {
    errors.push("JWT访问令牌有效期过短，至少需要60秒")
  }

  // 验证CSRF配置
  if (config.csrf.tokenLength < 16) {
    errors.push("CSRF令牌长度过短，至少需要16个字符")
  }

  // 验证XSS配置
  if (config.xss.maxInputLength < 1000) {
    errors.push("XSS最大输入长度过短，至少需要1000个字符")
  }

  // 验证速率限制配置
  if (config.rateLimit.maxRequests < 10) {
    errors.push("速率限制过于严格，至少允许10个请求")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 初始化安全配置
 */
export function initializeSecurityConfig(): SecurityConfig {
  // 验证环境变量
  const envValid = validateEnvironment()
  if (!envValid && process.env.NODE_ENV === "production") {
    throw new Error("生产环境缺少必需的环境变量")
  }

  const config = getSecurityConfig()

  // 验证配置
  const validation = validateSecurityConfig(config)
  if (!validation.isValid) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`安全配置无效: ${validation.errors.join(", ")}`)
    } else {
      logger.warn("安全配置警告", { errors: validation.errors })
    }
  }
  return config
}

// 导出初始化后的配置
export const securityConfig = initializeSecurityConfig()
