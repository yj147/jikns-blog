/**
 * 统一错误处理器 - 错误分发、日志记录和用户通知
 * Phase 5: 前端错误处理与用户体验优化
 */

import * as React from "react"
import {
  AppError,
  ErrorType,
  ErrorHandlingConfig,
  ErrorHandlingResult,
  RecoveryAction,
  ErrorToastOptions,
} from "@/types/error"
import ErrorFactory from "./error-factory"
import RetryManager from "./retry-manager"
import ErrorLogger from "./error-logger"
import { toast } from "@/hooks/use-toast"

type ErrorEventListener = (error: AppError) => void

class ErrorHandler {
  private static instance: ErrorHandler
  private listeners: ErrorEventListener[] = []
  private retryManager: RetryManager
  private logger: ErrorLogger
  private defaultConfig: ErrorHandlingConfig

  private constructor() {
    this.retryManager = new RetryManager()
    this.logger = new ErrorLogger()
    this.defaultConfig = {
      showNotification: true,
      showDialog: false,
      autoRetry: true,
      retryStrategy: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        exponentialBackoff: true,
        jitter: true,
      },
      logToConsole: process.env.NODE_ENV === "development",
      logToServer: process.env.NODE_ENV === "production",
      showStackTrace: process.env.NODE_ENV === "development",
      recoveryActions: [],
    }
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * 处理错误的主入口
   */
  async handle(
    error: Error | AppError | string,
    config?: Partial<ErrorHandlingConfig>
  ): Promise<ErrorHandlingResult> {
    const appError = this.normalizeError(error)
    const finalConfig = { ...this.defaultConfig, ...config }

    const result: ErrorHandlingResult = {
      handled: true,
      logged: false,
      userNotified: false,
    }

    try {
      // 1. 记录错误
      if (finalConfig.logToConsole || finalConfig.logToServer) {
        await this.logger.log(appError, {
          console: finalConfig.logToConsole,
          server: finalConfig.logToServer,
          includeStackTrace: finalConfig.showStackTrace,
        })
        result.logged = true
      }

      // 2. 通知监听器
      this.notifyListeners(appError)

      // 3. 尝试自动恢复
      if (finalConfig.autoRetry && appError.retryable) {
        const retryResult = await this.attemptRetry(appError, finalConfig)
        result.recovery = retryResult
        if (retryResult.successful) {
          return result
        }
      }

      // 4. 显示用户通知
      if (finalConfig.showNotification) {
        this.showNotification(appError, finalConfig)
        result.userNotified = true
      }

      // 5. 显示错误对话框（严重错误）
      if (finalConfig.showDialog && appError.severity === "critical") {
        this.showErrorDialog(appError, finalConfig)
      }

      return result
    } catch (handlingError) {
      console.error("错误处理器本身发生错误:", handlingError)
      return {
        handled: false,
        logged: false,
        userNotified: false,
      }
    }
  }

  /**
   * 处理 HTTP 请求错误
   */
  async handleHttpError(
    response: Response,
    context?: { action?: string; component?: string }
  ): Promise<ErrorHandlingResult> {
    let responseBody: any
    try {
      responseBody = await response.json()
    } catch {
      responseBody = await response.text()
    }

    const error = ErrorFactory.fromHttpResponse(
      response.status,
      response.statusText,
      responseBody,
      context
    )

    return this.handle(error)
  }

  /**
   * 处理安全相关错误
   */
  async handleSecurityError(
    error: AppError,
    options?: {
      requiresReauth?: boolean
      redirectTo?: string
      showDialog?: boolean
    }
  ): Promise<ErrorHandlingResult> {
    const config: Partial<ErrorHandlingConfig> = {
      showDialog: options?.showDialog ?? true,
      recoveryActions: this.getSecurityRecoveryActions(error, options),
    }

    return this.handle(error, config)
  }

  /**
   * 处理网络错误
   */
  async handleNetworkError(
    error: AppError,
    options?: {
      retryCount?: number
      showOfflineMessage?: boolean
    }
  ): Promise<ErrorHandlingResult> {
    const config: Partial<ErrorHandlingConfig> = {
      autoRetry: true,
      retryStrategy: {
        ...this.defaultConfig.retryStrategy,
        maxRetries: options?.retryCount ?? 3,
      },
      recoveryActions: this.getNetworkRecoveryActions(error, options),
    }

    return this.handle(error, config)
  }

  /**
   * 添加错误事件监听器
   */
  addEventListener(listener: ErrorEventListener): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 清除所有监听器
   */
  clearListeners(): void {
    this.listeners = []
  }

  /**
   * 获取重试管理器实例
   */
  getRetryManager(): RetryManager {
    return this.retryManager
  }

