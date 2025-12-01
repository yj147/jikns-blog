/**
 * 交互模块统一错误处理
 *
 * 为 Like 和 Bookmark 等交互 API 提供统一的错误处理逻辑
 */

import {
  InteractionNotAllowedError,
  InteractionTargetNotFoundError,
} from "@/lib/interactions/errors"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"

/**
 * 处理交互操作中的错误
 *
 * @param error - 捕获的错误对象
 * @returns Next.js Response 对象
 *
 * @example
 * ```typescript
 * try {
 *   const status = await toggleLike("post", postId, userId)
 *   return createSuccessResponse(status)
 * } catch (error) {
 *   return handleInteractionError(error)
 * }
 * ```
 */
export function handleInteractionError(error: unknown, requestId?: string) {
  // 处理目标不存在错误
  if (error instanceof InteractionTargetNotFoundError) {
    return createErrorResponse(ErrorCode.NOT_FOUND, "目标不存在", { requestId })
  }

  if (error instanceof InteractionNotAllowedError) {
    const reason = error.reason
    const status =
      error.statusCode ??
      (reason === "AUTHOR_INACTIVE" || reason === "ACTOR_INACTIVE" ? 403 : 400)
    const code = status === 403 ? ErrorCode.FORBIDDEN : ErrorCode.VALIDATION_ERROR

    const defaultMessageMap: Record<typeof reason, string> = {
      SELF_LIKE: "不能给自己的内容点赞",
      TARGET_DELETED: "内容已删除，无法点赞",
      AUTHOR_INACTIVE: "作者状态异常，无法点赞",
      ACTOR_INACTIVE: "账户状态异常，无法点赞",
      LIKE_NOT_ALLOWED: "当前操作被禁止",
      ACTOR_NOT_FOUND: "用户不存在或未登录",
    }

    const message = error.message || defaultMessageMap[reason] || "互动操作被拒绝"

    return createErrorResponse(code, message, { requestId, reason }, status)
  }

  // 其他错误使用通用处理器
  const res = handleApiError(error)
  // 最低侵入：如果有 requestId，将其补充到响应头，便于链路追踪
  if (requestId) {
    res.headers.set("X-Request-ID", requestId)
  }
  return res
}
