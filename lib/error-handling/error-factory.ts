/**
 * 错误工厂类 - 统一错误创建和分类
 * Phase 5: 前端错误处理与用户体验优化
 */

// 简单的 UUID 生成器，避免额外依赖
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
import {
  AppError,
  ErrorType,
  SecurityErrorType,
  NetworkErrorType,
  BusinessErrorType,
  ErrorContext,
} from "@/types/error"

class ErrorFactory {
  /**
   * 创建安全相关错误
   */
  static createSecurityError(
    subType: SecurityErrorType,
    message: string,
    userMessage: string,
    context?: Partial<ErrorContext>,
    details?: Record<string, any>
  ): AppError {
    return {
      id: generateId(),
      type: ErrorType.SECURITY,
      subType,
      message,
      userMessage,
      details,
      timestamp: Date.now(),
      recoverable: this.isRecoverableSecurityError(subType),
      retryable: false, // 安全错误通常不可重试
      severity: this.getSecurityErrorSeverity(subType),
      source: "client",
      context: this.buildContext(context),
    }
  }

  /**
   * 创建网络相关错误
   */
  static createNetworkError(
    subType: NetworkErrorType,
    message: string,
    userMessage: string,
    context?: Partial<ErrorContext>,
    details?: Record<string, any>
  ): AppError {
    return {
      id: generateId(),
      type: ErrorType.NETWORK,
      subType,
      message,
      userMessage,
      details,
      timestamp: Date.now(),
      recoverable: true, // 网络错误通常可恢复
      retryable: this.isRetryableNetworkError(subType),
      severity: this.getNetworkErrorSeverity(subType),
      source: "client",
      context: this.buildContext(context),
    }
  }

  /**
   * 创建业务逻辑错误
   */
  static createBusinessError(
    subType: BusinessErrorType,
    message: string,
    userMessage: string,
    context?: Partial<ErrorContext>,
    details?: Record<string, any>
  ): AppError {
    return {
      id: generateId(),
      type: ErrorType.BUSINESS,
      subType,
      message,
      userMessage,
      details,
      timestamp: Date.now(),
      recoverable: this.isRecoverableBusinessError(subType),
      retryable: false, // 业务错误通常不可重试
      severity: this.getBusinessErrorSeverity(subType),
      source: "client",
      context: this.buildContext(context),
    }
  }

  /**
   * 创建系统错误
   */
  static createSystemError(
    message: string,
    userMessage: string,
    error?: Error,
    context?: Partial<ErrorContext>
  ): AppError {
    return {
      id: generateId(),
      type: ErrorType.SYSTEM,
      message,
      userMessage,
      details: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      timestamp: Date.now(),
      recoverable: false,
      retryable: false,
      severity: "critical",
      source: "client",
      stackTrace: error?.stack,
      context: this.buildContext(context),
    }
  }

  /**
   * 从 HTTP 响应创建错误
   */
  static fromHttpResponse(
    status: number,
    statusText: string,
    responseBody?: any,
    context?: Partial<ErrorContext>
  ): AppError {
    const errorId = generateId()

    // 根据状态码分类错误类型
    if (status === 401) {
      return this.createSecurityError(
        SecurityErrorType.AUTH_REQUIRED,
        `HTTP ${status}: ${statusText}`,
        "请先登录后再进行此操作",
        context,
        { status, statusText, responseBody }
      )
    }

    if (status === 403) {
      return this.createSecurityError(
        SecurityErrorType.INSUFFICIENT_PERMISSIONS,
        `HTTP ${status}: ${statusText}`,
        "您没有权限执行此操作",
        context,
        { status, statusText, responseBody }
      )
    }

    if (status === 404) {
      return this.createBusinessError(
        BusinessErrorType.RESOURCE_NOT_FOUND,
        `HTTP ${status}: ${statusText}`,
        "请求的资源不存在",
        context,
        { status, statusText, responseBody }
      )
    }

    if (status === 409) {
      return this.createBusinessError(
        BusinessErrorType.DUPLICATE_RESOURCE,
        `HTTP ${status}: ${statusText}`,
        "资源已存在，无法重复创建",
        context,
        { status, statusText, responseBody }
      )
    }

    if (status === 422) {
      return this.createBusinessError(
        BusinessErrorType.VALIDATION_FAILED,
        `HTTP ${status}: ${statusText}`,
        "提交的数据格式不正确，请检查后重试",
        context,
        { status, statusText, responseBody }
      )
    }

    if (status === 429) {
      return this.createNetworkError(
        NetworkErrorType.RATE_LIMITED,
        `HTTP ${status}: ${statusText}`,
        "请求过于频繁，请稍后再试",
        context,
        { status, statusText, responseBody }
      )
    }

    if (status >= 500) {
      return this.createNetworkError(
        NetworkErrorType.SERVER_ERROR,
        `HTTP ${status}: ${statusText}`,
        "服务器暂时无法处理您的请求，请稍后重试",
        context,
        { status, statusText, responseBody }
      )
    }

    // 默认系统错误
    return this.createSystemError(
      `HTTP ${status}: ${statusText}`,
      "发生未知错误，请稍后重试",
      undefined,
      context
    )
  }

