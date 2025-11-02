/**
 * 重试 Hook - 简化重试逻辑实现
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import { useCallback, useRef, useState } from "react"
import { RetryStrategy } from "@/types/error"
import { RetryManager } from "@/lib/error-handling"
import { toast } from "@/hooks/use-toast"

export interface UseRetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  exponentialBackoff?: boolean
  jitter?: boolean
  showToast?: boolean
  onSuccess?: () => void
  onFailure?: (error: any) => void
  onRetryAttempt?: (attempt: number) => void
}

export interface UseRetryReturn {
  // 重试状态
  isRetrying: boolean
  retryCount: number
  canRetry: boolean

  // 重试操作
  retry: <T>(operation: () => Promise<T>, operationId?: string) => Promise<T>
  retryLast: () => Promise<any>
  cancel: () => void
  reset: () => void

  // 重试信息
  lastError: any
  nextRetryIn: number | null // 下次重试剩余时间（毫秒）
}

export function useRetry(options: UseRetryOptions = {}): UseRetryReturn {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBackoff = true,
    jitter = true,
    showToast = true,
    onSuccess,
    onFailure,
    onRetryAttempt,
  } = options

  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<any>(null)
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null)

  const retryManagerRef = useRef<RetryManager>(new RetryManager())
  const lastOperationRef = useRef<(() => Promise<any>) | null>(null)
  const lastOperationIdRef = useRef<string | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 重试策略
   */
  const retryStrategy: RetryStrategy = {
    maxRetries,
    baseDelay,
    maxDelay,
    exponentialBackoff,
    jitter,
  }

  /**
   * 是否可以重试
   */
  const canRetry = retryCount < maxRetries && !isRetrying

  /**
   * 启动倒计时
   */
  const startCountdown = useCallback((delay: number) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }

    setNextRetryIn(delay)

    countdownIntervalRef.current = setInterval(() => {
      setNextRetryIn((prev) => {
        if (prev === null || prev <= 1000) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          return null
        }
        return prev - 1000
      })
    }, 1000)
  }, [])

  /**
   * 停止倒计时
   */
  const stopCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setNextRetryIn(null)
  }, [])

  /**
   * 执行重试
   */
  const retry = useCallback(
    async <T>(operation: () => Promise<T>, operationId?: string): Promise<T> => {
      // 保存操作以供后续重试
      lastOperationRef.current = operation
      lastOperationIdRef.current = operationId || `retry_${Date.now()}`

      setIsRetrying(true)
      setLastError(null)
      stopCountdown()

      try {
        const result = await retryManagerRef.current.retry(
          async () => {
            try {
              setRetryCount((prev) => prev + 1)
              onRetryAttempt?.(retryCount + 1)

              if (showToast && retryCount > 0) {
                toast({
                  title: "正在重试",
                  description: `第 ${retryCount + 1} 次重试尝试中...`,
                  duration: 2000,
                })
              }

              const result = await operation()
              return result
            } catch (error) {
              setLastError(error)

              // 如果不是最后一次尝试，启动倒计时
              if (retryCount < maxRetries - 1) {
                const delay = calculateNextDelay()
                startCountdown(delay)
              }

              throw error
            }
          },
          retryStrategy,
          lastOperationIdRef.current
        )

        // 成功后重置状态
        setRetryCount(0)
        setLastError(null)
        onSuccess?.()

        if (showToast && retryCount > 0) {
          toast({
            title: "重试成功",
            description: "操作已成功完成",
            variant: "default",
          })
        }

        return result
      } catch (error) {
        setLastError(error)
        onFailure?.(error)

        if (showToast) {
          toast({
            title: "重试失败",
            description: `经过 ${maxRetries} 次尝试后仍然失败，请稍后重试`,
            variant: "destructive",
          })
        }

        throw error
      } finally {
        setIsRetrying(false)
        stopCountdown()
      }
    },
    [
      retryCount,
      maxRetries,
      retryStrategy,
      showToast,
      onSuccess,
      onFailure,
      onRetryAttempt,
      startCountdown,
      stopCountdown,
    ]
  )

  /**
   * 重试上一次的操作
   */
  const retryLast = useCallback(async () => {
    const operation = lastOperationRef.current
    const operationId = lastOperationIdRef.current

    if (!operation) {
      throw new Error("没有可以重试的操作")
    }

    return retry(operation, operationId ?? undefined)
  }, [retry])

  /**
   * 取消当前重试
   */
  const cancel = useCallback(() => {
    if (lastOperationIdRef.current) {
      retryManagerRef.current.cancelRetry(lastOperationIdRef.current)
    }
    setIsRetrying(false)
    stopCountdown()
  }, [stopCountdown])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    cancel()
    setRetryCount(0)
    setLastError(null)
    lastOperationRef.current = null
    lastOperationIdRef.current = null
  }, [cancel])

  /**
   * 计算下次重试延迟
   */
  const calculateNextDelay = useCallback(() => {
    let delay = baseDelay

    if (exponentialBackoff) {
      delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)
    }

    if (jitter) {
      const jitterAmount = delay * 0.1
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount
      delay = Math.max(0, delay + randomJitter)
    }

    return Math.min(delay, maxDelay)
  }, [baseDelay, exponentialBackoff, maxDelay, jitter, retryCount])

  return {
    // 重试状态
    isRetrying,
    retryCount,
    canRetry,

    // 重试操作
    retry,
    retryLast,
    cancel,
    reset,

    // 重试信息
    lastError,
    nextRetryIn,
  }
}

export default useRetry
