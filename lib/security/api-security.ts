/**
 * API 路由安全装饰器 - Phase 4 安全增强
 * 为API路由提供统一的安全防护装饰器和中间件
 */

import { NextRequest, NextResponse } from "next/server"
import type { SecurityValidationResult, SecurityContext } from "./types"
import { SecurityMiddleware, createSecurityContext } from "./middleware"
import { AdvancedXSSCleaner, ContentValidator, InputSanitizer } from "./xss-cleaner"
import { JWTSecurity } from "./jwt-security"
import { logger } from "@/lib/utils/logger"

/**
 * API 安全配置选项
 */
interface ApiSecurityOptions {
  /** 是否需要认证 */
  requireAuth?: boolean
  /** 是否需要管理员权限 */
  requireAdmin?: boolean
  /** 是否验证CSRF */
  validateCSRF?: boolean
  /** 是否清理输入 */
  sanitizeInput?: boolean
  /** 速率限制配置 */
  rateLimit?: {
    maxRequests: number
    windowMs: number
  }
  /** 允许的HTTP方法 */
  allowedMethods?: string[]
  /** 自定义验证函数 */
  customValidation?: (
    request: NextRequest,
    context: SecurityContext
  ) => Promise<SecurityValidationResult>
}

/**
 * API 处理函数类型
 */
type ApiHandler = (request: NextRequest, context?: any) => Promise<NextResponse>

/**
 * 安全的API处理器装饰器
 */
export function withApiSecurity(handler: ApiHandler, options: ApiSecurityOptions = {}) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = performance.now()

    try {
      // 1. 创建安全上下文
      const securityContext = createSecurityContext(request)

      // 2. 检查HTTP方法
      if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
        return createErrorResponse(405, "METHOD_NOT_ALLOWED", "不允许的HTTP方法")
      }

      // 3. 执行核心安全检查
      const securityResult = await SecurityMiddleware.processSecurityChecks(
        request,
        securityContext
      )

      if (securityResult) {
        return securityResult
      }

      // 4. 自定义验证
      if (options.customValidation) {
        const customResult = await options.customValidation(request, securityContext)
        if (!customResult.isValid) {
          return createErrorResponse(
            400,
            customResult.errorCode || "CUSTOM_VALIDATION_FAILED",
            customResult.errorMessage || "自定义验证失败"
          )
        }
      }

      // 5. 认证检查
      if (options.requireAuth || options.requireAdmin) {
        const authResult = await validateAuthentication(request, options.requireAdmin)
        if (!authResult.isValid) {
          return createErrorResponse(
            401,
            authResult.errorCode || "UNAUTHORIZED",
            authResult.errorMessage || "认证失败"
          )
        }

        // 将用户信息添加到安全上下文
        securityContext.userId = authResult.data?.userId
        securityContext.userRole = authResult.data?.role
      }

      // 6. 输入清理
      if (options.sanitizeInput && ["POST", "PUT", "PATCH"].includes(request.method)) {
        const sanitizedRequest = await sanitizeRequestBody(request)
        if (!sanitizedRequest) {
          return createErrorResponse(400, "INVALID_INPUT", "请求体包含无效内容")
        }
        // 注意：NextRequest 是只读的，我们只能在处理器中使用清理后的数据
      }

      // 7. 执行原始处理器
      const response = await handler(request, { ...context, security: securityContext })

      // 8. 记录性能指标
      const endTime = performance.now()
      const duration = endTime - startTime

      if (duration > 1000) {
        logger.warn("API 响应时间过长", { url: request.url, duration: duration.toFixed(2) })
      }

      // 9. 添加安全响应头
      response.headers.set("X-Request-ID", securityContext.requestId)
      response.headers.set("X-Content-Type-Options", "nosniff")
      response.headers.set("X-Frame-Options", "DENY")

      return response
    } catch (error) {
      logger.error("API 安全装饰器错误", { url: request.url }, error)
      return createErrorResponse(500, "INTERNAL_ERROR", "服务器内部错误")
    }
  }
}

/**
 * 认证验证
 */
async function validateAuthentication(
  request: NextRequest,
  requireAdmin: boolean = false
): Promise<SecurityValidationResult> {
  const authHeader = request.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      isValid: false,
      errorCode: "MISSING_TOKEN",
      errorMessage: "缺少访问令牌",
    }
  }

  const token = authHeader.substring(7)
  const tokenValidation = JWTSecurity.validateAccessToken(token)

  if (!tokenValidation.isValid) {
    return tokenValidation
  }

  const payload = tokenValidation.data as any

  if (requireAdmin && payload.role !== "ADMIN") {
    return {
      isValid: false,
      errorCode: "INSUFFICIENT_PERMISSIONS",
      errorMessage: "需要管理员权限",
    }
  }

  return {
    isValid: true,
    data: {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    },
  }
}