  /**
   * 获取日志记录器实例
   */
  getLogger(): ErrorLogger {
    return this.logger
  }

  /**
   * 规范化错误对象
   */
  private normalizeError(error: Error | AppError | string): AppError {
    if (typeof error === "string") {
      return ErrorFactory.createSystemError(error, "操作失败，请稍后重试")
    }

    if (error instanceof Error) {
      return ErrorFactory.fromError(error)
    }

    return error as AppError
  }

  /**
   * 通知错误监听器
   */
  private notifyListeners(error: AppError): void {
    this.listeners.forEach((listener) => {
      try {
        listener(error)
      } catch (listenerError) {
        console.error("错误监听器执行失败:", listenerError)
      }
    })
  }

  /**
   * 尝试自动重试
   */
  private async attemptRetry(
    error: AppError,
    config: ErrorHandlingConfig
  ): Promise<{ attempted: boolean; successful: boolean; action?: string }> {
    if (!error.retryable) {
      return { attempted: false, successful: false }
    }

    try {
      const retryResult = await this.retryManager.retry(
        async () => {
          // 这里需要具体的重试逻辑，暂时返回 false
          return false
        },
        config.retryStrategy,
        error.id
      )

      return {
        attempted: true,
        successful: retryResult,
        action: "auto_retry",
      }
    } catch (retryError) {
      return {
        attempted: true,
        successful: false,
        action: "auto_retry_failed",
      }
    }
  }

  /**
   * 显示 Toast 通知
   */
  private showNotification(error: AppError, config: ErrorHandlingConfig): void {
    const toastOptions: ErrorToastOptions = {
      title: this.getErrorTitle(error),
      description: error.userMessage,
      variant: error.severity === "critical" ? "destructive" : "default",
      duration: this.getToastDuration(error),
    }

    // 添加恢复操作按钮 - 直接传递字符串而不是元素
    let actionElement: any = undefined
    if (config.recoveryActions.length > 0) {
      const primaryAction = config.recoveryActions.find((action) => action.primary)
      if (primaryAction) {
        actionElement = {
          altText: primaryAction.label,
          children: primaryAction.label,
          onClick: primaryAction.action as () => void,
        }
      }
    }

    toast({
      title: toastOptions.title,
      description: toastOptions.description,
      variant: toastOptions.variant,
      duration: toastOptions.duration,
      action: actionElement,
    })
  }

  /**
   * 显示错误对话框
   */
  private showErrorDialog(error: AppError, config: ErrorHandlingConfig): void {
    // TODO: 实现自定义错误对话框组件
  }

  /**
   * 获取错误标题
   */
  private getErrorTitle(error: AppError): string {
    switch (error.type) {
      case ErrorType.SECURITY:
        return "安全错误"
      case ErrorType.NETWORK:
        return "网络错误"
      case ErrorType.BUSINESS:
        return "操作失败"
      case ErrorType.SYSTEM:
        return "系统错误"
      case ErrorType.VALIDATION:
        return "验证错误"
      default:
        return "错误"
    }
  }

  /**
   * 获取 Toast 显示时间
   */
  private getToastDuration(error: AppError): number {
    switch (error.severity) {
      case "critical":
        return 10000 // 10秒
      case "high":
        return 7000 // 7秒
      case "medium":
        return 5000 // 5秒
      case "low":
        return 3000 // 3秒
      default:
        return 5000
    }
  }

  /**
   * 获取安全错误恢复操作
   */
  private getSecurityRecoveryActions(
    error: AppError,
    options?: { requiresReauth?: boolean; redirectTo?: string }
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = []

    if (error.recoverable && options?.requiresReauth) {
      actions.push({
        type: "redirect",
        label: "重新登录",
        action: () => {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
        },
        primary: true,
      })
    }

    if (options?.redirectTo) {
      actions.push({
        type: "redirect",
        label: "返回上级",
        action: () => {
          window.location.href = options.redirectTo!
        },
        variant: "outline",
      })
    }

    return actions
  }

  /**
   * 获取网络错误恢复操作
   */
  private getNetworkRecoveryActions(
    error: AppError,
    options?: { showOfflineMessage?: boolean }
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = []

    if (error.retryable) {
      actions.push({
        type: "retry",
        label: "重试",
        action: async () => {
          // 重试逻辑在具体组件中实现
          window.location.reload()
        },
        primary: true,
      })
    }

    actions.push({
      type: "refresh",
      label: "刷新页面",
      action: () => {
        window.location.reload()
      },
      variant: "outline",
    })

    return actions
  }
}

// 导出单例实例
export default ErrorHandler.getInstance()
