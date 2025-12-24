/**
 * 认证日志字段完整性测试
 * 验证所有认证日志调用都包含四个基线字段 {requestId, path, ip, userId}
 * 测试新的 auth-logging.ts 辅助函数功能
 * 覆盖率目标：≥ 95%
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import {
  logAuthEvent,
  extractAuthContext,
  logAuthSuccess,
  logAuthFailure,
  logOAuthEvent,
  logAuditEvent,
  logPermissionCheck,
  logSessionEvent,
  authLog,
} from "@/lib/utils/auth-logging"
import { authLogger } from "@/lib/utils/logger"
import type { LoggerModuleMock } from "../helpers/logger-mock"

let mockAuthLogger: LoggerModuleMock["authLogger"]

describe("认证日志字段完整性测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthLogger = authLogger as LoggerModuleMock["authLogger"]
  })

  describe("extractAuthContext", () => {
    it("应该从 NextRequest 中提取完整的认证上下文", () => {
      const mockRequest = {
        nextUrl: {
          pathname: "/api/admin/posts",
        },
        headers: {
          get: vi.fn((key) => {
            switch (key) {
              case "x-forwarded-for":
                return "192.168.1.100"
              case "x-real-ip":
                return "192.168.1.101"
              default:
                return null
            }
          }),
        },
      } as unknown as NextRequest

      const context = extractAuthContext(mockRequest, "test-request-123", "user-456")

      expect(context).toEqual({
        requestId: "test-request-123",
        path: "/api/admin/posts",
        ip: "192.168.1.100",
        userId: "user-456",
      })
    })

    it("应该处理没有 IP 头部的情况", () => {
      const mockRequest = {
        nextUrl: {
          pathname: "/api/auth/login",
        },
        headers: {
          get: vi.fn(() => null),
        },
      } as unknown as NextRequest

      const context = extractAuthContext(mockRequest, "test-request-456")

      expect(context).toEqual({
        requestId: "test-request-456",
        path: "/api/auth/login",
        ip: "unknown",
        userId: undefined,
      })
    })

    it("应该处理没有请求对象的情况", () => {
      const context = extractAuthContext(undefined, "test-request-789", "user-123")

      expect(context).toEqual({
        requestId: "test-request-789",
        userId: "user-123",
      })
    })

    it("应该使用 x-real-ip 作为备选 IP 源", () => {
      const mockRequest = {
        nextUrl: {
          pathname: "/api/test",
        },
        headers: {
          get: vi.fn((key) => {
            if (key === "x-real-ip") return "10.0.0.1"
            return null
          }),
        },
      } as unknown as NextRequest

      const context = extractAuthContext(mockRequest, "test-request-999")

      expect(context.ip).toBe("10.0.0.1")
    })
  })

  describe("logAuthEvent", () => {
    it("应该包含所有四个基线字段", () => {
      const context = {
        requestId: "req-123",
        path: "/api/test",
        ip: "192.168.1.1",
        userId: "user-123",
      }

      logAuthEvent("info", "测试日志", context, { extra: "data" })

      expect(mockAuthLogger.info).toHaveBeenCalledWith(
        "测试日志",
        expect.objectContaining({
          requestId: "req-123",
          path: "/api/test",
          ip: "192.168.1.1",
          userId: "user-123",
          timestamp: expect.any(String),
          extra: "data",
        })
      )
    })

    it("应该为缺失字段提供默认值", () => {
      const context = {}

      logAuthEvent("warn", "测试警告", context)

      expect(mockAuthLogger.warn).toHaveBeenCalledWith(
        "测试警告",
        expect.objectContaining({
          requestId: "unknown",
          path: "unknown",
          ip: "unknown",
          userId: undefined,
          timestamp: expect.any(String),
        })
      )
    })

    it("应该支持所有日志级别", () => {
      const context = { requestId: "test" }

      logAuthEvent("info", "信息", context)
      logAuthEvent("warn", "警告", context)
      logAuthEvent("error", "错误", context)

      expect(mockAuthLogger.info).toHaveBeenCalled()
      expect(mockAuthLogger.warn).toHaveBeenCalled()
      expect(mockAuthLogger.error).toHaveBeenCalled()
    })

    it("应该正确合并额外字段", () => {
      const context = { requestId: "test", path: "/test" }
      const extraFields = {
        action: "create",
        resource: "post",
        details: { title: "Test Post" },
      }

      logAuthEvent("info", "操作日志", context, extraFields)

      expect(mockAuthLogger.info).toHaveBeenCalledWith(
        "操作日志",
        expect.objectContaining({
          requestId: "test",
          path: "/test",
          action: "create",
          resource: "post",
          details: { title: "Test Post" },
        })
      )
    })

    it("应该生成 ISO 格式的时间戳", () => {
      const context = { requestId: "test" }

      logAuthEvent("info", "时间戳测试", context)

      const logCall = mockAuthLogger.info.mock.calls[0]
      const logData = logCall[1]
      const timestamp = logData.timestamp

      // 验证是有效的 ISO 时间戳
      expect(() => new Date(timestamp)).not.toThrow()
      expect(new Date(timestamp).toISOString()).toBe(timestamp)
    })
  })

  describe("便捷日志函数", () => {
    const testContext = {
      requestId: "req-456",
      path: "/api/auth",
      ip: "10.0.0.1",
      userId: "user-789",
    }

    describe("authLog 简化接口", () => {
      it("authLog.info 应该包含完整字段", () => {
        authLog.info("信息日志", testContext, { extra: "info" })

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "信息日志",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            extra: "info",
          })
        )
      })

      it("authLog.warn 应该包含完整字段", () => {
        authLog.warn("警告日志", testContext)

        expect(mockAuthLogger.warn).toHaveBeenCalledWith(
          "警告日志",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
          })
        )
      })

      it("authLog.error 应该包含完整字段", () => {
        authLog.error("错误日志", testContext, { errorCode: 500 })

        expect(mockAuthLogger.error).toHaveBeenCalledWith(
          "错误日志",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            errorCode: 500,
          })
        )
      })
    })

    describe("logAuthSuccess", () => {
      it("应该记录认证成功事件", () => {
        logAuthSuccess("admin", testContext, { method: "oauth" })

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "认证成功 - admin 策略",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            method: "oauth",
          })
        )
      })
    })

    describe("logAuthFailure", () => {
      it("应该记录认证失败事件（字符串错误）", () => {
        logAuthFailure("user", testContext, "密码错误", { attempts: 3 })

        expect(mockAuthLogger.warn).toHaveBeenCalledWith(
          "认证失败 - user 策略",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            error: "密码错误",
            attempts: 3,
          })
        )
      })

      it("应该记录认证失败事件（Error 对象）", () => {
        const error = new Error("认证令牌无效")
        logAuthFailure("jwt", testContext, error)

        expect(mockAuthLogger.warn).toHaveBeenCalledWith(
          "认证失败 - jwt 策略",
          expect.objectContaining({
            requestId: "req-456",
            error: "认证令牌无效",
          })
        )
      })
    })

    describe("logOAuthEvent", () => {
      it("应该记录 OAuth 回调开始事件", () => {
        logOAuthEvent("callback_start", testContext, { provider: "github" })

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "OAuth事件 - callback_start",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            provider: "github",
          })
        )
      })

      it("应该记录 OAuth 回调成功事件", () => {
        logOAuthEvent("callback_success", testContext)

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "OAuth事件 - callback_success",
          expect.objectContaining(testContext)
        )
      })

      it("应该记录 OAuth 用户资料同步事件", () => {
        logOAuthEvent("profile_sync", testContext, { updated: true })

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "OAuth事件 - profile_sync",
          expect.objectContaining({
            ...testContext,
            updated: true,
          })
        )
      })
    })

    describe("logAuditEvent", () => {
      it("应该记录审计事件", () => {
        logAuditEvent("create", "post", testContext, { postId: "123" })

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "审计日志",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            action: "create",
            resource: "post",
            postId: "123",
          })
        )
      })
    })

    describe("logPermissionCheck", () => {
      it("应该记录权限检查通过事件", () => {
        logPermissionCheck("granted", "admin.posts.create", testContext)

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "权限检查 - granted",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            permission: "admin.posts.create",
            result: "granted",
          })
        )
      })

      it("应该记录权限检查拒绝事件", () => {
        logPermissionCheck("denied", "admin.users.delete", testContext, {
          reason: "insufficient_role",
        })

        expect(mockAuthLogger.warn).toHaveBeenCalledWith(
          "权限检查 - denied",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            permission: "admin.users.delete",
            result: "denied",
            reason: "insufficient_role",
          })
        )
      })
    })

    describe("logSessionEvent", () => {
      it("应该记录会话创建事件", () => {
        logSessionEvent("created", testContext, { provider: "github" })

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "会话事件 - created",
          expect.objectContaining({
            requestId: "req-456",
            path: "/api/auth",
            ip: "10.0.0.1",
            userId: "user-789",
            provider: "github",
          })
        )
      })

      it("应该记录会话过期事件", () => {
        logSessionEvent("expired", testContext)

        expect(mockAuthLogger.info).toHaveBeenCalledWith(
          "会话事件 - expired",
          expect.objectContaining(testContext)
        )
      })
    })
  })

  describe("字段完整性验证", () => {
    it("所有日志函数都应该包含四个基线字段", () => {
      const context = {
        requestId: "complete-test",
        path: "/api/complete",
        ip: "127.0.0.1",
        userId: "complete-user",
      }

      // 测试所有便捷函数
      logAuthSuccess("test", context)
      logAuthFailure("test", context, "error")
      logOAuthEvent("callback_start", context)
      logAuditEvent("test", "resource", context)
      logPermissionCheck("granted", "permission", context)
      logSessionEvent("created", context)

      // 验证所有调用都包含四个基线字段
      const allCalls = [...mockAuthLogger.info.mock.calls, ...mockAuthLogger.warn.mock.calls]

      allCalls.forEach(([, logData]) => {
        expect(logData).toHaveProperty("requestId", "complete-test")
        expect(logData).toHaveProperty("path", "/api/complete")
        expect(logData).toHaveProperty("ip", "127.0.0.1")
        expect(logData).toHaveProperty("userId", "complete-user")
        expect(logData).toHaveProperty("timestamp")
      })
    })

    it("应该在缺失字段时提供合理的默认值", () => {
      const incompleteContext = {
        requestId: "partial-test",
        // 缺少 path, ip, userId
      }

      logAuthEvent("info", "不完整上下文测试", incompleteContext)

      expect(mockAuthLogger.info).toHaveBeenCalledWith(
        "不完整上下文测试",
        expect.objectContaining({
          requestId: "partial-test",
          path: "unknown",
          ip: "unknown",
          userId: undefined,
        })
      )
    })

    it("应该保持时间戳格式的一致性", () => {
      const context = { requestId: "timestamp-test" }

      logAuthEvent("info", "时间戳一致性测试", context)
      logAuthSuccess("test", context)
      logOAuthEvent("callback_start", context)

      const allCalls = mockAuthLogger.info.mock.calls
      const timestamps = allCalls.map(([, logData]) => logData.timestamp)

      timestamps.forEach((timestamp) => {
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        expect(() => new Date(timestamp)).not.toThrow()
      })
    })
  })

  describe("边缘情况处理", () => {
    it("应该处理 null/undefined 上下文", () => {
      expect(() => logAuthEvent("info", "null上下文测试", null as any)).not.toThrow()
      expect(() => logAuthEvent("info", "undefined上下文测试", undefined as any)).not.toThrow()
    })

    it("应该处理空的额外字段", () => {
      const context = { requestId: "empty-extra-test" }

      logAuthEvent("info", "空额外字段测试", context, {})

      expect(mockAuthLogger.info).toHaveBeenCalledWith(
        "空额外字段测试",
        expect.objectContaining({
          requestId: "empty-extra-test",
        })
      )
    })

    it("应该处理复杂的额外字段", () => {
      const context = { requestId: "complex-extra-test" }
      const complexExtra = {
        nested: { object: { with: "values" } },
        array: [1, 2, 3],
        boolean: true,
        null_value: null,
        undefined_value: undefined,
      }

      logAuthEvent("info", "复杂额外字段测试", context, complexExtra)

      expect(mockAuthLogger.info).toHaveBeenCalledWith(
        "复杂额外字段测试",
        expect.objectContaining({
          requestId: "complex-extra-test",
          ...complexExtra,
        })
      )
    })
  })
})
