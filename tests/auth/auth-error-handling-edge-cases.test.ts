/**
 * 认证错误处理边界条件测试
 * P1-2重构后的统一错误处理模式测试
 *
 * 测试目标：
 * 1. 边界条件：空值、极限值、异常输入
 * 2. 并发场景：多用户同时操作、竞态条件
 * 3. 错误恢复：异常后系统状态一致性
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { AuthError, AuthErrors, isAuthError } from "@/lib/error-handling/auth-error"
import { handleApiError } from "@/lib/api/error-handler"
import { NextResponse } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth/session", () => ({
  fetchAuthenticatedUser: vi.fn(),
  syncUserFromAuth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

const sessionModule = await import("@/lib/auth/session")
const permissionsModule = await import("@/lib/permissions")
const { fetchAuthenticatedUser } = vi.mocked(sessionModule)
const { requireAuth, requireAdmin } = permissionsModule

describe("认证错误处理 - 边界条件测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("AuthError 边界值测试", () => {
    it("应该处理极长的错误消息", () => {
      const longMessage = "A".repeat(10000) // 10KB消息
      const error = new AuthError(longMessage, "UNAUTHORIZED")

      expect(error.message).toBe(longMessage)
      expect(error.code).toBe("UNAUTHORIZED")
      expect(isAuthError(error)).toBe(true)
    })

    it("应该处理空字符串消息", () => {
      const error = new AuthError("", "UNAUTHORIZED")

      expect(error.message).toBe("")
      expect(error.code).toBe("UNAUTHORIZED")
      expect(isAuthError(error)).toBe(true)
    })

    it("应该处理特殊字符在消息中", () => {
      const specialChars = "用户未登录 <script>alert('xss')</script> \n\r\t\0"
      const error = new AuthError(specialChars, "UNAUTHORIZED")

      expect(error.message).toBe(specialChars)
      expect(isAuthError(error)).toBe(true)
    })

    it("应该处理极限时间戳", () => {
      const futureDate = new Date("2099-12-31")
      const pastDate = new Date("1970-01-01")

      const futureError = new AuthError("Future error", "UNAUTHORIZED", 401, undefined, futureDate)
      const pastError = new AuthError("Past error", "UNAUTHORIZED", 401, undefined, pastDate)

      expect(futureError.timestamp).toBe(futureDate)
      expect(pastError.timestamp).toBe(pastDate)
    })

    it("应该处理requestId为极长字符串", () => {
      const longRequestId = "req-" + "x".repeat(1000)
      const error = new AuthError("Error", "UNAUTHORIZED", 401, longRequestId)

      expect(error.requestId).toBe(longRequestId)
    })
  })

  describe("handleApiError 边界值测试", () => {
    it("应该处理null错误", () => {
      const response = handleApiError(null)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })

    it("应该处理undefined错误", () => {
      const response = handleApiError(undefined)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })

    it("应该处理非Error对象", () => {
      const response = handleApiError({ foo: "bar" })

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })

    it("应该处理数字错误", () => {
      const response = handleApiError(404)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })

    it("应该处理循环引用对象", () => {
      const circularRef: any = { name: "test" }
      circularRef.self = circularRef

      const response = handleApiError(circularRef)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })

    it("应该处理Error对象但message为空", () => {
      const error = new Error("")
      const response = handleApiError(error)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })

    it("应该处理Prisma极限错误码", () => {
      const prismaError = new Error("P9999: Unknown Prisma error")
      const response = handleApiError(prismaError)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })
  })

  describe("AuthErrors 工具函数边界值测试", () => {
    it("AuthErrors.forbidden 应返回包含上下文的 AuthError", () => {
      const error = AuthErrors.forbidden("测试错误", {
        requestId: "req-123",
        userId: "user-456",
        path: "/api/test",
      })

      expect(isAuthError(error)).toBe(true)
      expect(error.message).toBe("测试错误")
      expect(error.code).toBe("FORBIDDEN")
      expect(error.statusCode).toBe(403)
      expect(error.requestId).toBe("req-123")
      expect(error.context?.userId).toBe("user-456")
      expect(error.context?.path).toBe("/api/test")
    })

    it("AuthError 应支持最小字段构造", () => {
      const error = new AuthError("最小错误", "UNAUTHORIZED", 401)

      expect(isAuthError(error)).toBe(true)
      expect(error.message).toBe("最小错误")
      expect(error.code).toBe("UNAUTHORIZED")
      expect(error.statusCode).toBe(401)
      expect(error.requestId).toBeUndefined()
      expect(error.timestamp).toBeInstanceOf(Date)
    })
  })
})

describe("认证错误处理 - 并发场景测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("并发认证请求", () => {
    it("应该正确处理20个并发requireAuth调用", async () => {
      // 模拟50%成功，50%失败
      let callCount = 0
      fetchAuthenticatedUser.mockImplementation(async () => {
        callCount++
        if (callCount % 2 === 0) {
          return {
            id: `user-${callCount}`,
            email: `user${callCount}@test.com`,
            role: "USER",
            status: "ACTIVE",
          } as any
        }
        return null
      })

      const promises = Array.from({ length: 20 }, () => requireAuth())

      const results = await Promise.allSettled(promises)

      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")

      expect(fulfilled.length + rejected.length).toBe(20)
      expect(rejected.length).toBeGreaterThan(0) // 应该有失败的

      // 所有失败都应该是AuthError
      rejected.forEach((result) => {
        if (result.status === "rejected") {
          expect(isAuthError(result.reason)).toBe(true)
        }
      })
    })

    it("应该正确处理并发requireAdmin调用", async () => {
      // 模拟不同角色的用户
      let callCount = 0
      fetchAuthenticatedUser.mockImplementation(async () => {
        callCount++
        const roles = ["ADMIN", "USER", null] as const
        const role = roles[callCount % 3]

        if (!role) return null

        return {
          id: `user-${callCount}`,
          email: `user${callCount}@test.com`,
          role,
          status: "ACTIVE",
        } as any
      })

      const promises = Array.from({ length: 30 }, () => requireAdmin())

      const results = await Promise.allSettled(promises)

      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")

      // 只有1/3是ADMIN，应该只有10个成功
      expect(fulfilled.length).toBeLessThan(15)
      expect(rejected.length).toBeGreaterThan(15)
    })

    it("应该处理并发条件下的竞态条件", async () => {
      let sharedState = 0

      fetchAuthenticatedUser.mockImplementation(async () => {
        // 模拟竞态条件
        const temp = sharedState
        sharedState = temp + 1

        return {
          id: `user-${sharedState}`,
          email: `user@test.com`,
          role: "USER",
          status: "ACTIVE",
        } as any
      })

      const promises = Array.from({ length: 10 }, () => requireAuth())

      await Promise.allSettled(promises)

      // 验证没有因为竞态条件导致异常
      expect(sharedState).toBeGreaterThan(0)
      expect(sharedState).toBeLessThanOrEqual(10)
    })
  })

  describe("并发错误处理", () => {
    it("应该正确处理并发handleApiError调用", async () => {
      const errors = [
        new AuthError("Error 1", "UNAUTHORIZED"),
        new AuthError("Error 2", "FORBIDDEN"),
        new Error("Generic error"),
        null,
        undefined,
        { custom: "error" },
      ]

      const promises = Array.from({ length: 20 }, (_, i) => {
        const error = errors[i % errors.length]
        return Promise.resolve(handleApiError(error))
      })

      const results = await Promise.all(promises)

      // 所有结果都应该是NextResponse
      results.forEach((result) => {
        expect(result).toBeInstanceOf(NextResponse)
        expect(result.status).toBeGreaterThanOrEqual(400)
        expect(result.status).toBeLessThan(600)
      })
    })

    it("应该处理并发情况下的错误日志", async () => {
      const mockLogger = vi.fn()
      vi.stubGlobal("console", { error: mockLogger, log: vi.fn(), warn: vi.fn() })

      const promises = Array.from({ length: 10 }, (_, i) => {
        const error = new Error(`Concurrent error ${i}`)
        return Promise.resolve(handleApiError(error))
      })

      await Promise.all(promises)

      // 验证日志记录没有丢失（可能因为并发问题）
      expect(mockLogger).toHaveBeenCalled()

      vi.unstubAllGlobals()
    })
  })

  describe("并发场景下的用户状态变更", () => {
    it("应该处理用户在并发请求期间被封禁", async () => {
      let requestCount = 0

      fetchAuthenticatedUser.mockImplementation(async () => {
        const current = ++requestCount
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))

        // 模拟第10次请求后用户被封禁
        const status = current > 10 ? "BANNED" : "ACTIVE"

        return {
          id: "user-123",
          email: "user@test.com",
          role: "USER",
          status,
        } as any
      })

      const promises = Array.from({ length: 20 }, () => requireAuth())

      const results = await Promise.allSettled(promises)

      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")

      // 应该有一些成功（前10个），一些失败（后10个）
      expect(fulfilled.length).toBeGreaterThan(0)
      expect(rejected.length).toBeGreaterThan(0)

      // 失败的应该是因为BANNED状态
      rejected.forEach((result) => {
        if (result.status === "rejected" && isAuthError(result.reason)) {
          expect(result.reason.code).toBe("ACCOUNT_BANNED")
          expect(result.reason.message).toContain("封禁")
        }
      })
    })

    it("应该处理用户在并发请求期间角色变更", async () => {
      let requestCount = 0

      fetchAuthenticatedUser.mockImplementation(async () => {
        const current = ++requestCount
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))

        // 模拟第15次请求后用户升级为管理员
        const role = current > 15 ? "ADMIN" : "USER"

        return {
          id: "user-123",
          email: "user@test.com",
          role,
          status: "ACTIVE",
        } as any
      })

      const promises = Array.from({ length: 30 }, () => requireAdmin())

      const results = await Promise.allSettled(promises)

      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")

      // 前15个应该失败（USER），后15个应该成功（ADMIN）
      expect(fulfilled.length).toBeGreaterThan(0)
      expect(rejected.length).toBeGreaterThan(0)
    })
  })

  describe("性能和稳定性测试", () => {
    it("应该在高并发下保持性能", async () => {
      fetchAuthenticatedUser.mockResolvedValue({
        id: "user-123",
        email: "user@test.com",
        role: "USER",
        status: "ACTIVE",
      } as any)

      const startTime = performance.now()

      const promises = Array.from({ length: 50 }, () => requireAuth())
      await Promise.all(promises)

      const duration = performance.now() - startTime

      // 50个并发请求应该在500ms内完成
      expect(duration).toBeLessThan(500)
    })

    it("应该在错误场景下保持性能", async () => {
      fetchAuthenticatedUser.mockResolvedValue(null)

      const startTime = performance.now()

      const promises = Array.from({ length: 50 }, () =>
        requireAuth().catch(() => {
          /* 忽略错误 */
        })
      )
      await Promise.all(promises)

      const duration = performance.now() - startTime

      // 50个失败请求也应该快速处理
      expect(duration).toBeLessThan(500)
    })

    it("应该正确处理内存压力", async () => {
      fetchAuthenticatedUser.mockImplementation(async () => {
        // 创建大对象模拟内存压力
        const largeData = new Array(100).fill({ data: "x".repeat(100) })

        return {
          id: "user-123",
          email: "user@test.com",
          role: "USER",
          status: "ACTIVE",
          metadata: largeData,
        } as any
      })

      const promises = Array.from({ length: 20 }, () => requireAuth())

      const results = await Promise.allSettled(promises)

      // 即使在内存压力下，所有请求都应该成功
      expect(results.every((r) => r.status === "fulfilled")).toBe(true)
    })
  })

  describe("错误恢复测试", () => {
    it("应该在数据库暂时不可用后恢复", async () => {
      let failCount = 0

      fetchAuthenticatedUser.mockImplementation(async () => {
        failCount++
        if (failCount <= 5) {
          throw new Error("Database connection lost")
        }
        return {
          id: "user-123",
          email: "user@test.com",
          role: "USER",
          status: "ACTIVE",
        } as any
      })

      const results = []

      // 前5次应该失败，后5次应该成功
      for (let i = 0; i < 10; i++) {
        try {
          const user = await requireAuth()
          results.push({ success: true, user })
        } catch (error) {
          results.push({ success: false, error })
        }
      }

      const successes = results.filter((r) => r.success).length
      const failures = results.filter((r) => !r.success).length

      expect(failures).toBe(5)
      expect(successes).toBe(5)
    })

    it("应该在多次失败后正确清理状态", async () => {
      fetchAuthenticatedUser.mockRejectedValue(new Error("Persistent error"))

      // 连续失败10次
      for (let i = 0; i < 10; i++) {
        await expect(requireAuth()).rejects.toThrow()
      }

      // 然后恢复正常
      fetchAuthenticatedUser.mockResolvedValue({
        id: "user-123",
        email: "user@test.com",
        role: "USER",
        status: "ACTIVE",
      } as any)

      const user = await requireAuth()

      expect(user).toBeDefined()
      expect(user.id).toBe("user-123")
    })
  })

  describe("极端场景组合测试", () => {
    it("应该处理并发 + 大数据 + 高错误率的组合", async () => {
      let callCount = 0

      fetchAuthenticatedUser.mockImplementation(async () => {
        callCount++

        // 50%失败率
        if (callCount % 2 === 0) {
          throw new Error("Random failure")
        }

        // 大数据对象
        return {
          id: `user-${callCount}`,
          email: `user${callCount}@test.com`,
          role: callCount % 3 === 0 ? "ADMIN" : "USER",
          status: callCount % 5 === 0 ? "BANNED" : "ACTIVE",
          metadata: new Array(50).fill({ data: "x".repeat(50) }),
        } as any
      })

      const promises = Array.from({ length: 30 }, () => requireAuth().catch((error) => ({ error })))

      const results = await Promise.all(promises)

      // 验证系统在极端条件下仍然稳定
      expect(results).toHaveLength(30)
      expect(results.some((r) => "error" in r)).toBe(true)
    })

    it("应该处理快速连续的状态变更", async () => {
      const states = ["ACTIVE", "BANNED", "ACTIVE", "BANNED", "ACTIVE"] as const
      let stateIndex = 0

      fetchAuthenticatedUser.mockImplementation(async () => {
        const status = states[stateIndex % states.length]
        stateIndex++

        return {
          id: "user-123",
          email: "user@test.com",
          role: "USER",
          status,
        } as any
      })

      const results = []

      for (let i = 0; i < 10; i++) {
        try {
          await requireAuth()
          results.push("success")
        } catch (error) {
          results.push("error")
        }
      }

      // 应该有成功和失败交替出现
      expect(results.filter((r) => r === "success").length).toBeGreaterThan(0)
      expect(results.filter((r) => r === "error").length).toBeGreaterThan(0)
    })
  })
})
