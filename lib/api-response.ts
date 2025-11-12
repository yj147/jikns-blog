import { logger } from "@/lib/utils/logger"
import { NextResponse } from "next/server"

/**
 * API 响应格式化工具
 * 为动态发布系统提供统一的响应格式
 */

/**
 * 分页元数据接口
 * @deprecated 请使用 @/lib/api/unified-response 中的 PaginationMeta 替代
 * 该定义将在未来版本中移除，统一使用 unified-response.ts 中的定义
 *
 * 迁移指引：
 * - import { PaginationMeta } from "@/lib/api/unified-response"
 * - unified-response 版本的 page 字段为可选（支持 cursor 分页）
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  hasMore: boolean
  nextCursor?: string | null
}

// 统一API响应接口
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    pagination?: PaginationMeta
    timestamp: string
  }
}

// 动态模块错误码枚举
export enum ActivityErrorCode {
  // 400 级别 - 客户端错误
  CONTENT_REQUIRED = "ACTIVITY_CONTENT_REQUIRED",
  CONTENT_TOO_LONG = "ACTIVITY_CONTENT_TOO_LONG",
  TOO_MANY_IMAGES = "ACTIVITY_TOO_MANY_IMAGES",
  VALIDATION_ERROR = "ACTIVITY_VALIDATION_ERROR",
  NO_FILES = "UPLOAD_NO_FILES",
  TOO_MANY_FILES = "UPLOAD_TOO_MANY_FILES",
  TOTAL_SIZE_EXCEEDED = "UPLOAD_TOTAL_SIZE_EXCEEDED",
  INVALID_FILE_TYPE = "UPLOAD_INVALID_FILE_TYPE",
  FILE_TOO_LARGE = "UPLOAD_FILE_TOO_LARGE",
  MISSING_PATH = "UPLOAD_MISSING_PATH",
  ALL_UPLOADS_FAILED = "UPLOAD_ALL_FAILED",

  // 401 级别 - 认证错误
  AUTH_REQUIRED = "ACTIVITY_AUTH_REQUIRED",

  // 403 级别 - 授权错误
  USER_BANNED = "ACTIVITY_USER_BANNED",
  PERMISSION_DENIED = "ACTIVITY_PERMISSION_DENIED",

  // 404 级别 - 资源不存在
  NOT_FOUND = "ACTIVITY_NOT_FOUND",

  // 429 级别 - 速率限制
  RATE_LIMIT = "ACTIVITY_RATE_LIMIT",

  // 500 级别 - 服务器错误
  INTERNAL_ERROR = "ACTIVITY_INTERNAL_ERROR",
  DELETE_FAILED = "UPLOAD_DELETE_FAILED",
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  pagination?: PaginationMeta
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(pagination && { pagination }),
    },
  }

  return NextResponse.json(response, { status })
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: string | ActivityErrorCode,
  message: string,
  status: number = 400,
  details?: any
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }

  return NextResponse.json(response, { status })
}

/**
 * 创建分页成功响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  status: number = 200
): NextResponse<ApiResponse<T[]>> {
  return createSuccessResponse(data, status, pagination)
}

/**
 * 错误码到HTTP状态码的映射
 */
export const errorCodeToHttpStatus: Record<string, number> = {
  // 400 级别
  [ActivityErrorCode.CONTENT_REQUIRED]: 400,
  [ActivityErrorCode.CONTENT_TOO_LONG]: 400,
  [ActivityErrorCode.TOO_MANY_IMAGES]: 400,
  [ActivityErrorCode.VALIDATION_ERROR]: 400,
  [ActivityErrorCode.NO_FILES]: 400,
  [ActivityErrorCode.TOO_MANY_FILES]: 400,
  [ActivityErrorCode.TOTAL_SIZE_EXCEEDED]: 400,
  [ActivityErrorCode.INVALID_FILE_TYPE]: 400,
  [ActivityErrorCode.FILE_TOO_LARGE]: 400,
  [ActivityErrorCode.MISSING_PATH]: 400,
  [ActivityErrorCode.ALL_UPLOADS_FAILED]: 400,

  // 401 级别
  [ActivityErrorCode.AUTH_REQUIRED]: 401,

  // 403 级别
  [ActivityErrorCode.USER_BANNED]: 403,
  [ActivityErrorCode.PERMISSION_DENIED]: 403,

  // 404 级别
  [ActivityErrorCode.NOT_FOUND]: 404,

  // 429 级别
  [ActivityErrorCode.RATE_LIMIT]: 429,

  // 500 级别
  [ActivityErrorCode.INTERNAL_ERROR]: 500,
  [ActivityErrorCode.DELETE_FAILED]: 500,
}

