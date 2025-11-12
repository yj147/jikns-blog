import { NextRequest } from "next/server"
import { deleteComment, CommentServiceError, CommentErrorCode } from "@/lib/interactions"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { assertPolicy, generateRequestId } from "@/lib/auth/session"
import { checkCommentRate, extractClientIP } from "@/lib/rate-limit/comment-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { commentsLogger, logCommentOperation } from "@/lib/utils/logger"
import { measureOperation } from "@/lib/metrics/comments-metrics"
import { respondWithCommentError } from "../comment-error-response"

// DELETE /api/comments/[id] - 删除评论
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = performance.now()
  const requestId = generateRequestId()
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined
  const commentId = params.id
  const targetLabel = commentId ? `comment:${commentId}` : "comment:unknown"
  let actorId: string | undefined
  let actorRole: string | undefined
  let actorStatus: string | undefined

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError) {
      const duration = performance.now() - startTime
      logCommentOperation("delete", authError.context?.userId, targetLabel, "failure", duration, {
        requestId,
        reason: "auth_error",
        authErrorCode: authError.code,
        statusCode: authError.statusCode,
      })

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

    commentsLogger.debug("Starting comment delete operation", {
      requestId,
      userId: user.id,
      commentId,
    })

    if (!commentId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "Comment ID is required")
    }

    const clientIP = extractClientIP(request.headers) ?? ip
    const rateLimitResult = await checkCommentRate({
      userId: user.id,
      ip: clientIP,
      action: "delete",
    })

    if (!rateLimitResult.allowed) {
      await auditLogger.logEvent({
        action: "DELETE_COMMENT_DENIED",
        resource: `comment:${commentId}`,
        details: {
          reason: "RATE_LIMITED",
          retryAfter: rateLimitResult.retryAfter,
        },
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        success: false,
      })

      const duration = performance.now() - startTime
      logCommentOperation("delete", user.id, targetLabel, "failure", duration, {
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

    await measureOperation("delete", async () => {
      return await deleteComment(commentId, user.id, user.role === "ADMIN")
    })

    await auditLogger.logEvent({
      action: "DELETE_COMMENT",
      resource: `comment:${commentId}`,
      details: {
        isHardDelete: false,
        isAdmin: user.role === "ADMIN",
      },
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      success: true,
    })

    const duration = performance.now() - startTime
    logCommentOperation("delete", user.id, targetLabel, "success", duration, {
      requestId,
      isAdmin: user.role === "ADMIN",
      actorRole,
      actorStatus,
    })

    return createSuccessResponse({ deleted: true })
  } catch (error) {
    const duration = performance.now() - startTime

    if (error instanceof CommentServiceError) {
      if (commentId) {
        if (error.code === CommentErrorCode.COMMENT_NOT_FOUND) {
          await auditLogger.logEvent({
            action: "DELETE_COMMENT_DENIED",
            resource: `comment:${commentId}`,
            details: {
              reason: "NOT_FOUND",
            },
            userId: actorId,
            ipAddress: ip,
            userAgent: ua,
            success: false,
          })
        } else if (error.code === CommentErrorCode.UNAUTHORIZED) {
          await auditLogger.logEvent({
            action: "DELETE_COMMENT_DENIED",
            resource: `comment:${commentId}`,
            details: {
              reason: "FORBIDDEN",
            },
            userId: actorId,
            ipAddress: ip,
            userAgent: ua,
            success: false,
          })
        }
      }

      logCommentOperation("delete", actorId, targetLabel, "failure", duration, {
        requestId,
        errorCode: error.code,
        actorRole,
        actorStatus,
      })

      return respondWithCommentError(error)
    }

    logCommentOperation("delete", actorId, targetLabel, "failure", duration, {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      actorRole,
      actorStatus,
    })

    return handleApiError(error)
  }
}
