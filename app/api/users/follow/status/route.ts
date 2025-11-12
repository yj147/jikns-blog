import { NextRequest, NextResponse } from "next/server"
import { getFollowStatusBatch } from "@/lib/interactions"
import { assertPolicy, generateRequestId } from "@/lib/auth/session"
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit/activity-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const path = req.nextUrl.pathname
  const ip = getClientIP(req)
  const ua = getClientUserAgent(req)

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path,
      ip,
      ua,
      requestId,
    })

    if (authError || !user) {
      // 记录未授权访问的审计事件
      await auditLogger.logEvent({
        action: "USER_FOLLOW_STATUS_BATCH_QUERY",
        resource: "follow-status:batch",
        success: false,
        errorMessage: authError?.message || "未授权访问",
        ipAddress: ip,
        userAgent: ua,
        requestId,
      })

      // 使用统一的错误码映射工具和响应格式
      const errorCode = authError ? mapAuthErrorCode(authError) : ErrorCode.FORBIDDEN
      return createErrorResponse(
        errorCode,
        authError?.message || "未授权访问",
        undefined,
        authError?.statusCode,
        { requestId }
      )
    }

    // 速率限制检查
    const rateLimit = await rateLimitCheck(req, "follow-status")
    if (!rateLimit.success) {
      const followStatusLimit = RATE_LIMITS["follow-status"]
      const retryAfterSeconds = rateLimit.resetTime
        ? Math.max(1, Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(followStatusLimit.windowMs / 1000)

      const response = createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        rateLimit.message || "请求过于频繁，请稍后再试",
        undefined,
        429,
        { requestId }
      )
      response.headers.set("Retry-After", String(retryAfterSeconds))
      response.headers.set("X-RateLimit-Limit", String(followStatusLimit.maxRequests))
      response.headers.set("X-RateLimit-Remaining", "0")
      if (rateLimit.resetTime) {
        response.headers.set("X-RateLimit-Reset", rateLimit.resetTime.toISOString())
      }
      if (rateLimit.backend) {
        response.headers.set("X-RateLimit-Backend", rateLimit.backend)
      }
      return response
    }

    let body: any
    try {
      body = await req.json()
    } catch (parseError) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "请求体格式错误", undefined, 400, {
        requestId,
      })
    }

    const { targetIds } = body

    if (!Array.isArray(targetIds)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "targetIds 必须是数组",
        undefined,
        400,
        { requestId }
      )
    }

    // Linus 原则：Never break userspace
    // 严格校验数组元素类型，避免非字符串值导致 Prisma 500
    // 任何非法输入都在 400 层面被挡掉
    if (!targetIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "targetIds 数组元素必须是非空字符串",
        undefined,
        400,
        { requestId }
      )
    }

    if (targetIds.length > 50) {
      return createErrorResponse(
        ErrorCode.LIMIT_EXCEEDED,
        "批量查询数量不能超过 50",
        undefined,
        429,
        { requestId }
      )
    }

    // 速率限制检查通过后，添加 Rate Limit 头部
    const followStatusLimit = RATE_LIMITS["follow-status"]

    // Linus 原则：API 响应格式与文档一致
    // 返回键值对结构：{ [userId]: { isFollowing, isMutual } }
    // 符合 API-Documentation.md:199-205 的响应格式规范
    const statusMap = await getFollowStatusBatch(user.id, targetIds)

    // Linus 原则：统一审计
    // 记录批量状态查询操作，符合 Phase9 统一审计要求
    await auditLogger.logEvent({
      action: "USER_FOLLOW_STATUS_BATCH_QUERY",
      resource: "follow-status:batch",
      success: true,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      details: {
        targetCount: targetIds.length,
        uniqueTargetCount: Object.keys(statusMap).length,
      },
    })

    // 使用统一的成功响应格式，包含完整的 meta 字段
    const response = createSuccessResponse(statusMap, { requestId })

    // 添加 Rate Limit 头部
    if (rateLimit.success) {
      response.headers.set("X-RateLimit-Limit", String(followStatusLimit.maxRequests))
      const remaining = rateLimit.remainingRequests ?? 0
      response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)))
      if (rateLimit.resetTime) {
        response.headers.set("X-RateLimit-Reset", rateLimit.resetTime.toISOString())
      }
      if (rateLimit.backend) {
        response.headers.set("X-RateLimit-Backend", rateLimit.backend)
      }
    }

    return response
  } catch (error) {
    logger.error("Follow status API error", {
      requestId,
      path,
      ip,
      error,
    })

    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "服务器内部错误", undefined, 500, {
      requestId,
    })
  }
}
