/**
 * API 错误消息常量
 *
 * 统一管理所有 API 路由的错误消息，便于维护和国际化。
 *
 * 命名规范：
 * - 使用 UPPER_SNAKE_CASE
 * - 按功能模块分组
 * - 使用 as const 确保类型安全
 *
 * 使用示例：
 * ```typescript
 * import { API_ERROR_MESSAGES } from "@/lib/api/error-messages"
 *
 * return createErrorResponse(
 *   ErrorCode.VALIDATION_ERROR,
 *   API_ERROR_MESSAGES.INVALID_TARGET_TYPE
 * )
 * ```
 */

// ============================================================================
// 通用验证错误
// ============================================================================

export const API_ERROR_MESSAGES = {
  // 参数验证
  INVALID_TARGET_TYPE: "无效的目标类型",
  MISSING_TARGET_TYPE: "缺少 targetType 参数",
  MISSING_TARGET_ID: "缺少 targetId 参数",
  MISSING_TARGET_TYPE_OR_ID: "缺少必需参数 targetType 或 targetId",
  MISSING_POST_ID: "缺少 postId 参数",
  MISSING_USER_ID: "缺少 userId 参数",
  MISSING_REQUIRED_FIELDS: "缺少必需参数",
  INVALID_ACTION: "无效的操作类型",
  INVALID_BOOKMARK_ACTION: "无效的 action 参数，支持: status, list",

  // 权限错误
  FORBIDDEN_VIEW_BOOKMARKS: "无权查看其他用户的收藏列表",

  // 限流错误
  RATE_LIMIT_EXCEEDED: "操作过于频繁，请稍后再试",
} as const

// 导出类型，用于 TypeScript 类型检查
export type ApiErrorMessage = (typeof API_ERROR_MESSAGES)[keyof typeof API_ERROR_MESSAGES]
