/**
 * 交互模块统一错误处理
 *
 * 为 Like 和 Bookmark 等交互 API 提供统一的错误处理逻辑
 */

import { InteractionTargetNotFoundError } from "@/lib/interactions/errors"
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

  // 其他错误使用通用处理器
  const res = handleApiError(error)
  // 最低侵入：如果有 requestId，将其补充到响应头，便于链路追踪
  if (requestId) {
    res.headers.set("X-Request-ID", requestId)
  }
  return res
}
