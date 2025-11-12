import { NextRequest, NextResponse } from "next/server"
import { assertPolicy, generateRequestId } from "@/lib/auth/session"
import { RATE_LIMITS, type RateLimitResult, rateLimitCheck } from "@/lib/rate-limit/activity-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"
import { FollowServiceError } from "@/lib/interactions"
import { type AuthenticatedUser } from "@/lib/auth/session"

export interface FollowHandlerContext {
  request: NextRequest
  targetId: string
  requestId: string
  ip: string | null
  ua: string | null
  user: AuthenticatedUser & { status: "ACTIVE" }
  rateLimit: RateLimitResult
}

export interface FollowHandlerResult {
  response: NextResponse
  auditDetails?: Record<string, unknown>
  performanceContext?: Record<string, unknown>
  rateLimit?: RateLimitResult
}

interface FollowOperationOptions {
  auditAction: "USER_FOLLOW" | "USER_UNFOLLOW"
  metricAction: "follow" | "unfollow"
}

export async function handleFollowOperation(
  request: NextRequest,
  params: { userId: string },
  options: FollowOperationOptions,
  handler: (ctx: FollowHandlerContext) => Promise<FollowHandlerResult>
): Promise<NextResponse> {
  const targetId = params.userId
  const requestId = generateRequestId()
  const ip = getClientIP(request)
  const ua = getClientUserAgent(request)

  const timerId = `${options.metricAction}-${requestId}`
  performanceMonitor.startTimer(timerId, {
    action: options.metricAction,
    targetId,
  })

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError || !user) {
      await auditLogger.logEvent({
        action: options.auditAction,
        resource: `user:${targetId}`,
        success: false,
        errorMessage: authError?.message || "未授权访问",
        ipAddress: ip,
        userAgent: ua,
        requestId,
      })

      performanceMonitor.endTimer(timerId, MetricType.FOLLOW_ACTION_DURATION, {
        action: options.metricAction,
        authFailed: true,
      })

      performanceMonitor.recordMetric({
        type: MetricType.FOLLOW_AUTH_REJECTED,
        value: 1,
        unit: "count",
        timestamp: new Date(),
        context: {
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ip,
          additionalData: {
            requestId,
            errorCode: authError?.code,
          },
        },
      })

      const errorCode = authError ? mapAuthErrorCode(authError) : ErrorCode.FORBIDDEN
      return createErrorResponse(
        errorCode,
        authError?.message || "未授权访问",
        undefined,
        authError?.statusCode,
        { requestId }
      )
    }

    const rateLimit = await rateLimitCheck(request, "follow")
    if (!rateLimit.success) {
      await auditLogger.logEvent({
        action: options.auditAction,
        resource: `user:${targetId}`,
        success: false,
        errorMessage: rateLimit.message || "操作过于频繁",
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        requestId,
        details: {
          rateLimited: true,
          backend: rateLimit.backend,
        },
      })

      performanceMonitor.endTimer(timerId, MetricType.FOLLOW_ACTION_DURATION, {
        action: options.metricAction,
        rateLimited: true,
      })

      performanceMonitor.recordMetric({
        type: MetricType.FOLLOW_RATE_LIMITED,
        value: 1,
        unit: "count",
        timestamp: new Date(),
        context: {
          userId: user.id,
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ip,
          additionalData: {
            backend: rateLimit.backend,
            requestId,
          },
        },
      })

      return createRateLimitResponse(rateLimit, requestId)
    }

    const handlerResult = await handler({
      request,
      targetId,
      requestId,
      ip: ip ?? null,
      ua: ua ?? null,
      user: user as AuthenticatedUser & { status: "ACTIVE" },
      rateLimit,
    })

    performanceMonitor.endTimer(timerId, MetricType.FOLLOW_ACTION_DURATION, {
      action: options.metricAction,
      ...(handlerResult.performanceContext || {}),
    })

    await auditLogger.logEvent({
      action: options.auditAction,
      resource: `user:${targetId}`,
      success: true,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      details: handlerResult.auditDetails,
    })

    applyFollowRateLimitHeaders(handlerResult.response, handlerResult.rateLimit ?? rateLimit)

    return handlerResult.response
  } catch (error) {
    performanceMonitor.endTimer(timerId, MetricType.FOLLOW_ACTION_DURATION, {
      action: options.metricAction,
      error: true,
    })

    if (error instanceof FollowServiceError) {
      const mapped = mapFollowServiceError(error)

      await auditLogger.logEvent({
        action: options.auditAction,
        resource: `user:${targetId}`,
        success: false,
        errorMessage: mapped.message,
        ipAddress: ip,
        userAgent: ua,
        requestId,
        details: {
          errorCode: error.code,
        },
      })

      return createErrorResponse(mapped.code, mapped.message, undefined, mapped.statusCode, {
        requestId,
      })
    }

    await auditLogger.logEvent({
      action: options.auditAction,
      resource: `user:${targetId}`,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      ipAddress: ip,
      userAgent: ua,
      requestId,
    })

    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "关注操作失败", undefined, 500, {
      requestId,
    })
  }
}

function createRateLimitResponse(rateLimit: RateLimitResult, requestId: string): NextResponse {
  const config = RATE_LIMITS.follow
  const retryAfterSeconds = rateLimit.resetTime
    ? Math.max(1, Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000))
    : Math.ceil(config.windowMs / 1000)

  const response = createErrorResponse(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    rateLimit.message || config.message,
    undefined,
    429,
    { requestId }
  )

  response.headers.set("Retry-After", String(retryAfterSeconds))
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests))
  response.headers.set("X-RateLimit-Remaining", "0")
  if (rateLimit.resetTime) {
    response.headers.set("X-RateLimit-Reset", rateLimit.resetTime.toISOString())
  }
  if (rateLimit.backend) {
    response.headers.set("X-RateLimit-Backend", rateLimit.backend)
  }

  return response
}

export function applyFollowRateLimitHeaders(response: NextResponse, rateLimit: RateLimitResult) {
  if (!rateLimit.success) return

  const config = RATE_LIMITS.follow
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests))
  const remaining = rateLimit.remainingRequests ?? 0
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)))

  if (rateLimit.resetTime) {
    response.headers.set("X-RateLimit-Reset", rateLimit.resetTime.toISOString())
  } else {
    response.headers.delete("X-RateLimit-Reset")
  }

  if (rateLimit.backend) {
    response.headers.set("X-RateLimit-Backend", rateLimit.backend)
  } else {
    response.headers.delete("X-RateLimit-Backend")
  }
}

export function mapFollowServiceError(error: FollowServiceError): {
  code: ErrorCode
  message: string
  statusCode: number
} {
  switch (error.code) {
    case "SELF_FOLLOW":
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: "不能关注自己",
        statusCode: 400,
      }
    case "TARGET_NOT_FOUND":
      return {
        code: ErrorCode.NOT_FOUND,
        message: "用户不存在",
        statusCode: 404,
      }
    case "TARGET_INACTIVE":
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: "无法关注该用户",
        statusCode: 400,
      }
    case "LIMIT_EXCEEDED":
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: "批量查询数量超出限制",
        statusCode: 400,
      }
    case "INVALID_CURSOR":
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: "分页游标无效",
        statusCode: 400,
      }
    default:
      return {
        code: ErrorCode.INTERNAL_ERROR,
        message: "关注操作失败",
        statusCode: 500,
      }
  }
}
