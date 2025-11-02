/**
 * 通用点赞 API 路由
 * 处理文章和动态的点赞操作
 */

import { NextRequest } from "next/server"
import {
  toggleLike,
  ensureLiked,
  ensureUnliked,
  getLikeStatus,
  getLikeUsers,
  type LikeTargetType,
} from "@/lib/interactions"
import { fetchAuthenticatedUser, assertPolicy, generateRequestId } from "@/lib/auth/session"
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  validateRequestData,
  parsePaginationParams,
  ErrorCode,
} from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { checkLikeRate } from "@/lib/rate-limit/like-limits"
import { handleInteractionError } from "@/lib/api/interaction-error-handler"
import { API_ERROR_MESSAGES } from "@/lib/api/error-messages"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"

/**
 * GET /api/likes
 * 获取点赞状态或点赞用户列表
 */
export async function GET(request: NextRequest) {
  // 生成 requestId 用于追踪（统一所有路由的追踪行为）
  const requestId = generateRequestId()

  try {
    const searchParams = request.nextUrl.searchParams
    const targetType = searchParams.get("targetType") as LikeTargetType
    const targetId = searchParams.get("targetId")
    const action = searchParams.get("action") || "status" // status | users

    // 验证参数
    if (!targetType || !["post", "activity"].includes(targetType)) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    }

    if (!targetId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.MISSING_TARGET_ID)
    }

    // 获取点赞状态
    if (action === "status") {
      // 获取当前用户（可选）
      const user = await fetchAuthenticatedUser()
      const status = await getLikeStatus(targetType, targetId, user?.id)

      // 记录审计日志
      await auditLogger.logEvent({
        action: "LIKE_STATUS",
        resource: `${targetType}:${targetId}`,
        details: {
          targetType,
          targetId,
          isLiked: status.isLiked,
          count: status.count,
          hasUser: !!user,
        },
        severity: "LOW",
        success: true,
        userId: user?.id,
        ipAddress: getClientIP(request),
        userAgent: getClientUserAgent(request),
        requestId: requestId,
      })

      return createSuccessResponse(status, { requestId })
    }

    // 获取点赞用户列表
    if (action === "users") {
      const { cursor, limit } = parsePaginationParams(searchParams)
      const result = await getLikeUsers(targetType, targetId, limit, cursor)

      // 记录审计日志
      await auditLogger.logEvent({
        action: "LIKE_USERS",
        resource: `${targetType}:${targetId}`,
        details: {
          targetType,
          targetId,
          limit,
          cursor,
          resultCount: result.users.length,
          hasMore: result.hasMore,
        },
        severity: "LOW",
        success: true,
        ipAddress: getClientIP(request),
        userAgent: getClientUserAgent(request),
        requestId: requestId,
      })

      return createPaginatedResponse(
        result.users,
        {
          limit,
          total: -1,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
        { requestId }
      )
    }

    return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.INVALID_ACTION)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/likes
 * 切换点赞状态
 */
export async function POST(request: NextRequest) {
  // 使用 route-guard 进行认证
  const requestId = generateRequestId()
  try {
    const ip = getClientIP(request) ?? undefined
    const ua = getClientUserAgent(request) ?? undefined
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError) {
      const errorCode = mapAuthErrorCode(authError)
      return createErrorResponse(errorCode, authError.message, undefined, authError.statusCode)
    }

    const body = await request.json()
    const { targetType, targetId } = body

    // 验证参数
    const validation = validateRequestData(body, ["targetType", "targetId"])
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        API_ERROR_MESSAGES.MISSING_REQUIRED_FIELDS
      )
    }

    if (!["post", "activity"].includes(targetType)) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    }

    // 限流检查（开关控制，默认关闭）
    const rate = await checkLikeRate({ userId: user.id, ip, requestId })
    if (!rate.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rate.retryAfter,
        }
      )
    }

    // 切换点赞状态
    const status = await toggleLike(targetType, targetId, user.id, requestId)

    // 记录审计日志
    await auditLogger.logEvent({
      action: "LIKE_TOGGLE",
      resource: `${targetType}:${targetId}`,
      details: {
        targetType,
        targetId,
        isLiked: status.isLiked,
        count: status.count,
        operation: status.isLiked ? "liked" : "unliked",
      },
      severity: "LOW",
      success: true,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      requestId: requestId,
    })

    return createSuccessResponse(status, { requestId })
  } catch (error) {
    return handleInteractionError(error, requestId)
  }
}

