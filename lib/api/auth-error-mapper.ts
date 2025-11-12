/**
 * 认证错误码映射工具
 * 将 AuthError 的错误码映射为统一响应的 ErrorCode
 *
 * Phase 4.2 Code Quality Enhancement:
 * - 消除重复代码（DRY 原则）
 * - 统一认证错误处理逻辑
 * - 符合 Linus "好品味"标准：消除特殊情况分支
 */

import type { AuthError } from "@/lib/error-handling/auth-error"
import { ErrorCode } from "@/lib/api/unified-response"

/**
 * 将 AuthError 的错误码映射为统一响应的 ErrorCode
 *
 * 映射规则：
 * - 认证失效场景 → ErrorCode.UNAUTHORIZED (401)
 *   - UNAUTHORIZED, SESSION_EXPIRED, INVALID_TOKEN, TOKEN_EXPIRED, INVALID_CREDENTIALS
 * - 权限不足场景 → ErrorCode.FORBIDDEN (403)
 *   - FORBIDDEN, ACCOUNT_BANNED
 * - 验证错误 → ErrorCode.VALIDATION_ERROR (400)
 * - 网络错误 → ErrorCode.INTERNAL_ERROR (500)
 * - 其他 → ErrorCode.UNKNOWN_ERROR (500)
 *
 * @param authError 认证错误对象
 * @returns 统一响应的错误码
 *
 * @example
 * ```typescript
 * const [user, authError] = await assertPolicy("user-active", {...})
 * if (authError) {
 *   const errorCode = mapAuthErrorCode(authError)
 *   return createErrorResponse(errorCode, authError.message, undefined, authError.statusCode)
 * }
 * ```
 */
export function mapAuthErrorCode(authError: AuthError): ErrorCode {
  // 使用 switch 语句消除嵌套三元运算符，符合 Linus "简洁执念"
  // 将所有认证失效场景统一映射为 UNAUTHORIZED，确保前端能正确触发重新登录流程
  switch (authError.code) {
    // 认证失效场景：统一返回 401，触发前端重新登录
    case "UNAUTHORIZED":
    case "SESSION_EXPIRED":
    case "INVALID_TOKEN":
    case "INVALID_CREDENTIALS":
      return ErrorCode.UNAUTHORIZED

    // 权限不足场景：返回 403
    case "FORBIDDEN":
    case "ACCOUNT_BANNED":
      return ErrorCode.FORBIDDEN

    // 验证错误：返回 400
    case "VALIDATION_ERROR":
      return ErrorCode.VALIDATION_ERROR

    // 网络错误：返回 500
    case "NETWORK_ERROR":
      return ErrorCode.INTERNAL_ERROR

    // 未知错误：返回 500
    default:
      return ErrorCode.UNKNOWN_ERROR
  }
}
