/**
 * 错误处理工具
 * Phase 4.1 安全性增强 - 统一错误处理机制
 */

import { logger } from "./utils/logger"

export enum AuthErrorType {
  SESSION_EXPIRED = "SESSION_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCOUNT_BANNED = "ACCOUNT_BANNED",
  NETWORK_ERROR = "NETWORK_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED",
  REGISTRATION_FAILED = "REGISTRATION_FAILED",
  GITHUB_AUTH_FAILED = "GITHUB_AUTH_FAILED",
}

export interface AuthError {
  type: AuthErrorType
  message: string
  code?: string
  details?: any
}

export class AuthErrorFactory {
  static create(type: AuthErrorType, message: string, code?: string, details?: any): AuthError {
    return { type, message, code, details }
  }
}

/**
 * 错误处理器
 */
export class ErrorHandler {
  /**
   * 处理各种类型的错误
   */
  static async handleError(error: any): Promise<AuthError> {
    // Supabase 认证错误
    if (error?.message?.includes("JWT expired")) {
      return {
        type: AuthErrorType.SESSION_EXPIRED,
        message: "会话已过期，请重新登录",
        code: "JWT_EXPIRED",
      }
    }

    if (error?.message?.includes("Invalid JWT")) {
      return {
        type: AuthErrorType.TOKEN_INVALID,
        message: "认证令牌无效，请重新登录",
        code: "JWT_INVALID",
      }
    }

    // 权限错误
    if (error?.message?.includes("权限不足") || error?.status === 403) {
      return {
        type: AuthErrorType.INSUFFICIENT_PERMISSIONS,
        message: "权限不足，无法执行此操作",
        code: "INSUFFICIENT_PERMISSIONS",
      }
    }

    // 账户被封禁
    if (error?.message?.includes("账户已被封禁")) {
      return {
        type: AuthErrorType.ACCOUNT_BANNED,
        message: "您的账户已被封禁，如有疑问请联系管理员",
        code: "ACCOUNT_BANNED",
      }
    }

    // 网络错误
    if (error?.name === "NetworkError" || error?.code === "NETWORK_ERROR") {
      return {
        type: AuthErrorType.NETWORK_ERROR,
        message: "网络连接失败，请检查网络后重试",
        code: "NETWORK_ERROR",
      }
    }

    // 验证错误
    if (error?.message?.includes("验证失败") || error?.status === 400) {
      return {
        type: AuthErrorType.VALIDATION_ERROR,
        message: error.message || "输入数据验证失败",
        code: "VALIDATION_ERROR",
        details: error.details,
      }
    }

    // 默认错误
    // 序列化错误对象，避免 RSC 传递 Error 实例
    return {
      type: AuthErrorType.UNKNOWN_ERROR,
      message: error?.message || "发生未知错误",
      code: "UNKNOWN_ERROR",
      details:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : typeof error === "object"
            ? JSON.parse(JSON.stringify(error))
            : String(error),
    }
  }

  /**
   * 记录错误日志
   */
  static logError(error: AuthError, context?: string) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: error.type,
      message: error.message,
      code: error.code,
      context,
      details: error.details,
    }

    logger.error("错误记录", logData)

    // 在生产环境中可以发送到日志服务
    if (process.env.NODE_ENV === "production") {
      // 发送到错误监控服务 (如 Sentry)
      // sendToErrorService(logData)
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserFriendlyMessage(error: AuthError): string {
    const messages: Record<AuthErrorType, string> = {
      [AuthErrorType.SESSION_EXPIRED]: "您的登录已过期，请重新登录",
      [AuthErrorType.TOKEN_INVALID]: "登录信息无效，请重新登录",
      [AuthErrorType.INSUFFICIENT_PERMISSIONS]: "权限不足，无法执行此操作",
      [AuthErrorType.ACCOUNT_BANNED]: "账户已被限制，请联系管理员",
      [AuthErrorType.NETWORK_ERROR]: "网络连接失败，请重试",
      [AuthErrorType.VALIDATION_ERROR]: "输入信息有误，请检查后重试",
      [AuthErrorType.UNKNOWN_ERROR]: "操作失败，请稍后重试",
      [AuthErrorType.USER_NOT_FOUND]: "用户不存在",
      [AuthErrorType.INVALID_CREDENTIALS]: "用户名或密码错误",
      [AuthErrorType.EMAIL_ALREADY_REGISTERED]: "邮箱已被注册",
      [AuthErrorType.REGISTRATION_FAILED]: "注册失败",
      [AuthErrorType.GITHUB_AUTH_FAILED]: "GitHub 登录失败",
    }

    return messages[error.type] || error.message
  }

  /**
   * API 错误处理
   */
  static async handleApiError(error: any, context?: string): Promise<Response> {
    const authError = await this.handleError(error)
    this.logError(authError, context)

    return Response.json(
      {
        error: this.getUserFriendlyMessage(authError),
        code: authError.code,
      },
      { status: error.status || 500 }
    )
  }

  /**
   * 分类错误
   */
  static async classifyError(error: any): Promise<AuthError> {
    return await this.handleError(error)
  }

  /**
   * 创建客户端安全的响应
   */
  static createClientSafeResponse(error: AuthError): { error: string; code?: string } {
    return {
      error: this.getUserFriendlyMessage(error),
      code: error.code,
    }
  }
}

// 导出便捷函数
export function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)))
      }
    }
  }

  throw lastError
}
