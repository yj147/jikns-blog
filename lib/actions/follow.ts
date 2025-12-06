"use server"

import { headers } from "next/headers"
import { auditLogger } from "@/lib/audit-log"
import {
  FollowServiceError,
  followUser,
  unfollowUser,
  type FollowActionResult,
  type UnfollowActionResult,
} from "@/lib/interactions"
import { assertPolicy, generateRequestId } from "@/lib/auth/session"
import { rateLimitCheckForAction } from "@/lib/rate-limit/activity-limits"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { logger } from "@/lib/utils/logger"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"
import { getClientIpFromHeaders } from "@/lib/api/get-client-ip"

function mapFollowServiceError(error: FollowServiceError): { code: string; message: string } {
  switch (error.code) {
    case "SELF_FOLLOW":
      return { code: "VALIDATION_ERROR", message: "不能关注自己" }
    case "TARGET_NOT_FOUND":
      return { code: "NOT_FOUND", message: "用户不存在" }
    case "TARGET_INACTIVE":
      return { code: "VALIDATION_ERROR", message: "无法关注该用户" }
    case "LIMIT_EXCEEDED":
      return { code: "VALIDATION_ERROR", message: "批量查询数量超出限制" }
    case "INVALID_CURSOR":
      return { code: "VALIDATION_ERROR", message: "分页游标无效" }
    default:
      return { code: "UNKNOWN_ERROR", message: "关注操作失败" }
  }
}

function handleFollowActionError(error: unknown): { code: string; message: string } {
  if (error instanceof FollowServiceError) {
    return mapFollowServiceError(error)
  }

  logger.error("关注操作内部异常", { error })

  return {
    code: "UNKNOWN_ERROR",
    message: "关注操作失败，请稍后再试",
  }
}

export interface FollowActionResponse<T> {
  success: true
  data: T
  message?: string
}

export interface FollowActionError {
  success: false
  error: {
    code: string
    message: string
    retryAfter?: number
  }
}

export type FollowServerActionResult<T> = FollowActionResponse<T> | FollowActionError

interface RequestContext {
  requestId: string
  ip?: string
  ua?: string
}

async function resolveClientIp(): Promise<string | undefined> {
  const headerList = await headers()
  const ip = getClientIpFromHeaders(headerList)
  return ip === "unknown" ? undefined : ip
}

async function resolveUserAgent(): Promise<string | undefined> {
  const headerList = await headers()
  return headerList.get("user-agent") || undefined
}

type AuthResult =
  | { success: true; userId: string }
  | { success: false; error: FollowActionError["error"] }

async function authenticateFollowRequest(
  actionName: string,
  context: RequestContext
): Promise<AuthResult> {
  const [user, authError] = await assertPolicy("user-active", {
    path: `/actions/${actionName.toLowerCase()}`,
    ...context,
  })

  if (authError || !user) {
    // Linus 原则：监控策略增强
    // 记录认证拒绝事件，便于快速定位拒绝高峰
    performanceMonitor.recordMetric({
      type: MetricType.FOLLOW_AUTH_REJECTED,
      value: 1,
      unit: "count",
      timestamp: new Date(),
      context: {
        ip: context.ip,
        additionalData: {
          errorCode: authError?.code,
          requestId: context.requestId,
          origin: "server-action",
        },
      },
    })

    // 使用统一的错误码映射工具，确保所有认证失效场景返回 UNAUTHORIZED
    // 这样前端可以正确识别需要重新登录的场景
    const errorCode = authError ? mapAuthErrorCode(authError) : "UNKNOWN_ERROR"
    return {
      success: false,
      error: {
        code: errorCode,
        message: authError?.message || "认证失败",
      },
    }
  }

  return { success: true, userId: user.id }
}

type RateLimitResult = { success: true } | { success: false; error: FollowActionError["error"] }

async function checkFollowRateLimit(
  userId: string,
  ip?: string,
  requestId?: string
): Promise<RateLimitResult> {
  const rateLimit = await rateLimitCheckForAction("follow", { userId, ip })

  if (!rateLimit.success) {
    // Linus 原则：监控策略增强
    // 记录速率限制事件，便于快速定位限流高峰
    performanceMonitor.recordMetric({
      type: MetricType.FOLLOW_RATE_LIMITED,
      value: 1,
      unit: "count",
      timestamp: new Date(),
      context: {
        userId,
        ip,
        additionalData: {
          backend: rateLimit.backend,
          requestId,
          origin: "server-action",
        },
      },
    })

    return {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: rateLimit.message || "操作过于频繁，请稍后再试",
        retryAfter: rateLimit.resetTime
          ? Math.max(1, Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000))
          : undefined,
      },
    }
  }

  return { success: true }
}

