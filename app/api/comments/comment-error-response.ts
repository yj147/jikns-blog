import { CommentErrorCode, CommentServiceError } from "@/lib/interactions"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"

export function respondWithCommentError(error: CommentServiceError) {
  const details = {
    commentErrorCode: error.code,
    context: error.context ?? null,
  }

  switch (error.code) {
    case CommentErrorCode.TARGET_NOT_FOUND:
      return createErrorResponse(
        ErrorCode.TARGET_NOT_FOUND,
        "评论目标不存在",
        details,
        error.status
      )
    case CommentErrorCode.PARENT_NOT_FOUND:
      return createErrorResponse(ErrorCode.NOT_FOUND, "父级评论不存在", details, error.status)
    case CommentErrorCode.PARENT_DELETED:
      return createErrorResponse(
        ErrorCode.INVALID_PARAMETERS,
        "无法回复已删除的评论",
        details,
        error.status
      )
    case CommentErrorCode.PARENT_MISMATCH:
      return createErrorResponse(
        ErrorCode.INVALID_PARAMETERS,
        "父级评论不属于当前目标",
        details,
        error.status
      )
    case CommentErrorCode.COMMENT_NOT_FOUND:
      return createErrorResponse(ErrorCode.NOT_FOUND, "评论不存在", details, error.status)
    case CommentErrorCode.UNAUTHORIZED:
      return createErrorResponse(ErrorCode.FORBIDDEN, "无权执行此操作", details, error.status)
    case CommentErrorCode.TARGET_MISSING_REFERENCE:
    default:
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, details, error.status)
  }
}
