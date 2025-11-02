/**
 * API 错误处理工具函数
 * 统一的错误创建、分类和处理机制
 */

import { NextResponse } from "next/server"

/**
 * 错误类型枚举
 */
export enum ApiErrorType {
  // 客户端错误 (4xx)
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
  CONFLICT = "CONFLICT",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",

  // 服务器错误 (5xx)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  BAD_GATEWAY = "BAD_GATEWAY",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",

  // 业务错误
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * API 错误接口
 */
export interface ApiError {
  type: ApiErrorType
  message: string
  details?: any
  code?: string
  field?: string
  statusCode: number
  severity: ErrorSeverity
  timestamp: string
  requestId?: string
  path?: string
  method?: string
  stack?: string
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  field: string
  message: string
  value?: any
  code?: string
}

/**
 * API 响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  errors?: ValidationError[]
  message?: string
  timestamp: string
  requestId?: string
}

/**
 * 错误类型到 HTTP 状态码的映射
 */
const ERROR_STATUS_MAP: Record<ApiErrorType, number> = {
  [ApiErrorType.BAD_REQUEST]: 400,
  [ApiErrorType.UNAUTHORIZED]: 401,
  [ApiErrorType.FORBIDDEN]: 403,
  [ApiErrorType.NOT_FOUND]: 404,
  [ApiErrorType.METHOD_NOT_ALLOWED]: 405,
  [ApiErrorType.CONFLICT]: 409,
  [ApiErrorType.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorType.TOO_MANY_REQUESTS]: 429,
  [ApiErrorType.INTERNAL_SERVER_ERROR]: 500,
  [ApiErrorType.NOT_IMPLEMENTED]: 501,
  [ApiErrorType.BAD_GATEWAY]: 502,
  [ApiErrorType.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorType.GATEWAY_TIMEOUT]: 504,
  [ApiErrorType.VALIDATION_ERROR]: 422,
  [ApiErrorType.AUTHENTICATION_ERROR]: 401,
  [ApiErrorType.AUTHORIZATION_ERROR]: 403,
  [ApiErrorType.DATABASE_ERROR]: 500,
  [ApiErrorType.EXTERNAL_SERVICE_ERROR]: 502,
  [ApiErrorType.RATE_LIMIT_ERROR]: 429,
}

/**
 * 错误严重级别映射
 */
const ERROR_SEVERITY_MAP: Record<ApiErrorType, ErrorSeverity> = {
  [ApiErrorType.BAD_REQUEST]: ErrorSeverity.LOW,
  [ApiErrorType.UNAUTHORIZED]: ErrorSeverity.MEDIUM,
  [ApiErrorType.FORBIDDEN]: ErrorSeverity.MEDIUM,
  [ApiErrorType.NOT_FOUND]: ErrorSeverity.LOW,
  [ApiErrorType.METHOD_NOT_ALLOWED]: ErrorSeverity.LOW,
  [ApiErrorType.CONFLICT]: ErrorSeverity.MEDIUM,
  [ApiErrorType.UNPROCESSABLE_ENTITY]: ErrorSeverity.LOW,
  [ApiErrorType.TOO_MANY_REQUESTS]: ErrorSeverity.MEDIUM,
  [ApiErrorType.INTERNAL_SERVER_ERROR]: ErrorSeverity.CRITICAL,
  [ApiErrorType.NOT_IMPLEMENTED]: ErrorSeverity.MEDIUM,
  [ApiErrorType.BAD_GATEWAY]: ErrorSeverity.HIGH,
  [ApiErrorType.SERVICE_UNAVAILABLE]: ErrorSeverity.HIGH,
  [ApiErrorType.GATEWAY_TIMEOUT]: ErrorSeverity.HIGH,
  [ApiErrorType.VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ApiErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.MEDIUM,
  [ApiErrorType.AUTHORIZATION_ERROR]: ErrorSeverity.MEDIUM,
  [ApiErrorType.DATABASE_ERROR]: ErrorSeverity.CRITICAL,
  [ApiErrorType.EXTERNAL_SERVICE_ERROR]: ErrorSeverity.HIGH,
  [ApiErrorType.RATE_LIMIT_ERROR]: ErrorSeverity.MEDIUM,
}

/**
 * 创建 API 错误
 */
export function createApiError(
  type: ApiErrorType,
  message: string,
  details?: any,
  options: {
    code?: string
    field?: string
    requestId?: string
    path?: string
    method?: string
    stack?: string
  } = {}
): ApiError {
  const statusCode = ERROR_STATUS_MAP[type]
  const severity = ERROR_SEVERITY_MAP[type]

  return {
    type,
    message,
    details,
    statusCode,
    severity,
    timestamp: new Date().toISOString(),
    ...options,
  }
}

/**
 * 创建验证错误
 */
export function createValidationError(
  field: string,
  message: string,
  value?: any,
  code?: string
): ValidationError {
  return {
    field,
    message,
    value,
    code,
  }
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  }
}

/**
 * 创建错误响应
 */
export function createErrorResponse(error: ApiError, requestId?: string): ApiResponse {
  return {
    success: false,
    error: {
      ...error,
      requestId: requestId || error.requestId,
    },
    timestamp: new Date().toISOString(),
    requestId: requestId || error.requestId,
  }
}

/**
 * 创建验证错误响应
 */
export function createValidationErrorResponse(
  errors: ValidationError[],
  message: string = "验证失败",
  requestId?: string
): ApiResponse {
  return {
    success: false,
    errors,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  }
}

/**
 * Next.js API 错误响应
 */
export function nextApiErrorResponse(error: ApiError, requestId?: string): NextResponse {
  const response = createErrorResponse(error, requestId)
  return NextResponse.json(response, { status: error.statusCode })
}

/**
 * Next.js API 成功响应
 */
export function nextApiSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string,
  status: number = 200
): NextResponse {
  const response = createSuccessResponse(data, message, requestId)
  return NextResponse.json(response, { status })
}