  /**
   * 从 JavaScript Error 创建 AppError
   */
  static fromError(error: Error, context?: Partial<ErrorContext>): AppError {
    // 网络连接错误
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      const appError = this.createNetworkError(
        NetworkErrorType.CONNECTION_FAILED,
        error.message,
        "网络连接失败，请检查网络后重试",
        context,
        { originalError: error.name }
      )

      return { ...appError, stackTrace: error.stack }
    }

    // 超时错误
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      const appError = this.createNetworkError(
        NetworkErrorType.TIMEOUT,
        error.message,
        "请求超时，请稍后重试",
        context,
        { originalError: error.name }
      )

      return { ...appError, stackTrace: error.stack }
    }

    // 默认系统错误
    return this.createSystemError(error.message, "发生未知错误，我们正在处理中", error, context)
  }

  /**
   * 构建错误上下文
   */
  private static buildContext(context?: Partial<ErrorContext>): ErrorContext {
    return {
      path: typeof window !== "undefined" ? window.location.pathname : "",
      userAgent: typeof window !== "undefined" ? navigator.userAgent : "",
      timestamp: Date.now(),
      ...context,
    }
  }

  /**
   * 判断安全错误是否可恢复
   */
  private static isRecoverableSecurityError(subType: SecurityErrorType): boolean {
    switch (subType) {
      case SecurityErrorType.SESSION_EXPIRED:
      case SecurityErrorType.TOKEN_INVALID:
      case SecurityErrorType.AUTH_REQUIRED:
        return true
      case SecurityErrorType.ACCOUNT_BANNED:
      case SecurityErrorType.INSUFFICIENT_PERMISSIONS:
      case SecurityErrorType.CSRF_FAILED:
        return false
      default:
        return false
    }
  }

  /**
   * 判断网络错误是否可重试
   */
  private static isRetryableNetworkError(subType: NetworkErrorType): boolean {
    switch (subType) {
      case NetworkErrorType.CONNECTION_FAILED:
      case NetworkErrorType.TIMEOUT:
      case NetworkErrorType.SERVER_ERROR:
        return true
      case NetworkErrorType.RATE_LIMITED:
        return false // 需要等待后重试
      case NetworkErrorType.OFFLINE:
        return false // 需要恢复网络连接
      default:
        return false
    }
  }

  /**
   * 判断业务错误是否可恢复
   */
  private static isRecoverableBusinessError(subType: BusinessErrorType): boolean {
    switch (subType) {
      case BusinessErrorType.VALIDATION_FAILED:
        return true // 用户可以修正输入
      case BusinessErrorType.RESOURCE_NOT_FOUND:
      case BusinessErrorType.DUPLICATE_RESOURCE:
      case BusinessErrorType.OPERATION_FAILED:
        return false
      default:
        return false
    }
  }

  /**
   * 获取安全错误严重程度
   */
  private static getSecurityErrorSeverity(
    subType: SecurityErrorType
  ): "low" | "medium" | "high" | "critical" {
    switch (subType) {
      case SecurityErrorType.CSRF_FAILED:
        return "critical"
      case SecurityErrorType.ACCOUNT_BANNED:
        return "high"
      case SecurityErrorType.INSUFFICIENT_PERMISSIONS:
        return "medium"
      case SecurityErrorType.SESSION_EXPIRED:
      case SecurityErrorType.TOKEN_INVALID:
      case SecurityErrorType.AUTH_REQUIRED:
        return "low"
      default:
        return "medium"
    }
  }

  /**
   * 获取网络错误严重程度
   */
  private static getNetworkErrorSeverity(
    subType: NetworkErrorType
  ): "low" | "medium" | "high" | "critical" {
    switch (subType) {
      case NetworkErrorType.SERVER_ERROR:
        return "high"
      case NetworkErrorType.CONNECTION_FAILED:
      case NetworkErrorType.TIMEOUT:
        return "medium"
      case NetworkErrorType.RATE_LIMITED:
      case NetworkErrorType.OFFLINE:
        return "low"
      default:
        return "medium"
    }
  }

  /**
   * 获取业务错误严重程度
   */
  private static getBusinessErrorSeverity(
    subType: BusinessErrorType
  ): "low" | "medium" | "high" | "critical" {
    switch (subType) {
      case BusinessErrorType.OPERATION_FAILED:
        return "medium"
      case BusinessErrorType.VALIDATION_FAILED:
      case BusinessErrorType.RESOURCE_NOT_FOUND:
      case BusinessErrorType.DUPLICATE_RESOURCE:
        return "low"
      default:
        return "low"
    }
  }
}

export default ErrorFactory
