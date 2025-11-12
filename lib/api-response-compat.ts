/**
 * API 响应工具兼容层
 * 提供向后兼容的导出，便于渐进式迁移
 */

// 重新导出统一响应工具的所有内容使用 export type
export type { ApiResponse, PaginationMeta } from "@/lib/api/unified-response"

export {
  ErrorCode,
  createSuccessResponse,
  createPaginatedResponse,
  createErrorResponse,
  validateRequestData,
  parsePaginationParams,
} from "@/lib/api/unified-response"

// 导出统一的错误处理器
export { handleApiError } from "@/lib/api/error-handler"

// 为旧代码提供兼容的别名
export { createSuccessResponse as successResponse } from "@/lib/api/unified-response"
export { createErrorResponse as errorResponse } from "@/lib/api/unified-response"
export { handleApiError as handleError } from "@/lib/api/error-handler"

// 兼容旧的类型定义
export type { ApiResponse as ApiResponseType } from "@/lib/api/unified-response"

// 为兼容旧的三参数调用，提供一个包装函数
import { NextResponse } from "next/server"
import {
  createSuccessResponse as _createSuccessResponse,
  type ApiResponse,
} from "@/lib/api/unified-response"

export function createLegacySuccessResponse<T>(
  data: T,
  statusCodeOrMeta?: number | Partial<ApiResponse<T>["meta"]>,
  messageOrUndefined?: string
): NextResponse<ApiResponse<T>> {
  // 如果第二个参数是数字，则为旧的三参数调用
  if (typeof statusCodeOrMeta === "number") {
    return _createSuccessResponse(data, {
      message: messageOrUndefined,
    } as any)
  }
  // 否则为新的两参数调用
  return _createSuccessResponse(data, statusCodeOrMeta)
}
