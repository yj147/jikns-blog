/**
 * 认证错误处理模块
 * 统一的认证错误类型定义和错误处理函数
 *
 * Phase 4.1 Quality Enhancement:
 * - 全局化认证错误处理
 * - 结构化日志与审计事件
 * - 统一错误响应格式
 */

import { authLogger } from "@/lib/utils/logger"

/**
 * 认证错误代码枚举
 * 标准化认证相关的错误类型
 */
export type AuthErrorCode =
  | "UNAUTHORIZED" // 401: 未认证/令牌无效
  | "FORBIDDEN" // 403: 权限不足
  | "INVALID_TOKEN" // 401: 令牌格式错误或已过期
  | "SESSION_EXPIRED" // 401: 会话已过期
  | "ACCOUNT_BANNED" // 403: 账号被封禁
  | "INVALID_CREDENTIALS" // 401: 用户名或密码错误
  | "NETWORK_ERROR" // 500/0: 网络连接错误
  | "VALIDATION_ERROR" // 400: 请求数据验证失败
  | "UNKNOWN_ERROR" // 500: 未知错误

/**
 * 认证错误类
 * 统一的认证错误处理，支持结构化日志和审计
 */
export class AuthError extends Error {
  public readonly name = "AuthError"
  public readonly timestamp: Date
  public readonly requestId?: string

  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly statusCode: number = 401,
    public readonly context?: {
      requestId?: string
      userId?: string
      path?: string
      ip?: string
      ua?: string
    }
  ) {
    super(message)
    this.timestamp = new Date()
    this.requestId = context?.requestId

    // 确保错误栈追踪正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError)
    }

    // 记录结构化错误日志
    this._logError()
  }

  /**
   * 记录结构化错误日志
   * @private
   */
  private _logError(): void {
    authLogger.warn(`认证错误: ${this.code}`, {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      requestId: this.context?.requestId,
      userId: this.context?.userId,
      path: this.context?.path,
      ip: this.context?.ip,
      ua: this.context?.ua,
    })
  }

  /**
   * 转换为 JSON 格式（用于 API 响应）
   */
  toJSON() {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        timestamp: this.timestamp.toISOString(),
        requestId: this.requestId,
      },
    }
  }

  /**
   * 创建标准化的 API 错误响应
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
      },
      requestId: this.requestId,
      timestamp: this.timestamp.toISOString(),
    }
  }
}

/**
 * 认证审计事件类型
 * 用于审计日志和安全监控
 */
export interface AuthAuditEvent {
  // 基础事件信息
  event:
    | "auth_success"
    | "auth_failure"
    | "permission_denied"
    | "session_created"
    | "session_expired"

  // 请求上下文
  requestId: string
  timestamp: Date
  path: string
  ip?: string
  userAgent?: string

  // 用户信息
  userId?: string
  userEmail?: string | null
  userRole?: "USER" | "ADMIN"

  // 策略信息
  policy?: string
  requiredPermission?: string

  // 错误信息
  errorCode?: AuthErrorCode
  errorMessage?: string

  // 额外元数据
  metadata?: Record<string, any>
}

/**
 * 根据错误代码获取HTTP状态码
 * @param code 认证错误代码
 * @returns HTTP状态码
 */
const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_TOKEN: 401,
  SESSION_EXPIRED: 401,
  ACCOUNT_BANNED: 403,
  INVALID_CREDENTIALS: 401,
  NETWORK_ERROR: 500,
  VALIDATION_ERROR: 400,
  UNKNOWN_ERROR: 500,
}

export function getAuthErrorStatus(code: AuthErrorCode): number {
  return AUTH_ERROR_STATUS[code] ?? 401
}

/**
 * 创建认证审计事件
 * 用于安全监控和合规审计
 *
 * @param event 审计事件
 */
export function createAuthAuditEvent(event: AuthAuditEvent): void {
  authLogger.info("认证审计事件", {
    auditEvent: event.event,
    requestId: event.requestId,
    timestamp: event.timestamp.toISOString(),
    path: event.path,
    ip: event.ip,
    userAgent: event.userAgent,
    userId: event.userId,
    userEmail: event.userEmail,
    userRole: event.userRole,
    policy: event.policy,
    requiredPermission: event.requiredPermission,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    metadata: event.metadata,
  })
}

/**
 * 检查是否为认证错误
 * @param error 错误对象
 * @returns 是否为认证错误
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError
}

/**
 * 常见认证错误的便捷创建函数
 */
export const AuthErrors = {
  /**
   * 未认证错误
   */
  unauthorized: (context?: { requestId?: string; path?: string }) =>
    new AuthError("请先登录", "UNAUTHORIZED", 401, context),

  /**
   * 权限不足错误
   */
  forbidden: (
    message: string = "权限不足",
    context?: { requestId?: string; userId?: string; path?: string }
  ) => new AuthError(message, "FORBIDDEN", 403, context),

  /**
   * 令牌无效错误
   */
  invalidToken: (context?: { requestId?: string }) =>
    new AuthError("令牌无效", "INVALID_TOKEN", 401, context),

  /**
   * 会话过期错误
   */
  sessionExpired: (context?: { requestId?: string; userId?: string }) =>
    new AuthError("会话已过期", "SESSION_EXPIRED", 401, context),

  /**
   * 账号被封禁错误
   */
  accountBanned: (context?: { requestId?: string; userId?: string }) =>
    new AuthError("账户已被封禁", "ACCOUNT_BANNED", 403, context),

  /**
   * 凭据无效错误
   */
  invalidCredentials: (context?: { requestId?: string; ip?: string }) =>
    new AuthError("用户名或密码错误", "INVALID_CREDENTIALS", 401, context),

  /**
   * 网络错误
   */
  networkError: (
    message: string = "网络连接失败，请检查网络后重试",
    context?: { requestId?: string; path?: string }
  ) => new AuthError(message, "NETWORK_ERROR", 500, context),

  /**
   * 验证错误
   */
  validationError: (
    message: string = "输入数据验证失败",
    context?: { requestId?: string; path?: string }
  ) => new AuthError(message, "VALIDATION_ERROR", 400, context),

  /**
   * 未知错误
   */
  unknownError: (
    message: string = "发生未知错误",
    context?: { requestId?: string; path?: string }
  ) => new AuthError(message, "UNKNOWN_ERROR", 500, context),
}
