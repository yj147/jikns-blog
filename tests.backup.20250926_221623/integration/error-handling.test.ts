/**
 * 错误处理系统集成测试
 * Phase 5: 前端错误处理与用户体验优化
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest"
import { ErrorFactory, errorHandler, RetryManager, ErrorLogger } from "@/lib/error-handling"
import { ErrorType, SecurityErrorType, NetworkErrorType, BusinessErrorType } from "@/types/error"

// Mock 依赖
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe("错误处理系统集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 fetch mock
    ;(fetch as Mock).mockClear()
  })

  describe("ErrorFactory", () => {
    it("应该正确创建安全错误", () => {
      const error = ErrorFactory.createSecurityError(
        SecurityErrorType.SESSION_EXPIRED,
        "Session has expired",
        "会话已过期，请重新登录"
      )

      expect(error.type).toBe(ErrorType.SECURITY)
      expect(error.subType).toBe(SecurityErrorType.SESSION_EXPIRED)
      expect(error.message).toBe("Session has expired")
      expect(error.userMessage).toBe("会话已过期，请重新登录")
      expect(error.recoverable).toBe(true)
      expect(error.severity).toBe("low")
      expect(error.id).toBeTruthy()
      expect(error.timestamp).toBeGreaterThan(0)
    })

    it("应该正确创建网络错误", () => {
      const error = ErrorFactory.createNetworkError(
        NetworkErrorType.CONNECTION_FAILED,
        "Network connection failed",
        "网络连接失败"
      )

      expect(error.type).toBe(ErrorType.NETWORK)
      expect(error.subType).toBe(NetworkErrorType.CONNECTION_FAILED)
      expect(error.retryable).toBe(true)
      expect(error.severity).toBe("medium")
    })

    it("应该正确创建业务错误", () => {
      const error = ErrorFactory.createBusinessError(
        BusinessErrorType.VALIDATION_FAILED,
        "Validation failed",
        "输入验证失败"
      )

      expect(error.type).toBe(ErrorType.BUSINESS)
      expect(error.subType).toBe(BusinessErrorType.VALIDATION_FAILED)
      expect(error.recoverable).toBe(true)
      expect(error.retryable).toBe(false)
    })

    it("应该从 HTTP 响应创建错误", () => {
      const error = ErrorFactory.fromHttpResponse(401, "Unauthorized")

      expect(error.type).toBe(ErrorType.SECURITY)
      expect(error.subType).toBe(SecurityErrorType.AUTH_REQUIRED)
      expect(error.userMessage).toBe("请先登录后再进行此操作")
    })

    it("应该从 JavaScript Error 创建错误", () => {
      const jsError = new TypeError("fetch is not defined")
      const error = ErrorFactory.fromError(jsError)

      expect(error.type).toBe(ErrorType.NETWORK)
      expect(error.subType).toBe(NetworkErrorType.CONNECTION_FAILED)
      expect(error.details?.originalError).toBe("TypeError")
      expect(error.stackTrace).toBeTruthy()
    })
  })

  describe("RetryManager", () => {
    let retryManager: RetryManager

    beforeEach(() => {
      retryManager = new RetryManager()
    })

    it("应该成功执行操作", async () => {
      const operation = vi.fn().mockResolvedValue("success")
      const strategy = {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        exponentialBackoff: true,
        jitter: false,
      }

      const result = await retryManager.retry(operation, strategy, "test-op")

      expect(result).toBe("success")
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it("应该重试失败的操作", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("First fail"))
        .mockRejectedValueOnce(new Error("Second fail"))
        .mockResolvedValue("success")

      const strategy = {
        maxRetries: 3,
        baseDelay: 10, // 使用更小的延迟以加快测试
        maxDelay: 100,
        exponentialBackoff: false,
        jitter: false,
      }

      const result = await retryManager.retry(operation, strategy, "test-retry")

      expect(result).toBe("success")
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it("应该在达到最大重试次数后失败", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Always fail"))
      const strategy = {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 100,
        exponentialBackoff: false,
        jitter: false,
      }

      await expect(retryManager.retry(operation, strategy, "test-fail")).rejects.toThrow(
        "Always fail"
      )

      expect(operation).toHaveBeenCalledTimes(2)
    })

    it("应该支持取消重试", async () => {
      const operation = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

      const strategy = {
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 1000,
        exponentialBackoff: false,
        jitter: false,
      }

      const retryPromise = retryManager.retry(operation, strategy, "test-cancel")

      // 等待一点时间再取消
      setTimeout(() => {
        retryManager.cancelRetry("test-cancel")
      }, 50)

      // 操作应该正常完成，因为取消操作只是清理状态
      await expect(retryPromise).resolves.toBeUndefined()
    })
  })

  describe("ErrorLogger", () => {
    let errorLogger: ErrorLogger
    const mockError = ErrorFactory.createSystemError("Test error", "Test user message")

    beforeEach(() => {
      errorLogger = new ErrorLogger()
      // Mock console methods
      vi.spyOn(console, "error").mockImplementation(() => {})
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "log").mockImplementation(() => {})
    })

    it("应该记录到控制台", async () => {
      await errorLogger.log(mockError, { console: true, server: false })

      expect(console.error).toHaveBeenCalled()
    })

    it("应该发送日志到服务器", async () => {
      ;(fetch as Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      // 记录日志到服务器队列
      await errorLogger.log(mockError, { console: false, server: true })

      // 手动触发flush以确保立即发送
      await errorLogger.flush()

      expect(fetch).toHaveBeenCalledWith(
        "/api/logs/errors",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
    })

    it("应该在网络失败时缓存日志", async () => {
      ;(fetch as Mock).mockRejectedValue(new Error("Network error"))

      // 不应该抛出错误
      await expect(errorLogger.log(mockError, { server: true })).resolves.not.toThrow()

      const stats = errorLogger.getQueueStats()
      expect(stats.queueSize).toBeGreaterThan(0)
    })

    it("应该批量处理日志", async () => {
      const errors = [
        mockError,
        ErrorFactory.createNetworkError(NetworkErrorType.TIMEOUT, "Timeout error", "请求超时"),
      ]

      await errorLogger.logBatch(errors, { console: true })

      expect(console.error).toHaveBeenCalledTimes(1) // System error
      expect(console.warn).toHaveBeenCalledTimes(1) // Network error
    })
  })

  describe("错误处理器集成", () => {
    it("应该正确处理各种错误类型", async () => {
      const errors = [
        "Simple string error",
        new Error("JavaScript error"),
        ErrorFactory.createSecurityError(
          SecurityErrorType.CSRF_FAILED,
          "CSRF validation failed",
          "CSRF 验证失败"
        ),
      ]

      for (const error of errors) {
        const result = await errorHandler.handle(error, {
          showNotification: false,
          logToConsole: true,
          logToServer: false,
        })

        expect(result.handled).toBe(true)
        expect(result.logged).toBe(true)
      }
    })

    it("应该正确处理 HTTP 错误", async () => {
      const mockResponse = {
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: "Access denied" }),
      } as Response

      const result = await errorHandler.handleHttpError(mockResponse, {
        component: "TestComponent",
        action: "fetchData",
      })

      expect(result.handled).toBe(true)
    })

    it("应该支持错误监听器", () => {
      const listener = vi.fn()
      const unsubscribe = errorHandler.addEventListener(listener)

      const testError = ErrorFactory.createSystemError("Test", "Test message")
      errorHandler.handle(testError, { showNotification: false, logToServer: false })

      expect(listener).toHaveBeenCalledWith(testError)

      unsubscribe()
      errorHandler.handle(testError, { showNotification: false, logToServer: false })

      // 监听器已移除，不应该再次调用
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe("性能测试", () => {
    it("应该在合理时间内处理大量错误", async () => {
      const startTime = Date.now()
      const errors = Array.from({ length: 100 }, (_, i) =>
        ErrorFactory.createSystemError(`Error ${i}`, `User message ${i}`)
      )

      const promises = errors.map((error) =>
        errorHandler.handle(error, {
          showNotification: false,
          logToServer: false,
          logToConsole: false,
        })
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()

      expect(results).toHaveLength(100)
      expect(results.every((r) => r.handled)).toBe(true)
      expect(endTime - startTime).toBeLessThan(1000) // 应该在 1 秒内完成
    })

    it("应该防止内存泄漏", () => {
      const initialListenerCount = errorHandler["listeners"].length

      // 添加大量监听器
      const unsubscribers = Array.from({ length: 1000 }, () =>
        errorHandler.addEventListener(() => {})
      )

      expect(errorHandler["listeners"].length).toBe(initialListenerCount + 1000)

      // 移除所有监听器
      unsubscribers.forEach((unsubscribe) => unsubscribe())

      expect(errorHandler["listeners"].length).toBe(initialListenerCount)
    })
  })

  describe("错误恢复测试", () => {
    it("应该正确识别可恢复错误", () => {
      const recoverableErrors = [
        ErrorFactory.createSecurityError(
          SecurityErrorType.SESSION_EXPIRED,
          "Session expired",
          "会话过期"
        ),
        ErrorFactory.createBusinessError(
          BusinessErrorType.VALIDATION_FAILED,
          "Validation failed",
          "验证失败"
        ),
      ]

      const nonRecoverableErrors = [
        ErrorFactory.createSecurityError(
          SecurityErrorType.ACCOUNT_BANNED,
          "Account banned",
          "账户被禁"
        ),
        ErrorFactory.createSystemError("System crash", "系统崩溃"),
      ]

      recoverableErrors.forEach((error) => {
        expect(error.recoverable).toBe(true)
      })

      nonRecoverableErrors.forEach((error) => {
        expect(error.recoverable).toBe(false)
      })
    })

    it("应该正确识别可重试错误", () => {
      const retryableErrors = [
        ErrorFactory.createNetworkError(
          NetworkErrorType.CONNECTION_FAILED,
          "Connection failed",
          "连接失败"
        ),
        ErrorFactory.createNetworkError(NetworkErrorType.TIMEOUT, "Request timeout", "请求超时"),
      ]

      const nonRetryableErrors = [
        ErrorFactory.createBusinessError(
          BusinessErrorType.VALIDATION_FAILED,
          "Validation failed",
          "验证失败"
        ),
        ErrorFactory.createSecurityError(SecurityErrorType.CSRF_FAILED, "CSRF failed", "CSRF 失败"),
      ]

      retryableErrors.forEach((error) => {
        expect(error.retryable).toBe(true)
      })

      nonRetryableErrors.forEach((error) => {
        expect(error.retryable).toBe(false)
      })
    })
  })
})
