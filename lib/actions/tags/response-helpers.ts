/**
 * 标签模块统一响应构造函数
 * 避免在 mutations.ts 和 queries.ts 中重复定义
 */

import type { ApiResponse, PaginationMeta } from "@/lib/api/unified-response"

export function createSuccessResponse<T>(data: T, pagination?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      ...(pagination && { pagination }),
      timestamp: new Date().toISOString(),
    },
  }
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  statusCode?: number
): ApiResponse {
  const derivedStatus =
    typeof statusCode === "number"
      ? statusCode
      : typeof details?.statusCode === "number"
        ? details.statusCode
        : undefined

  return {
    success: false,
    error: {
      code,
      message,
      statusCode: derivedStatus,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }
}
