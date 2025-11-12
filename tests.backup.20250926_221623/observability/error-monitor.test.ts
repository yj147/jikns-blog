/**
 * 错误监控系统测试
 * RFC Phase 1: 验证监控系统能识别新错误码
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { EnhancedErrorMonitor } from "@/lib/observability/error-monitor"
import { ErrorCode } from "@/lib/api/unified-response"
import { AuthErrorCode } from "@/lib/error-handling/auth-error"

// Mock logger
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("增强型错误监控系统测试", () => {
  let monitor: EnhancedErrorMonitor

  beforeEach(() => {
    // 每个测试前创建新的监控实例
    monitor = new EnhancedErrorMonitor()
    monitor.resetMetrics()
  })

  describe("新错误码识别", () => {
    test("应正确记录 NETWORK_ERROR", () => {
      monitor.recordError("NETWORK_ERROR", {
        requestId: "req-1",
        path: "/api/test",
        message: "网络连接失败",
      })

      const details = monitor.getErrorDetails("NETWORK_ERROR")
      expect(details).toBeDefined()
      expect(details?.count).toBe(1)
      expect(details?.contexts[0]).toMatchObject({
        requestId: "req-1",
        path: "/api/test",
        message: "网络连接失败",
      })
    })

    test("应正确记录 VALIDATION_ERROR", () => {
      monitor.recordError("VALIDATION_ERROR", {
        requestId: "req-2",
        path: "/api/users",
        message: "邮箱格式不正确",
      })

      const details = monitor.getErrorDetails("VALIDATION_ERROR")
      expect(details).toBeDefined()
      expect(details?.count).toBe(1)
    })

    test("应正确记录 UNKNOWN_ERROR", () => {
      monitor.recordError("UNKNOWN_ERROR", {
        requestId: "req-3",
        message: "未知错误",
      })

      const details = monitor.getErrorDetails("UNKNOWN_ERROR")
      expect(details).toBeDefined()
      expect(details?.count).toBe(1)
    })

    test("应正确记录认证相关新错误码", () => {
      const authErrors: AuthErrorCode[] = [
        "SESSION_EXPIRED",
        "INVALID_TOKEN",
        "ACCOUNT_BANNED",
        "INVALID_CREDENTIALS",
      ]

      authErrors.forEach((code, index) => {
        monitor.recordError(code, {
          requestId: `req-auth-${index}`,
          userId: `user-${index}`,
        })
      })

      authErrors.forEach((code) => {
        const details = monitor.getErrorDetails(code)
        expect(details).toBeDefined()
        expect(details?.count).toBe(1)
      })
    })
  })

  describe("报警规则触发", () => {
    test("NETWORK_ERROR 达到阈值应触发报警", () => {
      const spy = vi.spyOn(console, "error")

      // 触发10次错误（阈值）
      for (let i = 0; i < 10; i++) {
        monitor.recordError("NETWORK_ERROR", {
          requestId: `req-${i}`,
        })
      }

      // 验证报警被触发
      const stats = monitor.getErrorStats()
      expect(stats.NETWORK_ERROR.totalCount).toBe(10)
    })

    test("UNKNOWN_ERROR 达到阈值应触发紧急报警", () => {
      // 触发5次错误（阈值）
      for (let i = 0; i < 5; i++) {
        monitor.recordError("UNKNOWN_ERROR", {
          requestId: `req-${i}`,
        })
      }

      const stats = monitor.getErrorStats()
      expect(stats.UNKNOWN_ERROR.totalCount).toBe(5)
      expect(stats.UNKNOWN_ERROR.rule?.severity).toBe("critical")
      expect(stats.UNKNOWN_ERROR.rule?.action).toBe("page")
    })

    test("INVALID_CREDENTIALS 频繁出现应识别为潜在攻击", () => {
      // 短时间内触发10次（可能是暴力破解）
      for (let i = 0; i < 10; i++) {
        monitor.recordError("INVALID_CREDENTIALS", {
          requestId: `req-${i}`,
          ip: "192.168.1.100",
        })
      }

      const details = monitor.getErrorDetails("INVALID_CREDENTIALS")
      expect(details?.count).toBe(10)

      // 验证所有记录都来自同一IP
      const uniqueIps = new Set(details?.contexts.map((c) => c.ip))
      expect(uniqueIps.size).toBe(1)
    })
  })

  describe("错误统计与导出", () => {
    test("应正确统计时间窗口内的错误", () => {
      // 记录一些错误
      monitor.recordError("NETWORK_ERROR")
      monitor.recordError("NETWORK_ERROR")
      monitor.recordError("VALIDATION_ERROR")
      monitor.recordError("UNKNOWN_ERROR")

      // 获取5分钟内的统计
      const stats = monitor.getErrorStats(300000)

      expect(stats.NETWORK_ERROR?.recentCount).toBe(2)
      expect(stats.VALIDATION_ERROR?.recentCount).toBe(1)
      expect(stats.UNKNOWN_ERROR?.recentCount).toBe(1)
    })

    test("应正确导出监控数据", () => {
      // 记录各种错误
      monitor.recordError("NETWORK_ERROR", { path: "/api/test" })
      monitor.recordError("VALIDATION_ERROR", { path: "/api/users" })
      monitor.recordError("SESSION_EXPIRED", { userId: "user-1" })

      const exported = monitor.exportMetrics()

      expect(exported).toHaveProperty("timestamp")
      expect(exported.totalErrors).toBe(3)
      expect(exported.uniqueErrorCodes).toBe(3)
      expect(exported.metrics).toHaveLength(3)
      expect(exported.alertRules).toBeInstanceOf(Array)
    })
  })

  describe("报警规则管理", () => {
    test("应能获取所有报警规则", () => {
      const rules = monitor.getAlertRules()

      // 验证新错误码的规则存在
      const networkRule = rules.find((r) => r.errorCode === "NETWORK_ERROR")
      expect(networkRule).toBeDefined()
      expect(networkRule?.severity).toBe("high")
      expect(networkRule?.threshold).toBe(10)

      const unknownRule = rules.find((r) => r.errorCode === "UNKNOWN_ERROR")
      expect(unknownRule).toBeDefined()
      expect(unknownRule?.severity).toBe("critical")
      expect(unknownRule?.threshold).toBe(5)
    })

    test("应能更新报警规则", () => {
      // 更新 NETWORK_ERROR 的阈值
      monitor.updateAlertRule({
        errorCode: "NETWORK_ERROR",
        threshold: 5, // 降低阈值
        timeWindow: 30000, // 30秒
        severity: "critical",
        action: "page",
      })

      const rules = monitor.getAlertRules()
      const updatedRule = rules.find((r) => r.errorCode === "NETWORK_ERROR")

      expect(updatedRule?.threshold).toBe(5)
      expect(updatedRule?.timeWindow).toBe(30000)
      expect(updatedRule?.severity).toBe("critical")
    })
  })

  describe("旧错误记录清理", () => {
    test("应清理超过指定时间的错误记录", async () => {
      // 记录错误
      monitor.recordError("NETWORK_ERROR")
      monitor.recordError("VALIDATION_ERROR")

      // 等待一小段时间确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 清理10毫秒前的记录（应该清理掉之前记录的错误）
      monitor.cleanupOldMetrics(5)

      const stats = monitor.getErrorStats()
      expect(Object.keys(stats)).toHaveLength(0)
    })

    test("应保留时间窗口内的错误记录", () => {
      // 记录错误
      monitor.recordError("NETWORK_ERROR")

      // 清理1小时前的记录（当前记录应保留）
      monitor.cleanupOldMetrics(3600000)

      const details = monitor.getErrorDetails("NETWORK_ERROR")
      expect(details).toBeDefined()
      expect(details?.count).toBe(1)
    })
  })

  describe("错误上下文管理", () => {
    test("应限制上下文记录数量为100条", () => {
      // 记录150条错误
      for (let i = 0; i < 150; i++) {
        monitor.recordError("NETWORK_ERROR", {
          requestId: `req-${i}`,
        })
      }

      const details = monitor.getErrorDetails("NETWORK_ERROR")
      expect(details?.count).toBe(150) // 总数正确
      expect(details?.contexts.length).toBe(100) // 只保留最近100条

      // 验证保留的是最后100条
      expect(details?.contexts[0].requestId).toBe("req-50")
      expect(details?.contexts[99].requestId).toBe("req-149")
    })
  })
})