/**
 * 错误码到用户友好消息的映射
 */
export const errorCodeToUserMessage: Record<string, string> = {
  [ActivityErrorCode.CONTENT_REQUIRED]: "请输入动态内容",
  [ActivityErrorCode.CONTENT_TOO_LONG]: "动态内容过长，最多5000个字符",
  [ActivityErrorCode.TOO_MANY_IMAGES]: "图片数量过多，最多上传9张",
  [ActivityErrorCode.VALIDATION_ERROR]: "请求参数无效",
  [ActivityErrorCode.NO_FILES]: "请选择要上传的图片",
  [ActivityErrorCode.TOO_MANY_FILES]: "文件数量过多，最多上传9张图片",
  [ActivityErrorCode.TOTAL_SIZE_EXCEEDED]: "文件总大小超过限制（50MB）",
  [ActivityErrorCode.INVALID_FILE_TYPE]: "不支持的文件格式",
  [ActivityErrorCode.FILE_TOO_LARGE]: "单个文件大小超过限制（10MB）",
  [ActivityErrorCode.MISSING_PATH]: "缺少文件路径参数",
  [ActivityErrorCode.ALL_UPLOADS_FAILED]: "所有文件上传失败",
  [ActivityErrorCode.AUTH_REQUIRED]: "请先登录",
  [ActivityErrorCode.USER_BANNED]: "您的账户已被限制，无法进行此操作",
  [ActivityErrorCode.PERMISSION_DENIED]: "权限不足，无法进行此操作",
  [ActivityErrorCode.NOT_FOUND]: "内容不存在或已被删除",
  [ActivityErrorCode.RATE_LIMIT]: "操作过于频繁，请稍后再试",
  [ActivityErrorCode.INTERNAL_ERROR]: "服务器内部错误，请稍后重试",
  [ActivityErrorCode.DELETE_FAILED]: "删除文件失败",
}

/**
 * 根据错误码自动创建错误响应
 */
export function createAutoErrorResponse(
  code: ActivityErrorCode,
  customMessage?: string,
  details?: any
): NextResponse<ApiResponse> {
  const message = customMessage || errorCodeToUserMessage[code] || "未知错误"
  const status = errorCodeToHttpStatus[code] || 500

  return createErrorResponse(code, message, status, details)
}

/**
 * 包装异步API处理器，自动处理错误
 */
export function withErrorHandler<T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      logger.error("API处理器异常:", error as Error)

      // 如果是已知的API错误，直接返回
      if (error instanceof Error && error.name === "ApiError") {
        return createErrorResponse(ActivityErrorCode.INTERNAL_ERROR, error.message, 500)
      }

      // 未知错误，返回通用错误
      return createAutoErrorResponse(
        ActivityErrorCode.INTERNAL_ERROR,
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : "未知错误"
          : "服务器内部错误，请稍后重试"
      )
    }
  }
}

/**
 * API错误类
 */
export class ApiError extends Error {
  constructor(
    public code: ActivityErrorCode,
    message: string,
    public status: number = 400,
    public details?: any
  ) {
    super(message)
    this.name = "ApiError"
  }

  toResponse(): NextResponse<ApiResponse> {
    return createErrorResponse(this.code, this.message, this.status, this.details)
  }
}

/**
 * 验证结果接口
 */
export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  errors?: Array<{
    field: string
    message: string
    code?: string
  }>
}

/**
 * 创建验证错误响应
 */
export function createValidationErrorResponse(
  errors: ValidationResult["errors"]
): NextResponse<ApiResponse> {
  return createErrorResponse(ActivityErrorCode.VALIDATION_ERROR, "请求参数验证失败", 400, {
    errors,
  })
}
