/**
 * 通用评论 API 路由
 * 处理文章和动态的评论操作
 */

import { NextRequest } from "next/server"
import { revalidateTag, unstable_cache } from "next/cache"
import {
  createComment,
  listComments,
  CommentServiceError,
  type CommentWithAuthor,
} from "@/lib/interactions"
import {
  getOptionalViewer,
  assertPolicy,
  generateRequestId,
  type AuthenticatedUser,
} from "@/lib/auth/session"
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  ErrorCode,
} from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { checkCommentRate, extractClientIP } from "@/lib/rate-limit/comment-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { commentsLogger, logCommentOperation } from "@/lib/utils/logger"
import { commentsMetrics, measureOperation } from "@/lib/metrics/comments-metrics"
import {
  safeParseListComments,
  safeParseCreateComment,
  CommentResponseDto,
  type CommentTargetType,
} from "@/lib/dto/comments.dto"
import { Role } from "@/lib/generated/prisma"
import { respondWithCommentError } from "./comment-error-response"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

/**
 * GET /api/comments
 * 获取评论列表
 */
async function handleGet(request: NextRequest) {
  const startTime = performance.now()
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  let actorId: string | undefined
  let actorRole: string | undefined
  let actorStatus: string | undefined
  let viewerMs = 0
  let listMs = 0
  let mapMs = 0

  try {
    // 设置请求ID到全局上下文
    if (typeof globalThis !== "undefined") {
      ;(globalThis as any).requestId = requestId
    }

    const viewerStart = performance.now()
    const user = await getOptionalViewer({ request })
    viewerMs = performance.now() - viewerStart
    actorId = user?.id
    actorRole = user?.role
    actorStatus = user?.status

    const searchParams = request.nextUrl.searchParams

    // 构建查询参数对象
    const getParam = (key: string) => {
      const value = searchParams.get(key)
      return value === null ? undefined : value
    }

    const queryParams = {
      targetType: getParam("targetType"),
      targetId: getParam("targetId"),
      parentId: getParam("parentId"),
      cursor: getParam("cursor"),
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
    }

    // 使用DTO验证参数
    const validation = safeParseListComments(queryParams)

    if (!validation.success) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0]?.message || "参数验证失败"
      )
    }

    const { targetType, targetId, parentId, cursor, limit } = validation.data
    const includeReplies = searchParams.get("includeReplies") === "true"

    commentsLogger.debug("Starting comment list operation", {
      requestId,
      targetType,
      targetId,
      cursor,
      limit,
      includeReplies,
    })

    // 获取评论列表（带指标测量）
    const listStart = performance.now()
    const result = await measureOperation("list", async () => {
      const loadComments = () =>
        listComments({
          targetType,
          targetId,
          cursor,
          limit,
          parentId,
          includeReplies,
          includeAuthor: true,
        })

      if (process.env.NODE_ENV !== "production") {
        return await loadComments()
      }

      const cacheKey = [
        "api-comments",
        targetType,
        targetId,
        parentId ?? "root",
        cursor ?? "",
        String(limit),
        includeReplies ? "replies" : "no-replies",
      ]

      return await unstable_cache(loadComments, cacheKey, {
        revalidate: 10,
        tags: [`comments:${targetType}:${targetId}`],
      })()
    })
    listMs = performance.now() - listStart

    const mapStart = performance.now()
    const commentsWithPermissions = appendCommentPermissions(result.comments, user)
    const validatedComments = commentsWithPermissions.map((comment) =>
      CommentResponseDto.parse(comment)
    )
    mapMs = performance.now() - mapStart

    const duration = performance.now() - startTime

    // 记录成功日志
    logCommentOperation("list", actorId, `${targetType}:${targetId}`, "success", duration, {
      requestId,
      resultCount: result.comments.length,
      hasMore: result.hasMore,
      actorRole,
      actorStatus,
    })

    const response = createPaginatedResponse(validatedComments, {
      limit,
      total: result.totalCount,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    })
    response.headers.set(
      "Server-Timing",
      [
        `viewer;dur=${viewerMs.toFixed(1)}`,
        `list;dur=${listMs.toFixed(1)}`,
        `map;dur=${mapMs.toFixed(1)}`,
        `total;dur=${duration.toFixed(1)}`,
      ].join(", ")
    )
    response.headers.set("x-perf-viewer-ms", viewerMs.toFixed(1))
    response.headers.set("x-perf-list-ms", listMs.toFixed(1))
    response.headers.set("x-perf-map-ms", mapMs.toFixed(1))
    response.headers.set("x-perf-total-ms", duration.toFixed(1))
    return response
  } catch (error) {
    const duration = performance.now() - startTime

    // 记录失败日志
    if (error instanceof CommentServiceError) {
      logCommentOperation("list", actorId, request.nextUrl.pathname, "failure", duration, {
        requestId,
        errorCode: error.code,
        actorRole,
        actorStatus,
      })

      return respondWithCommentError(error)
    }

    logCommentOperation("list", actorId, request.nextUrl.pathname, "failure", duration, {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      actorRole,
      actorStatus,
    })

    return handleApiError(error)
  }
}

