/**
 * 统一的API响应工具
 * 合并 api-guards.ts 和 api-response.ts 的功能
 * 为整个项目提供一致的响应格式
 */

import { NextResponse } from "next/server"
import { Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"
import type { AuthenticatedUser } from "@/lib/auth/session"

// 分页元数据接口
export interface PaginationMeta {
  page?: number // 游标分页时可选
  limit: number
  total: number | null
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
    statusCode?: number
    details?: any
    timestamp?: string
  }
  meta?: {
    requestId?: string
    timestamp: string
    user?: Partial<AuthenticatedUser>
    pagination?: PaginationMeta
    filters?: Record<string, unknown>
  }
}

// 错误代码枚举
export enum ErrorCode {
  // 认证错误
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INVALID_TOKEN = "INVALID_TOKEN",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  ACCOUNT_BANNED = "ACCOUNT_BANNED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  // 业务错误
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS",
  MISSING_POST_ID = "MISSING_POST_ID",

  // 用户相关错误
  TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
  TARGET_USER_NOT_FOUND = "TARGET_USER_NOT_FOUND",
  CANNOT_FOLLOW_SELF = "CANNOT_FOLLOW_SELF",
  ALREADY_FOLLOWING = "ALREADY_FOLLOWING",
  NOT_FOLLOWING_YET = "NOT_FOLLOWING_YET",

  // 内容相关错误
  POST_NOT_FOUND = "POST_NOT_FOUND",
  UNSAFE_CONTENT = "UNSAFE_CONTENT",
  UNSUPPORTED_TARGET_TYPE = "UNSUPPORTED_TARGET_TYPE",
  UNSUPPORTED_INTERACTION_TYPE = "UNSUPPORTED_INTERACTION_TYPE",

  // 操作失败错误
  HANDLE_LIKE_FAILED = "HANDLE_LIKE_FAILED",
  HANDLE_FOLLOW_FAILED = "HANDLE_FOLLOW_FAILED",
  HANDLE_BOOKMARK_FAILED = "HANDLE_BOOKMARK_FAILED",
  GET_POSTS_FAILED = "GET_POSTS_FAILED",
  CREATE_POST_FAILED = "CREATE_POST_FAILED",
  UPDATE_POST_STATUS_FAILED = "UPDATE_POST_STATUS_FAILED",
  DELETE_POST_FAILED = "DELETE_POST_FAILED",

  // 系统错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",

  // 活动相关错误
  ACTIVITY_NOT_FOUND = "ACTIVITY_NOT_FOUND",
  ACTIVITY_CREATION_FAILED = "ACTIVITY_CREATION_FAILED",
  INVALID_ACTIVITY_DATA = "INVALID_ACTIVITY_DATA",
}

const ERROR_CODE_SET = new Set<ErrorCode>(Object.values(ErrorCode))

// HTTP状态码映射
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.ACCOUNT_BANNED]: 403,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.INVALID_PARAMETERS]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELDS]: 400,
  [ErrorCode.MISSING_POST_ID]: 400,
  [ErrorCode.TARGET_NOT_FOUND]: 404,
  [ErrorCode.TARGET_USER_NOT_FOUND]: 404,
  [ErrorCode.CANNOT_FOLLOW_SELF]: 400,
  [ErrorCode.ALREADY_FOLLOWING]: 409,
  [ErrorCode.NOT_FOLLOWING_YET]: 409,
  [ErrorCode.POST_NOT_FOUND]: 404,
  [ErrorCode.UNSAFE_CONTENT]: 400,
  [ErrorCode.UNSUPPORTED_TARGET_TYPE]: 400,
  [ErrorCode.UNSUPPORTED_INTERACTION_TYPE]: 400,
  [ErrorCode.HANDLE_LIKE_FAILED]: 500,
  [ErrorCode.HANDLE_FOLLOW_FAILED]: 500,
  [ErrorCode.HANDLE_BOOKMARK_FAILED]: 500,
  [ErrorCode.GET_POSTS_FAILED]: 500,
  [ErrorCode.CREATE_POST_FAILED]: 500,
  [ErrorCode.UPDATE_POST_STATUS_FAILED]: 500,
  [ErrorCode.DELETE_POST_FAILED]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.LIMIT_EXCEEDED]: 429,
  [ErrorCode.NETWORK_ERROR]: 500,
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.ACTIVITY_NOT_FOUND]: 404,
  [ErrorCode.ACTIVITY_CREATION_FAILED]: 500,
  [ErrorCode.INVALID_ACTIVITY_DATA]: 400,
}

export function normalizeErrorCode(code?: string): ErrorCode {
  if (!code) {
    return ErrorCode.INTERNAL_ERROR
  }

  if (ERROR_CODE_SET.has(code as ErrorCode)) {
    return code as ErrorCode
  }

  return ErrorCode.INTERNAL_ERROR
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ApiResponse<T>["meta"]>
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }

  const res = NextResponse.json(response, { status: 200 })
  // 如果提供了 requestId，则在响应头附加 X-Request-ID，便于端到端追踪
  if (response.meta?.requestId) {
    res.headers.set("X-Request-ID", String(response.meta.requestId))
  }
  return res
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  meta?: Partial<ApiResponse<T[]>["meta"]>
): NextResponse<ApiResponse<T[]>> {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination,
      ...meta,
    },
  }

  const res = NextResponse.json(response, { status: 200 })
  if (response.meta?.requestId) {
    res.headers.set("X-Request-ID", String(response.meta.requestId))
  }
  return res
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  statusCode?: number,
  meta?: Partial<ApiResponse["meta"]>
): NextResponse<ApiResponse> {
  const status = statusCode || ERROR_STATUS_MAP[code] || 500

  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      statusCode: status,
      details,
      timestamp: new Date().toISOString(),
    },
    meta: {
      timestamp: new Date().toISOString(),
      // 兼容：若 details 中包含 requestId，则自动透传到 meta，除非 meta 已显式提供
      requestId: meta?.requestId ?? details?.requestId,
      ...meta,
    },
  }

  // 记录错误日志
  if (status >= 500) {
    logger.error(`API Error [${code}]: ${message}`, details)
  } else if (status >= 400) {
    logger.warn(`API Warning [${code}]: ${message}`, details)
  }

  const res = NextResponse.json(response, { status })
  if (response.meta?.requestId) {
    res.headers.set("X-Request-ID", String(response.meta.requestId))
  }
  return res
}

/**
 * 验证请求数据
 */
export function validateRequestData<T>(
  data: any,
  required: (keyof T)[]
): { valid: boolean; missing?: string[] } {
  const missing = required.filter((key) => !data[key])

  if (missing.length > 0) {
    return { valid: false, missing: missing as string[] }
  }

  return { valid: true }
}

/**
 * 解析分页参数
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number
  limit: number
  cursor?: string
} {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")))
  const cursor = searchParams.get("cursor") || undefined

  return { page, limit, cursor }
}
