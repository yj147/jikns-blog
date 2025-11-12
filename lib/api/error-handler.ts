/**
 * API路由统一错误处理器
 * 将不同类型的错误转换为标准的NextResponse
 *
 * Linus原则：消除特殊情况，所有错误以统一方式处理
 */

import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"
import { AuthError, isAuthError } from "@/lib/error-handling/auth-error"
import { createErrorResponse, ErrorCode } from "./unified-response"
import { logger } from "@/lib/utils/logger"

/**
 * 统一的API错误处理器
 * 自动识别错误类型并返回合适的响应
 *
 * 使用示例：
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   try {
 *     const user = await requireAuth()
 *     // 业务逻辑...
 *     return NextResponse.json({ data })
 *   } catch (error) {
 *     return handleApiError(error)
 *   }
 * }
 * ```
 *
 * @param error 任何类型的错误
 * @returns 标准化的NextResponse
 */
export function handleApiError(error: unknown): NextResponse {
  // 处理认证错误（AuthError）
  if (isAuthError(error)) {
    return handleAuthError(error)
  }

  // 处理 Prisma 错误（类型安全的错误检查）
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: 唯一约束冲突
    if (error.code === "P2002") {
      return createErrorResponse(ErrorCode.DUPLICATE_ENTRY, "数据已存在", {
        originalError: error.message,
      })
    }

    // P2025: 记录不存在
    if (error.code === "P2025") {
      return createErrorResponse(ErrorCode.NOT_FOUND, "数据不存在", {
        originalError: error.message,
      })
    }

    // P2003: 外键约束失败
    if (error.code === "P2003") {
      return createErrorResponse(ErrorCode.NOT_FOUND, "关联数据不存在", {
        originalError: error.message,
      })
    }

    // 其他 Prisma 已知错误
    logger.error("Prisma 已知错误:", {
      code: error.code,
      message: error.message,
      meta: error.meta,
    })
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "数据库操作失败", {
      code: error.code,
      originalError: error.message,
    })
  }

  // 通用 Error 处理
  if (error instanceof Error) {
    logger.error("API错误:", {
      message: error.message,
      stack: error.stack,
    })

    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message || "服务器内部错误", {
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }

  // 未知错误类型
  logger.error("未知API错误:", { error })
  return createErrorResponse(ErrorCode.UNKNOWN_ERROR, "未知错误", { error: String(error) })
}

/**
 * 处理认证错误（AuthError）
 * 将AuthError转换为标准API响应
 *
 * @param error AuthError实例
 * @returns 标准化的NextResponse
 */
function handleAuthError(error: AuthError): NextResponse {
  // 映射AuthError code到ErrorCode
  const errorCodeMap: Record<string, ErrorCode> = {
    UNAUTHORIZED: ErrorCode.UNAUTHORIZED,
    FORBIDDEN: ErrorCode.FORBIDDEN,
    ACCOUNT_BANNED: ErrorCode.ACCOUNT_BANNED,
    INVALID_TOKEN: ErrorCode.INVALID_TOKEN,
    SESSION_EXPIRED: ErrorCode.SESSION_EXPIRED,
    INVALID_CREDENTIALS: ErrorCode.INVALID_CREDENTIALS,
  }

  const code = errorCodeMap[error.code] || ErrorCode.UNAUTHORIZED

  return createErrorResponse(
    code,
    error.message,
    {
      requestId: error.requestId,
      timestamp: error.timestamp.toISOString(),
    },
    error.statusCode
  )
}

/**
 * try-catch包装器 - 用于简化API路由错误处理
 * 自动捕获异常并返回标准错误响应
 *
 * 使用示例：
 * ```typescript
 * export const POST = withErrorHandler(async (request: NextRequest) => {
 *   const user = await requireAuth()
 *   // 不需要try-catch，错误会自动处理
 *   return NextResponse.json({ data })
 * })
 * ```
 *
 * @param handler API路由处理函数
 * @returns 包装后的处理函数
 */
export function withErrorHandler<T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