type CommentWithPermissions = CommentWithAuthor & {
  replies?: CommentWithPermissions[]
  canEdit?: boolean
  canDelete?: boolean
}

function appendCommentPermissions(
  comments: CommentWithAuthor[],
  viewer: AuthenticatedUser | null
): CommentWithPermissions[] {
  return comments.map((comment) => applyCommentPermissions(comment, viewer))
}

function applyCommentPermissions(
  comment: CommentWithAuthor,
  viewer: AuthenticatedUser | null
): CommentWithPermissions {
  const isAdmin = viewer?.role === Role.ADMIN
  const isAuthor = viewer?.id === comment.authorId
  const isDeleted = Boolean(comment.deletedAt)

  const canDelete = Boolean(viewer && (isAdmin || isAuthor))
  const canEdit = Boolean(viewer && isAuthor && !isDeleted)

  return {
    ...comment,
    canDelete,
    canEdit,
    replies: comment.replies ? appendCommentPermissions(comment.replies, viewer) : undefined,
  }
}

/**
 * POST /api/comments
 * 创建评论
 */
async function handlePost(request: NextRequest) {
  const startTime = performance.now()
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined
  let actorId: string | undefined
  let actorRole: string | undefined
  let actorStatus: string | undefined
  let targetLabel = "unknown"

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError) {
      const duration = performance.now() - startTime
      logCommentOperation(
        "create",
        authError.context?.userId,
        request.nextUrl.pathname,
        "failure",
        duration,
        {
          requestId,
          reason: "auth_error",
          authErrorCode: authError.code,
          statusCode: authError.statusCode,
        }
      )

      const errorCode =
        authError.code === "UNAUTHORIZED"
          ? ErrorCode.UNAUTHORIZED
          : authError.code === "FORBIDDEN" || authError.code === "ACCOUNT_BANNED"
            ? ErrorCode.FORBIDDEN
            : ErrorCode.UNKNOWN_ERROR

      return createErrorResponse(errorCode, authError.message, undefined, authError.statusCode)
    }

    actorId = user.id
    actorRole = user.role
    actorStatus = user.status

    const body = await request.json()

    const validation = safeParseCreateComment(body)

    if (!validation.success) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0]?.message || "参数验证失败"
      )
    }

    const { targetType, targetId, content, parentId } = validation.data

    targetLabel = `${targetType}:${targetId}`

    commentsLogger.debug("Starting comment create operation", {
      requestId,
      userId: user.id,
      targetType,
      targetId,
      parentId,
      contentLength: content?.length,
    })

    const clientIP = extractClientIP(request.headers) ?? ip ?? null
    const rateLimitResult = await checkCommentRate({
      userId: user.id,
      ip: clientIP || undefined,
      action: "create",
    })

    if (!rateLimitResult.allowed) {
      await auditLogger.logEvent({
        action: "CREATE_COMMENT_DENIED",
        resource: "comment:rate_limited",
        details: {
          reason: "RATE_LIMITED",
          targetType: targetType || "unknown",
          targetId: targetId || "unknown",
          retryAfter: rateLimitResult.retryAfter,
        },
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        success: false,
      })

      const duration = performance.now() - startTime
      logCommentOperation("create", user.id, targetLabel, "failure", duration, {
        requestId,
        reason: "rate_limited",
        retryAfter: rateLimitResult.retryAfter,
        actorRole,
        actorStatus,
      })

      return createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, "操作过于频繁，请稍后再试", {
        retryAfter: rateLimitResult.retryAfter,
      })
    }

    const comment = await measureOperation("create", async () => {
      return await createComment({
        targetType,
        targetId,
        content,
        authorId: user.id,
        parentId: parentId ?? undefined,
      })
    })

    revalidateTag(`comments:${targetType}:${targetId}`)

    const validatedComment = CommentResponseDto.parse(comment)

    auditLogger.logEventAsync({
      action: "CREATE_COMMENT",
      resource: `comment:${comment.id}`,
      details: {
        targetType,
        targetId,
        parentId: parentId || null,
        contentLength: content.length,
      },
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      success: true,
    })

    const duration = performance.now() - startTime

    logCommentOperation("create", user.id, targetLabel, "success", duration, {
      requestId,
      commentId: comment.id,
      parentId,
      actorRole,
      actorStatus,
    })

    return createSuccessResponse(validatedComment)
  } catch (error) {
    const duration = performance.now() - startTime

    if (error instanceof CommentServiceError) {
      logCommentOperation("create", actorId, targetLabel, "failure", duration, {
        requestId,
        errorCode: error.code,
        actorRole,
        actorStatus,
      })

      return respondWithCommentError(error)
    }

    logCommentOperation("create", actorId, targetLabel, "failure", duration, {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      actorRole,
      actorStatus,
    })

    return handleApiError(error)
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)

/**
 * DELETE /api/comments/[id]
 * 删除评论
 */
// DELETE moved to /api/comments/[id]/route.ts to receive dynamic params
