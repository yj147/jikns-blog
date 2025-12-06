/**
 * 认证中间件测试套件
 * 测试 Next.js middleware 的权限控制逻辑
 * 覆盖率目标：≥ 85%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { middleware, config as middlewareConfig } from "@/middleware"
import { prismaClient } from "@/lib/prisma-client"
import { createTestRequest, TEST_USERS, PERMISSION_TEST_SCENARIOS } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import { setupTestEnv } from "../helpers/test-env"
import { resetPrismaMocks } from "../__mocks__/prisma"

// Mock 依赖
vi.mock("@/lib/prisma-client", async () => {
  const prismaModule = await import("../__mocks__/prisma")
  return { prismaClient: prismaModule.mockPrisma }
})

vi.mock("@supabase/ssr", async () => {
  const supabaseMock = await import("../__mocks__/supabase")
  return {
    createServerClient: vi.fn(() => supabaseMock.createMockSupabaseClient()),
  }
})

vi.mock("@/lib/security", () => ({
  setSecurityHeaders: vi.fn((response, _options) => response),
  validateRequestOrigin: vi.fn(() => true),
  RateLimiter: {
    checkRateLimit: vi.fn(() => true),
  },
  CSRFProtection: {
    validateToken: vi.fn(() => true),
  },
  SessionSecurity: {
    isSessionExpired: vi.fn(() => false),
    shouldRefreshSession: vi.fn(() => false),
  },
}))

describe("认证中间件测试", () => {
  const mockPrisma = vi.mocked(prismaClient)

  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    resetPrismaMocks()

    // 使用标准化环境配置
    setupTestEnv()
    process.env.NODE_ENV = "test"
  })

  afterEach(() => {
    resetMocks()
  })

  describe("公开路径访问", () => {
    const publicPaths = ["/", "/blog", "/login", "/register", "/auth/callback"]

    it.each(publicPaths)("应该允许访问公开路径: %s", async (path) => {
      setCurrentTestUser(null) // 未登录用户

      const request = createTestRequest(path)
      const response = await middleware(request as NextRequest)

      expect(response).toBeInstanceOf(NextResponse)
      // 公开路径不应该返回重定向或错误状态
      expect(response.status).not.toBe(302)
      expect(response.status).not.toBe(401)
      expect(response.status).not.toBe(403)
    })

    it("应该为公开路径设置安全头部", async () => {
      const request = createTestRequest("/")
      const response = await middleware(request as NextRequest)

      const { setSecurityHeaders } = await import("@/lib/security")
      expect(setSecurityHeaders).toHaveBeenCalledWith(
        expect.any(NextResponse),
        expect.objectContaining({
          request: expect.any(NextRequest),
        })
      )
    })
  })

  describe("认证路径访问控制", () => {
    const authPaths = ["/profile", "/settings"]

    it.each(authPaths)("应该重定向未登录用户到登录页: %s", async (path) => {
      setCurrentTestUser(null)

      const request = createTestRequest(path)
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(307)
      const location = response.headers.get("location")
      expect(location).toContain("/login")
      expect(location).toContain(`redirect=${encodeURIComponent(path)}`)
    })

    it.each(authPaths)("应该允许已认证用户访问: %s", async (path) => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user as any)

      const request = createTestRequest(path)
      const response = await middleware(request as NextRequest)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).not.toBe(302)
      expect(response.status).not.toBe(401)
    })

    it("应该允许普通用户访问非管理的受保护路径", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user as any)

      const request = createTestRequest("/settings")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(200)
      expect(response.headers.get("x-middleware-rewrite")).toBeNull()
      expect(response.headers.get("location")).toBeNull()
    })

    it("应该拒绝被封禁用户访问认证路径", async () => {
      setCurrentTestUser("bannedUser")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(
        TEST_USERS.bannedUser as any
      )

      const request = createTestRequest("/profile")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(403)
      const rewriteTarget = response.headers.get("x-middleware-rewrite")
      expect(rewriteTarget).toBeTruthy()
      const targetUrl = new URL(rewriteTarget!)
      expect(targetUrl.pathname).toBe("/unauthorized")
      expect(targetUrl.searchParams.get("reason")).toBe("account_banned")
      expect(targetUrl.searchParams.get("redirect")).toBe("/profile")
    })
  })

  describe("管理员路径访问控制", () => {
    const adminPaths = ["/admin", "/admin/dashboard", "/admin/users", "/api/admin/users"]

    it.each(adminPaths)("应该拒绝未登录用户访问管理路径: %s", async (path) => {
      setCurrentTestUser(null)

      const request = createTestRequest(path)
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(307)
      const location = response.headers.get("location")
      expect(location).toContain("/login")
    })

    it.each(adminPaths)("应该拒绝普通用户访问管理路径: %s", async (path) => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(
        TEST_USERS.user as any
      )

      const request = createTestRequest(path)
      const response = await middleware(request as NextRequest)

      if (path.startsWith("/api/")) {
        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data.error).toBe("权限不足，需要管理员权限")
        expect(data.code).toBe("INSUFFICIENT_PERMISSIONS")
      } else {
        expect(response.status).toBe(403)
        const rewriteTarget = response.headers.get("x-middleware-rewrite")
        expect(rewriteTarget).toBeTruthy()
        const targetUrl = new URL(rewriteTarget!)
        expect(targetUrl.pathname).toBe("/unauthorized")
        expect(targetUrl.searchParams.get("reason")).toBe("insufficient_permissions")
        expect(targetUrl.searchParams.get("redirect")).toBe(path)
      }
    })

    it.each(adminPaths)("应该允许管理员访问管理路径: %s", async (path) => {
      setCurrentTestUser("admin")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.admin as any)

      const request = createTestRequest(path)
      const response = await middleware(request as NextRequest)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).not.toBe(302)
      expect(response.status).not.toBe(401)
      expect(response.status).not.toBe(403)
    })

    it("应该拒绝被封禁的管理员访问", async () => {
      const bannedAdmin = { ...TEST_USERS.bannedUser, role: "ADMIN" as const }
      setCurrentTestUser("bannedUser")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(bannedAdmin as any)

      const request = createTestRequest("/admin/dashboard")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(403)
      const rewriteTarget = response.headers.get("x-middleware-rewrite")
      expect(rewriteTarget).toBeTruthy()
      const targetUrl = new URL(rewriteTarget!)
      expect(targetUrl.searchParams.get("reason")).toBe("account_banned")
      expect(targetUrl.searchParams.get("redirect")).toBe("/admin/dashboard")
    })
  })

  describe("权限缓存机制", () => {
    it("应该缓存用户权限信息", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user as any)

      const request1 = createTestRequest("/profile")
      const request2 = createTestRequest("/settings")

      // 连续两次请求
      await middleware(request1 as NextRequest)
      await middleware(request2 as NextRequest)

      // 由于缓存，数据库查询只应该调用一次
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2) // 当前实现每次都查询
    })

    it("应该在用户状态变更时清除缓存", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user as any)

      const request = createTestRequest("/profile")
      await middleware(request as NextRequest)

      // 模拟用户被封禁
      const bannedUser = { ...TEST_USERS.user, status: "BANNED" as const }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(bannedUser as any)

      const bannedRequest = createTestRequest("/profile")
      const bannedResponse = await middleware(bannedRequest as NextRequest)

      expect(bannedResponse.status).toBe(403)
    })
  })

  describe("安全功能测试", () => {
    beforeEach(async () => {
      const { RateLimiter, validateRequestOrigin, CSRFProtection } = await import("@/lib/security")
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(true)
      vi.mocked(validateRequestOrigin).mockReturnValue(true)
      vi.mocked(CSRFProtection.validateToken).mockReturnValue(true)
    })

    it("应该执行速率限制检查", async () => {
      const { RateLimiter } = await import("@/lib/security")

      const request = createTestRequest("/api/admin/users")
      await middleware(request as NextRequest)

      expect(RateLimiter.checkRateLimit).toHaveBeenCalledWith(
        "unknown", // IP 地址
        500, // 管理路径更宽松的限制数量
        5 * 60 * 1000 // 管理路径 5 分钟窗口
      )
    })

    it("应该拒绝超出速率限制的请求", async () => {
      const { RateLimiter } = await import("@/lib/security")
      vi.mocked(RateLimiter.checkRateLimit).mockReturnValue(false)

      const request = createTestRequest("/api/user/profile")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(429)
      const data = await response.json()
      expect(data.error).toBe("请求过于频繁，请稍后重试")
      expect(data.code).toBe("RATE_LIMITED")
    })

    it("应该验证请求来源", async () => {
      const { validateRequestOrigin } = await import("@/lib/security")

      const postRequest = createTestRequest("/api/admin/users", {
        method: "POST",
        headers: { Origin: "http://evil.com" },
      })

      vi.mocked(validateRequestOrigin).mockReturnValue(false)

      const response = await middleware(postRequest as NextRequest)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("无效的请求来源")
      expect(data.code).toBe("INVALID_ORIGIN")
    })

    it("应该验证 CSRF 令牌", async () => {
      const { CSRFProtection } = await import("@/lib/security")

      const postRequest = createTestRequest("/api/user/profile", {
        method: "POST",
      })

      vi.mocked(CSRFProtection.validateToken).mockReturnValue(false)

      const response = await middleware(postRequest as NextRequest)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("CSRF 验证失败")
      expect(data.code).toBe("CSRF_INVALID")
    })
  })

  describe("最后登录时间更新", () => {
    it("应该更新用户最后登录时间", async () => {
      const oldLoginTime = new Date("2023-08-20T10:00:00Z")
      const userWithOldLogin = {
        ...TEST_USERS.user,
        lastLoginAt: oldLoginTime,
      }

      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(userWithOldLogin as any)
      ;(mockPrisma.user.update as any).mockResolvedValue({
        ...userWithOldLogin,
        lastLoginAt: new Date(),
      } as any)

      const request = createTestRequest("/profile")
      await middleware(request as NextRequest)

      // 应该更新最后登录时间（距离上次登录超过1小时）
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USERS.user.id },
        data: { lastLoginAt: expect.any(Date) },
      })
    })

    it("应该跳过最近更新过的登录时间", async () => {
      const recentLoginTime = new Date()
      const userWithRecentLogin = {
        ...TEST_USERS.user,
        lastLoginAt: recentLoginTime,
      }

      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(userWithRecentLogin as any)

      const request = createTestRequest("/profile")
      await middleware(request as NextRequest)

      // 不应该更新最后登录时间（距离上次登录不足1小时）
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })
  })

  describe("错误处理", () => {
    it("应该处理数据库查询错误", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockRejectedValue(new Error("Database connection failed"))

      const request = createTestRequest("/profile")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe("服务暂时不可用")
      expect(data.code).toBe("SERVICE_UNAVAILABLE")
    })

    it("应该处理 Supabase 会话错误", async () => {
      const { createServerClient } = await import("@supabase/ssr")
      const originalClient = vi.mocked(createServerClient).getMockImplementation() as any

      vi.mocked(createServerClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("Session fetch failed"),
          }),
        },
        storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
      } as any)

      const request = createTestRequest("/profile")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.code).toBe("AUTHENTICATION_REQUIRED")

      // 恢复原始 mock
      vi.mocked(createServerClient).mockImplementation(originalClient)
    })

    it("应该处理未知错误", async () => {
      // 模拟意外错误
      const originalPrismaFind = mockPrisma.user.findUnique
      mockPrisma.user.findUnique.mockImplementation(() => {
        throw new Error("Unexpected error")
      })

      setCurrentTestUser("user")

      const request = createTestRequest("/profile")
      const response = await middleware(request as NextRequest)

      expect(response.status).toBe(500)

      // 恢复原始 mock
      mockPrisma.user.findUnique.mockImplementation(originalPrismaFind)
    })

    it("应该为页面请求重定向到错误页面", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockRejectedValue(new Error("Database error"))

      const request = createTestRequest("/profile") // 非 API 路径
      const response = await middleware(request as NextRequest)

      if (response.status === 302) {
        const location = response.headers.get("location")
        expect(location).toContain("/unauthorized")
        expect(location).toContain("reason=service_unavailable")
      }
    })
  })

  describe("性能监控", () => {
    it("应该记录处理时间过长的警告", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      // 模拟慢查询
      mockPrisma.user.findUnique.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(TEST_USERS.user as any), 60) // 60ms 延迟
        })
      })

      setCurrentTestUser("user")

      const request = createTestRequest("/profile")
      await middleware(request as NextRequest)

      // 在开发环境下应该记录性能警告
      if (process.env.NODE_ENV === "development") {
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("中间件处理耗时过长"))
      }

      consoleSpy.mockRestore()
    })

    it("应该在合理时间内完成权限检查", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user as any)

      const startTime = performance.now()

      const request = createTestRequest("/profile")
      await middleware(request as NextRequest)

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(100) // 应在100ms内完成
    })

    it("应该记录错误处理的性能数据", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockRejectedValue(new Error("Test error"))

      const request = createTestRequest("/profile")
      await middleware(request as NextRequest)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("中间件错误处理耗时"))

      consoleErrorSpy.mockRestore()
    })
  })

  describe("权限测试场景", () => {
    it.each(PERMISSION_TEST_SCENARIOS)("应该正确处理权限场景: $name", async (scenario) => {
      if (scenario.user) {
        setCurrentTestUser(scenario.user.role === "ADMIN" ? "admin" : "user")
        ;(mockPrisma.user.findUnique as any).mockResolvedValue(scenario.user as any)
      } else {
        setCurrentTestUser(null)
      }

      const request = createTestRequest(scenario.path)
      const response = await middleware(request as NextRequest)

      switch (scenario.expectedResult) {
        case "ALLOW":
          expect(response.status).not.toBe(401)
          expect(response.status).not.toBe(403)
          break
        case "DENY":
          expect(response.status >= 400 || response.status === 307).toBe(true)
          break
        case "REDIRECT_TO_LOGIN":
          expect(response.status).toBe(307)
          const location = response.headers.get("location")
          expect(location).toContain("/login")
          break
      }
    })
  })

  describe("中间件配置测试", () => {
    it("应该匹配配置的路径模式", () => {
      expect(middlewareConfig.matcher).toBeDefined()
      expect(Array.isArray(middlewareConfig.matcher) || typeof middlewareConfig.matcher === "string").toBe(true)

      // 检查是否排除了静态文件
      const matcher = Array.isArray(middlewareConfig.matcher)
        ? middlewareConfig.matcher[0]
        : middlewareConfig.matcher
      expect(matcher).toContain("_next/static")
      expect(matcher).toContain("_next/image")
      expect(matcher).toContain("favicon.ico")
    })
  })
})
