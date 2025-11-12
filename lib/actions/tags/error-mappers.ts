/**
 * 标签模块错误映射辅助函数
 * 这些是纯函数，不需要 "use server" 指令
 */

import type { ApiResponse as UnifiedApiResponse } from "@/lib/api/unified-response"
import { isAuthError } from "@/lib/error-handling/auth-error"
import { createErrorResponse } from "./response-helpers"
import { logger } from "@/lib/utils/logger"

type ApiResponse<T = any> = UnifiedApiResponse<T>

export function mapTagRateLimitError(error: unknown): ApiResponse | null {
  const statusCode = (error as any)?.statusCode as number | undefined
  if (statusCode === 429) {
    return createErrorResponse("RATE_LIMIT_EXCEEDED", (error as Error).message, {
      retryAfter: (error as any)?.retryAfter,
      statusCode,
    })
  }
  return null
}

export function mapTagAuthError(error: unknown): ApiResponse | null {
  if (isAuthError(error)) {
    return createErrorResponse(error.code, error.message, {
      statusCode: error.statusCode,
    })
  }

  if (error instanceof Error) {
    const legacyMessage = error.message.trim()

    const errorMap: Record<string, { code: string; message: string; statusCode: number }> = {
      用户未登录: { code: "UNAUTHORIZED", message: "请先登录", statusCode: 401 },
      未登录用户: { code: "UNAUTHORIZED", message: "请先登录", statusCode: 401 },
      需要管理员权限: { code: "FORBIDDEN", message: "需要管理员权限", statusCode: 403 },
      账户已被封禁: { code: "ACCOUNT_BANNED", message: "账号已被封禁", statusCode: 403 },
      账号已被封禁: { code: "ACCOUNT_BANNED", message: "账号已被封禁", statusCode: 403 },
    }

    const mappedError = errorMap[legacyMessage]
    if (mappedError) {
      return createErrorResponse(mappedError.code, mappedError.message, {
        statusCode: mappedError.statusCode,
      })
    }
  }

  return null
}

export function handleTagMutationError(
  error: unknown,
  operation: string,
  options: { notFoundMessage?: string } = {}
): ApiResponse {
  if ((error as any)?.code === "P2002") {
    const metaTarget = (error as any)?.meta?.target
    const target = Array.isArray(metaTarget) ? metaTarget.join(", ") : String(metaTarget || "")
    const message = target.includes("slug") ? "标签标识已存在" : "标签名称已存在"
    return createErrorResponse("DUPLICATE_ENTRY", message, { target })
  }

  if ((error as any)?.code === "P2025") {
    return createErrorResponse("NOT_FOUND", options.notFoundMessage ?? "目标记录不存在或已被处理")
  }

  const authError = mapTagAuthError(error)
  if (authError) return authError

  const rateLimitError = mapTagRateLimitError(error)
  if (rateLimitError) return rateLimitError

  logger.error(`${operation}失败:`, error as Error)
  return createErrorResponse("INTERNAL_ERROR", `${operation}失败`)
}