/**
 * Next.js API 验证错误响应
 */
export function nextApiValidationErrorResponse(
  errors: ValidationError[],
  message?: string,
  requestId?: string
): NextResponse {
  const response = createValidationErrorResponse(errors, message, requestId)
  return NextResponse.json(response, { status: 422 })
}

/**
 * 处理未知错误
 */
export function handleUnknownError(
  error: unknown,
  requestId?: string,
  path?: string,
  method?: string
): ApiError {
  // 如果已经是 ApiError，直接返回
  if (isApiError(error)) {
    return error
  }

  // 如果是标准 Error 对象
  if (error instanceof Error) {
    return createApiError(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      error.message || "内部服务器错误",
      { originalError: error.name },
      {
        requestId,
        path,
        method,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }
    )
  }

  // 处理 Prisma 错误
  if (isPrismaError(error)) {
    return handlePrismaError(error as any, requestId, path, method)
  }

  // 处理 Zod 验证错误
  if (isZodError(error)) {
    return createApiError(ApiErrorType.VALIDATION_ERROR, "数据验证失败", error, {
      requestId,
      path,
      method,
    })
  }

  // 未知错误
  return createApiError(
    ApiErrorType.INTERNAL_SERVER_ERROR,
    "发生未知错误",
    { error: String(error) },
    { requestId, path, method }
  )
}

/**
 * 检查是否为 API 错误
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "message" in error &&
    "statusCode" in error
  )
}

/**
 * 检查是否为 Prisma 错误
 */
function isPrismaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as any).code === "string" &&
    (error as any).code.startsWith("P")
  )
}

/**
 * 检查是否为 Zod 错误
 */
function isZodError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as any).issues)
  )
}

/**
 * 处理 Prisma 错误
 */
function handlePrismaError(
  error: any,
  requestId?: string,
  path?: string,
  method?: string
): ApiError {
  const prismaCode = error.code

  switch (prismaCode) {
    case "P2002":
      return createApiError(
        ApiErrorType.CONFLICT,
        "数据已存在，违反唯一约束",
        { field: error.meta?.target },
        { code: prismaCode, requestId, path, method }
      )

    case "P2025":
      return createApiError(ApiErrorType.NOT_FOUND, "请求的资源不存在", undefined, {
        code: prismaCode,
        requestId,
        path,
        method,
      })

    case "P2003":
      return createApiError(
        ApiErrorType.BAD_REQUEST,
        "违反外键约束",
        { field: error.meta?.field_name },
        { code: prismaCode, requestId, path, method }
      )

    case "P2021":
      return createApiError(
        ApiErrorType.DATABASE_ERROR,
        "数据库表不存在",
        { table: error.meta?.table },
        { code: prismaCode, requestId, path, method }
      )

    default:
      return createApiError(
        ApiErrorType.DATABASE_ERROR,
        error.message || "数据库操作失败",
        { prismaCode },
        { code: prismaCode, requestId, path, method }
      )
  }
}

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * 错误日志记录
 */
export function logError(error: ApiError, context?: Record<string, any>): void {
  const logData = {
    timestamp: error.timestamp,
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    severity: error.severity,
    requestId: error.requestId,
    path: error.path,
    method: error.method,
    details: error.details,
    context,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  }

  // 根据严重级别选择日志方法
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      console.error("🚨 CRITICAL ERROR:", logData)
      break
    case ErrorSeverity.HIGH:
      console.error("❗ HIGH SEVERITY ERROR:", logData)
      break
    case ErrorSeverity.MEDIUM:
      console.warn("⚠️  MEDIUM SEVERITY ERROR:", logData)
      break
    case ErrorSeverity.LOW:
    default:
      console.info("ℹ️  ERROR:", logData)
      break
  }
}

/**
 * 错误统计和监控
 */
export interface ErrorMetrics {
  count: number
  lastOccurrence: Date
  averageResponseTime?: number
  affectedUsers?: string[]
}

// 简单的内存错误统计（生产环境应使用 Redis 或数据库）
const errorMetrics = new Map<string, ErrorMetrics>()

/**
 * 记录错误指标
 */
export function recordErrorMetric(error: ApiError, responseTime?: number, userId?: string): void {
  const key = `${error.type}:${error.statusCode}`
  const existing = errorMetrics.get(key)

  if (existing) {
    existing.count++
    existing.lastOccurrence = new Date()

    if (responseTime && existing.averageResponseTime) {
      existing.averageResponseTime = (existing.averageResponseTime + responseTime) / 2
    }

    if (userId && existing.affectedUsers) {
      existing.affectedUsers.push(userId)
      // 保持最近的50个用户
      existing.affectedUsers = [...new Set(existing.affectedUsers)].slice(-50)
    }
  } else {
    errorMetrics.set(key, {
      count: 1,
      lastOccurrence: new Date(),
      averageResponseTime: responseTime,
      affectedUsers: userId ? [userId] : [],
    })
  }
}

/**
 * 获取错误统计
 */
export function getErrorMetrics(): Record<string, ErrorMetrics> {
  return Object.fromEntries(errorMetrics)
}