/**
 * 请求体清理
 */
async function sanitizeRequestBody(request: NextRequest): Promise<boolean> {
  try {
    const contentType = request.headers.get("content-type")

    if (!contentType) {
      return true
    }

    if (contentType.includes("application/json")) {
      const body = await request.text()

      // 验证JSON结构安全性
      const validation = ContentValidator.validateContent(body)
      if (!validation.isValid) {
        logger.warn("请求体包含危险内容", { error: validation.errorMessage })
        return false
      }

      try {
        const data = JSON.parse(body)
        const sanitized = InputSanitizer.sanitizeObject(data)

        // 这里我们只能验证，不能修改请求
        // 实际的清理需要在处理器中进行
        return Object.keys(sanitized).length > 0
      } catch {
        return false
      }
    }

    if (
      contentType.includes("text/") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const body = await request.text()
      const validation = ContentValidator.validateContent(body)
      return validation.isValid
    }

    return true
  } catch (error) {
    logger.error("请求体清理错误", {}, error)
    return false
  }
}

/**
 * 创建错误响应
 */
function createErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    },
    {
      status,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    }
  )
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    }
  )
}

/**
 * 预定义的安全配置
 */
export const SecurityConfigs = {
  /** 公开API（无需认证） */
  public: {
    requireAuth: false,
    validateCSRF: false,
    sanitizeInput: true,
    rateLimit: { maxRequests: 100, windowMs: 15 * 60 * 1000 },
  },

  /** 需要认证的API */
  authenticated: {
    requireAuth: true,
    validateCSRF: true,
    sanitizeInput: true,
    rateLimit: { maxRequests: 200, windowMs: 15 * 60 * 1000 },
  },

  /** 管理员API */
  admin: {
    requireAuth: true,
    requireAdmin: true,
    validateCSRF: true,
    sanitizeInput: true,
    rateLimit: { maxRequests: 500, windowMs: 15 * 60 * 1000 },
  },

  /** 只读API */
  readOnly: {
    requireAuth: true,
    validateCSRF: false,
    sanitizeInput: false,
    allowedMethods: ["GET", "HEAD"],
    rateLimit: { maxRequests: 300, windowMs: 15 * 60 * 1000 },
  },

  /** 写入API */
  writeOnly: {
    requireAuth: true,
    validateCSRF: true,
    sanitizeInput: true,
    allowedMethods: ["POST", "PUT", "PATCH", "DELETE"],
    rateLimit: { maxRequests: 100, windowMs: 15 * 60 * 1000 },
  },
} as const

/**
 * Server Action 安全装饰器
 */
export function withServerActionSecurity<T extends any[], R>(
  action: (...args: T) => Promise<R>,
  options: Omit<ApiSecurityOptions, "allowedMethods"> = {}
) {
  return async (...args: T): Promise<R> => {
    try {
      // 对于 Server Actions，我们需要从不同的上下文获取请求信息
      // 这里简化处理，主要做输入清理和基础验证

      if (options.sanitizeInput && args.length > 0) {
        // 清理输入参数
        const sanitizedArgs = args.map((arg) => {
          if (typeof arg === "string") {
            return InputSanitizer.sanitizeUserInput(arg, "text")
          }
          if (typeof arg === "object" && arg !== null) {
            return InputSanitizer.sanitizeObject(arg)
          }
          return arg
        })

        // 验证清理后的参数
        const hasValidArgs = sanitizedArgs.every((arg) => arg !== null)
        if (!hasValidArgs) {
          throw new Error("输入参数包含无效内容")
        }

        return action(...(sanitizedArgs as T))
      }

      return action(...args)
    } catch (error) {
      logger.error("Server Action 安全装饰器错误", {}, error)
      throw error
    }
  }
}

/**
 * 批量API安全验证
 */
export async function validateBatchApiRequests(
  requests: Array<{
    request: NextRequest
    options: ApiSecurityOptions
  }>,
  maxConcurrent: number = 5
): Promise<Array<SecurityValidationResult>> {
  const results: Array<SecurityValidationResult> = []

  // 分批处理请求以避免过载
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const batch = requests.slice(i, i + maxConcurrent)

    const batchResults = await Promise.all(
      batch.map(async ({ request, options }) => {
        try {
          const securityContext = createSecurityContext(request)
          const securityResult = await SecurityMiddleware.processSecurityChecks(
            request,
            securityContext
          )

          if (securityResult) {
            return {
              isValid: false,
              errorCode: "SECURITY_CHECK_FAILED",
              errorMessage: "安全检查失败",
            }
          }

          return { isValid: true }
        } catch (error) {
          return {
            isValid: false,
            errorCode: "VALIDATION_ERROR",
            errorMessage: error instanceof Error ? error.message : "未知错误",
          }
        }
      })
    )

    results.push(...batchResults)
  }

  return results
}