/**
 * PUT /api/likes
 * 确保已点赞（幂等操作）
 *
 * 符合 HTTP PUT 语义：多次调用结果一致，最终状态为已点赞
 */
export async function PUT(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const ip = getClientIP(request) ?? undefined
    const ua = getClientUserAgent(request) ?? undefined
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError) {
      const errorCode = mapAuthErrorCode(authError)
      return createErrorResponse(errorCode, authError.message, undefined, authError.statusCode)
    }

    const body = await request.json()
    const { targetType, targetId } = body

    // 验证参数
    const validation = validateRequestData(body, ["targetType", "targetId"])
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        API_ERROR_MESSAGES.MISSING_REQUIRED_FIELDS
      )
    }

    if (!["post", "activity"].includes(targetType)) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    }

    // 限流检查
    const rate = await checkLikeRate({ userId: user.id, ip, requestId })
    if (!rate.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rate.retryAfter,
        }
      )
    }

    // 调用幂等接口：确保已点赞
    const status = await ensureLiked(targetType, targetId, user.id, requestId)

    // 记录审计日志
    await auditLogger.logEvent({
      action: "LIKE_ENSURE",
      resource: `${targetType}:${targetId}`,
      details: {
        targetType,
        targetId,
        operation: "ensure_liked",
        isLiked: status.isLiked,
        count: status.count,
      },
      severity: "LOW",
      success: true,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      requestId: requestId,
    })

    return createSuccessResponse(status, { requestId })
  } catch (error) {
    return handleInteractionError(error, requestId)
  }
}

/**
 * DELETE /api/likes
 * 确保未点赞（幂等操作）
 *
 * 符合 HTTP DELETE 语义：多次调用结果一致，最终状态为未点赞
 */
export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const ip = getClientIP(request) ?? undefined
    const ua = getClientUserAgent(request) ?? undefined
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError) {
      const errorCode = mapAuthErrorCode(authError)
      return createErrorResponse(errorCode, authError.message, undefined, authError.statusCode)
    }

    // 优先从 body 读取参数，兜底从 query 读取（向后兼容）
    let targetType: string | undefined
    let targetId: string | undefined

    try {
      const body = await request.json()
      targetType = body.targetType
      targetId = body.targetId
    } catch {
      // 兜底：从查询参数读取
      const { searchParams } = request.nextUrl
      targetType = searchParams.get("targetType") ?? undefined
      targetId = searchParams.get("targetId") ?? undefined
    }

    // 验证参数
    if (!targetType || !targetId) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        API_ERROR_MESSAGES.MISSING_TARGET_TYPE_OR_ID
      )
    }

    if (!["post", "activity"].includes(targetType)) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    }

    // 限流检查
    const rate = await checkLikeRate({ userId: user.id, ip, requestId })
    if (!rate.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rate.retryAfter,
        }
      )
    }

    // 调用幂等接口：确保未点赞
    const status = await ensureUnliked(targetType as LikeTargetType, targetId, user.id, requestId)

    // 记录审计日志
    await auditLogger.logEvent({
      action: "LIKE_ENSURE",
      resource: `${targetType}:${targetId}`,
      details: {
        targetType,
        targetId,
        operation: "ensure_unliked",
        isLiked: status.isLiked,
        count: status.count,
      },
      severity: "LOW",
      success: true,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      requestId: requestId,
    })

    return createSuccessResponse(status, { requestId })
  } catch (error) {
    return handleInteractionError(error, requestId)
  }
}
