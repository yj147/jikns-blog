/**
 * 共享执行管线
 *
 * 为 API 路由和 Server Action 提供统一的执行流程，包括：
 * - 认证检查
 * - 速率限制
 * - 审计日志
 * - 性能监控
 * - 错误映射
 *
 * 遵循 Linus 原则：DRY（Don't Repeat Yourself）
 * 避免 API 和 Server Action 的逻辑漂移
 */

import type { NextRequest } from "next/server"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"

/**
 * 请求上下文
 */
export interface RequestContext {
  requestId: string
  ip: string
  ua: string
  path?: string
}

/**
 * 认证结果
 */
export interface AuthResult {
  success: boolean
  userId?: string
  error?: {
    code: string
    message: string
    statusCode?: number
  }
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  success: boolean
  message?: string
  backend?: string
  resetTime?: Date
}

/**
 * 审计日志配置
 */
export interface AuditConfig {
  action: string
  resource: string
  userId?: string
  success: boolean
  errorMessage?: string
  details?: Record<string, any>
}

/**
 * 性能监控配置
 */
export interface PerformanceConfig {
  timerId: string
  metricType: MetricType
  context?: Record<string, any>
}

/**
 * 执行管线配置
 */
export interface PipelineConfig {
  /**
   * 认证检查函数
   */
  authenticate: () => Promise<AuthResult>

  /**
   * 速率限制检查函数
   */
  checkRateLimit: () => Promise<RateLimitResult>

  /**
   * 业务逻辑处理函数
   */
  handler: () => Promise<any>

  /**
   * 审计日志配置
   */
  audit: Omit<AuditConfig, "success" | "errorMessage" | "userId">

  /**
   * 性能监控配置
   */
  performance: PerformanceConfig

  /**
   * 请求上下文
   */
  context: RequestContext
}

/**
 * 执行管线结果
 */
export interface PipelineResult<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    statusCode?: number
  }
}

/**
 * 记录审计日志
 */
async function logAudit(config: AuditConfig, context: RequestContext): Promise<void> {
  await auditLogger.logEvent({
    action: config.action,
    resource: config.resource,
    success: config.success,
    errorMessage: config.errorMessage,
    userId: config.userId,
    ipAddress: context.ip,
    userAgent: context.ua,
    requestId: context.requestId,
    details: config.details,
  })
}

/**
 * 执行统一的操作管线
 *
 * 流程：
 * 1. 启动性能监控
 * 2. 认证检查
 * 3. 速率限制检查
 * 4. 执行业务逻辑
 * 5. 记录审计日志
 * 6. 结束性能监控
 *
 * @param config - 管线配置
 * @returns 执行结果
 */
export async function executeActionPipeline<T>(config: PipelineConfig): Promise<PipelineResult<T>> {
  const { authenticate, checkRateLimit, handler, audit, performance, context } = config

  // 1. 启动性能监控
  performanceMonitor.startTimer(performance.timerId, performance.context)

  try {
    // 2. 认证检查
    const authResult = await authenticate()
    if (!authResult.success) {
      await logAudit(
        {
          ...audit,
          success: false,
          errorMessage: authResult.error?.message || "认证失败",
        },
        context
      )

      performanceMonitor.endTimer(performance.timerId, performance.metricType, {
        ...performance.context,
        authFailed: true,
      })

      return {
        success: false,
        error: authResult.error || {
          code: "UNAUTHORIZED",
          message: "认证失败",
          statusCode: 401,
        },
      }
    }

    // 3. 速率限制检查
    const rateLimitResult = await checkRateLimit()
    if (!rateLimitResult.success) {
      await logAudit(
        {
          ...audit,
          userId: authResult.userId,
          success: false,
          errorMessage: rateLimitResult.message || "操作过于频繁",
          details: {
            rateLimited: true,
            backend: rateLimitResult.backend,
          },
        },
        context
      )

      performanceMonitor.endTimer(performance.timerId, performance.metricType, {
        ...performance.context,
        rateLimited: true,
      })

      return {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: rateLimitResult.message || "操作过于频繁，请稍后再试",
          statusCode: 429,
        },
      }
    }

    // 4. 执行业务逻辑
    const result = await handler()

    // 5. 记录成功审计日志
    await logAudit(
      {
        ...audit,
        userId: authResult.userId,
        success: true,
      },
      context
    ).catch((auditError) => {
      logger.warn("审计日志记录失败", { requestId: context.requestId, error: auditError })
    })

    // 6. 结束性能监控
    performanceMonitor.endTimer(performance.timerId, performance.metricType, {
      ...performance.context,
      success: true,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    // 记录失败审计日志
    await logAudit(
      {
        ...audit,
        success: false,
        errorMessage: error instanceof Error ? error.message : "未知错误",
      },
      context
    ).catch((auditError) => {
      logger.warn("审计日志记录失败", { requestId: context.requestId, error: auditError })
    })

    // 结束性能监控
    performanceMonitor.endTimer(performance.timerId, performance.metricType, {
      ...performance.context,
      error: true,
    })

    // 重新抛出错误，由调用方处理
    throw error
  }
}

/**
 * 从 NextRequest 提取请求上下文
 */
export function extractRequestContext(req: NextRequest, requestId: string): RequestContext {
  return {
    requestId,
    ip: getClientIP(req) || "unknown",
    ua: getClientUserAgent(req) || "unknown",
    path: req.nextUrl.pathname,
  }
}
