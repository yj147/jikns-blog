/**
 * 错误处理 Hook - 统一错误处理接口
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import { useCallback, useRef, useState } from "react"
import {
  AppError,
  ErrorHandlingConfig,
  ErrorHandlingResult,
  SecurityErrorType,
  NetworkErrorType,
  BusinessErrorType,
} from "@/types/error"
import { ErrorFactory, errorHandler, RetryManager } from "@/lib/error-handling"
import { toast } from "@/hooks/use-toast"

export interface UseErrorHandlerOptions {
  showToast?: boolean
  autoRetry?: boolean
  maxRetries?: number
  onError?: (error: AppError) => void
  onRecovery?: (error: AppError, successful: boolean) => void
}

export interface UseErrorHandlerReturn {
  // 错误处理方法
  handleError: (
    error: Error | AppError | string,
    config?: Partial<ErrorHandlingConfig>
  ) => Promise<ErrorHandlingResult>
  handleHttpError: (
    response: Response,
    context?: { action?: string; component?: string }
  ) => Promise<ErrorHandlingResult>
  handleSecurityError: (
    type: SecurityErrorType,
    message: string,
    context?: any
  ) => Promise<ErrorHandlingResult>
  handleNetworkError: (
    type: NetworkErrorType,
    message: string,
    context?: any
  ) => Promise<ErrorHandlingResult>
  handleBusinessError: (
    type: BusinessErrorType,
    message: string,
    context?: any
  ) => Promise<ErrorHandlingResult>

  // 错误状态
  currentError: AppError | null
  isHandling: boolean
  hasError: boolean

  // 错误恢复
  retry: () => Promise<boolean>
  clearError: () => void

  // 错误统计
  errorCount: number
  lastErrorTime: number | null
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const { showToast = true, autoRetry = true, maxRetries = 3, onError, onRecovery } = options

  const [currentError, setCurrentError] = useState<AppError | null>(null)
  const [isHandling, setIsHandling] = useState(false)
  const [errorCount, setErrorCount] = useState(0)
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null)

  const retryManagerRef = useRef<RetryManager>(new RetryManager())
  const lastRetryOperationRef = useRef<(() => Promise<any>) | null>(null)

  /**
   * 通用错误处理器
   */
  const handleError = useCallback(
    async (
      error: Error | AppError | string,
      config?: Partial<ErrorHandlingConfig>
    ): Promise<ErrorHandlingResult> => {
      setIsHandling(true)
      setErrorCount((prev) => prev + 1)
      setLastErrorTime(Date.now())

      try {
        const errorConfig: Partial<ErrorHandlingConfig> = {
          showNotification: showToast,
          autoRetry,
          retryStrategy: {
            maxRetries,
            baseDelay: 1000,
            maxDelay: 10000,
            exponentialBackoff: true,
            jitter: true,
          },
          ...config,
        }

        const result = await errorHandler.handle(error, errorConfig)

        // 更新当前错误状态
        if (typeof error === "string") {
          const appError = ErrorFactory.createSystemError(error, "操作失败")
          setCurrentError(appError)
          onError?.(appError)
        } else if (error instanceof Error) {
          const appError = ErrorFactory.fromError(error)
          setCurrentError(appError)
          onError?.(appError)
        } else {
          setCurrentError(error)
          onError?.(error)
        }

        return result
      } catch (handlingError) {
        console.error("错误处理器失败:", handlingError)

        // 显示紧急错误 Toast
        if (showToast) {
          toast({
            title: "系统错误",
            description: "错误处理器发生异常，请稍后重试",
            variant: "destructive",
          })
        }

        return {
          handled: false,
          logged: false,
          userNotified: showToast,
        }
      } finally {
        setIsHandling(false)
      }
    },
    [showToast, autoRetry, maxRetries, onError]
  )

  /**
   * HTTP 错误处理
   */
  const handleHttpError = useCallback(
    async (
      response: Response,
      context?: { action?: string; component?: string }
    ): Promise<ErrorHandlingResult> => {
      return errorHandler.handleHttpError(response, context)
    },
    []
  )

  /**
   * 安全错误处理
   */
  const handleSecurityError = useCallback(
    async (
      type: SecurityErrorType,
      message: string,
      context?: any
    ): Promise<ErrorHandlingResult> => {
      const error = ErrorFactory.createSecurityError(type, message, message, context)
      return handleError(error)
    },
    [handleError]
  )

  /**
   * 网络错误处理
   */
  const handleNetworkError = useCallback(
    async (
      type: NetworkErrorType,
      message: string,
      context?: any
    ): Promise<ErrorHandlingResult> => {
      const error = ErrorFactory.createNetworkError(type, message, message, context)
      return handleError(error)
    },
    [handleError]
  )

  /**
   * 业务错误处理
   */
  const handleBusinessError = useCallback(
    async (
      type: BusinessErrorType,
      message: string,
      context?: any
    ): Promise<ErrorHandlingResult> => {
      const error = ErrorFactory.createBusinessError(type, message, message, context)
      return handleError(error)
    },
    [handleError]
  )

  /**
   * 重试上次失败的操作
   */
  const retry = useCallback(async (): Promise<boolean> => {
    const operation = lastRetryOperationRef.current
    if (!operation || !currentError?.retryable) {
      return false
    }

    try {
      setIsHandling(true)

      const success = await retryManagerRef.current.retry(
        operation,
        {
          maxRetries,
          baseDelay: 1000,
          maxDelay: 10000,
          exponentialBackoff: true,
          jitter: true,
        },
        currentError.id
      )

      if (success) {
        setCurrentError(null)
        if (showToast) {
          toast({
            title: "操作成功",
            description: "重试成功，操作已完成",
            variant: "default",
          })
        }
      }

      onRecovery?.(currentError, success)
      return success
    } catch (error) {
      console.error("重试失败:", error)
      onRecovery?.(currentError, false)
      return false
    } finally {
      setIsHandling(false)
    }
  }, [currentError, maxRetries, showToast, onRecovery])

  /**
   * 清除当前错误
   */
  const clearError = useCallback(() => {
    setCurrentError(null)
    setErrorCount(0)
    setLastErrorTime(null)
    lastRetryOperationRef.current = null
  }, [])

  /**
   * 记录可重试的操作
   */
  const registerRetryOperation = useCallback((operation: () => Promise<any>) => {
    lastRetryOperationRef.current = operation
  }, [])

  return {
    // 错误处理方法
    handleError,
    handleHttpError,
    handleSecurityError,
    handleNetworkError,
    handleBusinessError,

    // 错误状态
    currentError,
    isHandling,
    hasError: currentError !== null,

    // 错误恢复
    retry,
    clearError,

    // 错误统计
    errorCount,
    lastErrorTime,
  }
}

export default useErrorHandler
