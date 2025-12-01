/**
 * 收藏 API 路由
 * 处理文章收藏的查询和切换操作
 */

import { NextRequest } from "next/server"
import {
  toggleBookmark,
  ensureBookmarked,
  ensureUnbookmarked,
  getBookmarkStatus,
  getUserBookmarks,
} from "@/lib/interactions"
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  parsePaginationParams,
  ErrorCode,
} from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { checkBookmarkRate } from "@/lib/rate-limit/bookmark-limits"
import { getOptionalViewer, assertPolicy, generateRequestId } from "@/lib/auth/session"
import { handleInteractionError } from "@/lib/api/interaction-error-handler"
import { API_ERROR_MESSAGES } from "@/lib/api/error-messages"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

/**
 * GET /api/bookmarks
 * 根据action参数执行不同操作：
 * - status: 获取收藏状态（公开）
 * - list: 获取用户收藏列表（需认证）
 */
async function handleGet(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get("action")

  // 获取收藏状态
  if (action === "status") {
    // 生成 requestId 用于追踪（统一所有路由的追踪行为）
    const requestId = generateRequestId()

    try {
      const postId = searchParams.get("postId")

      // 验证参数
      if (!postId) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.MISSING_POST_ID)
      }

      // 获取当前用户（可选，不强制登录）
      const user = await getOptionalViewer({ request })

      // 获取收藏状态
      const status = await getBookmarkStatus(postId, user?.id)

      // 记录审计日志（与 likes 路由保持一致：包含 IP/UA）
      await auditLogger.logEvent({
        action: "BOOKMARK_STATUS",
        resource: `post:${postId}`,
        details: {
          postId,
          hasUser: !!user,
          isBookmarked: status.isBookmarked,
          count: status.count,
        },
        severity: "LOW",
        success: true,
        userId: user?.id,
        ipAddress: getClientIP(request),
        userAgent: getClientUserAgent(request),
        requestId: requestId,
      })

      return createSuccessResponse(status, { requestId })
    } catch (error) {
      return handleApiError(error)
    }
  }

  // 获取收藏列表
  if (action === "list") {
    try {
      const requestId = generateRequestId()
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

      let userId = searchParams.get("userId")

      // 验证参数
      if (!userId) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.MISSING_USER_ID)
      }

      // 解析 "me" 为当前用户ID
      if (userId === "me") {
        userId = user.id
      }

      // 权限检查：只能查看自己的收藏列表或管理员可查看所有
      if (user.id !== userId && user.role !== "ADMIN") {
        return createErrorResponse(ErrorCode.FORBIDDEN, API_ERROR_MESSAGES.FORBIDDEN_VIEW_BOOKMARKS)
      }

      // 解析分页参数
      const { limit, cursor } = parsePaginationParams(searchParams)

      // 获取收藏列表
      const result = await getUserBookmarks(userId, { cursor, limit })

      // 记录审计日志
      await auditLogger.logEvent({
        action: "BOOKMARK_LIST",
        resource: `user:${userId}`,
        details: {
          action: "query_list",
          limit,
          cursor,
          isOwnList: user.id === userId,
          resultCount: result.items.length,
          hasMore: result.hasMore,
        },
        severity: "LOW",
        success: true,
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        requestId: requestId,
      })

      // 返回分页响应
      return createPaginatedResponse(
        result.items,
        {
          limit,
          total: -1, // 不返回总数，使用cursor分页
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
        { requestId }
      )
    } catch (error) {
      return handleApiError(error)
    }
  }

  // 无效的 action
  return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.INVALID_BOOKMARK_ACTION)
}

/**
 * POST /api/bookmarks
 * 切换收藏状态
 */
async function handlePost(request: NextRequest) {
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
    const { postId } = body

    // 验证参数
    if (!postId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.MISSING_POST_ID)
    }

    // 限流检查（开关控制，默认关闭）
    const rate = await checkBookmarkRate({ userId: user.id, ip, requestId })
    if (!rate.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rate.retryAfter,
        }
      )
    }

    // 切换收藏状态
    const status = await toggleBookmark(postId, user.id, requestId)

    // 记录审计日志
    await auditLogger.logEvent({
      action: "BOOKMARK_TOGGLE",
      resource: `post:${postId}`,
      details: { action: status.isBookmarked ? "bookmark" : "unbookmark", newCount: status.count },
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

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)
export const PUT = withApiResponseMetrics(handlePut)
export const DELETE = withApiResponseMetrics(handleDelete)

/**
 * PUT /api/bookmarks
 * 确保已收藏（幂等操作）
 *
 * 符合 HTTP PUT 语义：多次调用结果一致，最终状态为已收藏
 */
async function handlePut(request: NextRequest) {
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
    const { postId } = body

    // 验证参数
    if (!postId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.MISSING_POST_ID)
    }

    // 限流检查
    const rate = await checkBookmarkRate({ userId: user.id, ip, requestId })
    if (!rate.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rate.retryAfter,
        }
      )
    }

    // 调用幂等接口：确保已收藏
    const status = await ensureBookmarked(postId, user.id, requestId)

    // 记录审计日志
    await auditLogger.logEvent({
      action: "BOOKMARK_ENSURE",
      resource: `post:${postId}`,
      details: {
        operation: "ensure_bookmarked",
        isBookmarked: status.isBookmarked,
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
 * DELETE /api/bookmarks
 * 确保未收藏（幂等操作）
 *
 * 符合 HTTP DELETE 语义：多次调用结果一致，最终状态为未收藏
 */
async function handleDelete(request: NextRequest) {
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
    let postId: string | undefined

    try {
      const body = await request.json()
      postId = body.postId
    } catch {
      // 兜底：从查询参数读取
      const { searchParams } = request.nextUrl
      postId = searchParams.get("postId") ?? undefined
    }

    // 验证参数
    if (!postId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, API_ERROR_MESSAGES.MISSING_POST_ID)
    }

    // 限流检查
    const rate = await checkBookmarkRate({ userId: user.id, ip, requestId })
    if (!rate.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        API_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        {
          retryAfter: rate.retryAfter,
        }
      )
    }

    // 调用幂等接口：确保未收藏
    const status = await ensureUnbookmarked(postId, user.id, requestId)

    // 记录审计日志
    await auditLogger.logEvent({
      action: "BOOKMARK_ENSURE",
      resource: `post:${postId}`,
      details: {
        operation: "ensure_unbookmarked",
        isBookmarked: status.isBookmarked,
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