async function logFollowAudit(
  actionName: string,
  targetId: string,
  success: boolean,
  context: RequestContext,
  userId: string,
  errorInfo?: { code: string; message: string }
): Promise<void> {
  await auditLogger.logEvent({
    action: actionName,
    resource: `user:${targetId}`,
    success,
    severity: success ? "LOW" : errorInfo?.code === "UNKNOWN_ERROR" ? "HIGH" : "LOW",
    userId,
    ipAddress: context.ip,
    userAgent: context.ua,
    errorMessage: errorInfo?.message,
    details: {
      requestId: context.requestId,
      code: errorInfo?.code,
      origin: "server-action",
    },
  })
}

async function executeFollowAction<T>(
  targetId: string,
  actionName: "USER_FOLLOW" | "USER_UNFOLLOW",
  handler: (userId: string) => Promise<T>,
  transform: (payload: T) => { data: T; message?: string }
): Promise<FollowServerActionResult<T>> {
  const context: RequestContext = {
    requestId: generateRequestId(),
    ip: await resolveClientIp(),
    ua: await resolveUserAgent(),
  }

  const authResult = await authenticateFollowRequest(actionName, context)
  if (!authResult.success) {
    return { success: false, error: authResult.error }
  }

  const rateLimitResult = await checkFollowRateLimit(
    authResult.userId,
    context.ip,
    context.requestId
  )
  if (!rateLimitResult.success) {
    return { success: false, error: rateLimitResult.error }
  }

  const timerId = `follow:${context.requestId}:${actionName}`
  performanceMonitor.startTimer(timerId, {
    userId: authResult.userId,
    additionalData: { action: actionName, targetId, origin: "server-action" },
  })

  try {
    const payload = await handler(authResult.userId)
    const { data, message } = transform(payload)

    performanceMonitor.endTimer(timerId, MetricType.FOLLOW_ACTION_DURATION, {
      additionalData: { action: actionName },
    })

    logFollowAudit(actionName, targetId, true, context, authResult.userId).catch((auditError) => {
      logger.warn("审计日志记录失败", { requestId: context.requestId, error: auditError })
    })

    return { success: true, data, message }
  } catch (error) {
    const mappedError = handleFollowActionError(error)

    performanceMonitor.endTimer(timerId, MetricType.FOLLOW_ACTION_DURATION, {
      additionalData: { action: actionName, errorCode: mappedError.code },
    })

    if (!(error instanceof FollowServiceError)) {
      logger.error(`${actionName} server action failed`, {
        requestId: context.requestId,
        error,
      })
    }

    logFollowAudit(actionName, targetId, false, context, authResult.userId, mappedError).catch(
      (auditError) => {
        logger.warn("审计日志记录失败", { requestId: context.requestId, error: auditError })
      }
    )

    return { success: false, error: mappedError }
  }
}

export async function followUserAction(
  targetId: string
): Promise<FollowServerActionResult<FollowActionResult>> {
  return executeFollowAction(
    targetId,
    "USER_FOLLOW",
    (userId) => followUser(userId, targetId),
    (payload) => ({
      data: payload,
      message: payload.wasNew
        ? `已关注 ${payload.targetName ?? "该用户"}`
        : `${payload.targetName ?? "该用户"} 已在你的关注列表`,
    })
  )
}

export async function unfollowUserAction(
  targetId: string
): Promise<FollowServerActionResult<UnfollowActionResult>> {
  return executeFollowAction(
    targetId,
    "USER_UNFOLLOW",
    (userId) => unfollowUser(userId, targetId),
    (payload) => ({
      data: payload,
      message: "已取消关注",
    })
  )
}

export async function toggleFollowAction(
  targetId: string,
  shouldFollow: boolean
): Promise<FollowServerActionResult<FollowActionResult | UnfollowActionResult>> {
  return shouldFollow ? followUserAction(targetId) : unfollowUserAction(targetId)
}
