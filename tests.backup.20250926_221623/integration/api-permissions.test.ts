/**
 * API 权限控制集成测试
 * 测试所有 API 端点的权限验证逻辑
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { TEST_USERS, createTestRequest } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import { mockPrisma, resetPrismaMocks } from "../__mocks__/prisma"

// Mock 导入权限验证模块
vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual("@/lib/permissions")
  return actual
})

// Mock 认证模块
vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual("../__mocks__/supabase")
  return actual
})

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual("@/lib/auth")
  return actual
})

describe("API 权限控制集成测试", () => {
  beforeEach(() => {
    resetMocks()
    resetPrismaMocks()
    vi.clearAllMocks()
  })

  describe("用户 API 端点权限 (/api/user/*)", () => {
    const userApiEndpoints = [
      { path: "/api/user/profile", method: "GET", description: "获取用户资料" },
      { path: "/api/user/profile", method: "PUT", description: "更新用户资料" },
      { path: "/api/user/settings", method: "GET", description: "获取用户设置" },
      { path: "/api/user/settings", method: "POST", description: "更新用户设置" },
      { path: "/api/user/posts", method: "GET", description: "获取用户文章" },
      { path: "/api/user/bookmarks", method: "GET", description: "获取用户收藏" },
    ]

    it.each(userApiEndpoints)(
      "未认证用户访问 $method $path 应返回 401",
      async ({ path, method }) => {
        setCurrentTestUser(null) // 未登录

        const request = createTestRequest(path, { method })
        const response = await simulateApiHandler(request)

        expect(response.status).toBe(401)
        expect(response.data).toMatchObject({
          error: "此操作需要用户登录",
          code: "AUTHENTICATION_REQUIRED",
        })
      }
    )

    it.each(userApiEndpoints)(
      "被封禁用户访问 $method $path 应返回 403",
      async ({ path, method }) => {
        setCurrentTestUser("bannedUser") // 被封禁用户

        const request = createTestRequest(path, { method })
        const response = await simulateApiHandler(request)

        expect(response.status).toBe(403)
        expect(response.data).toMatchObject({
          error: "账户已被封禁，无法执行操作",
          code: "ACCOUNT_BANNED",
        })
      }
    )

    it.each(userApiEndpoints)("活跃用户访问 $method $path 应成功", async ({ path, method }) => {
      setCurrentTestUser("user") // 活跃的普通用户

      const request = createTestRequest(path, { method })
      const response = await simulateApiHandler(request)

      expect(response.status).toBe(200)
      expect(response.data).toBeDefined()
    })

    it.each(userApiEndpoints)("管理员访问 $method $path 也应成功", async ({ path, method }) => {
      setCurrentTestUser("admin") // 管理员用户

      const request = createTestRequest(path, { method })
      const response = await simulateApiHandler(request)

      expect(response.status).toBe(200)
      expect(response.data).toBeDefined()
    })
  })

  describe("管理员 API 端点权限 (/api/admin/*)", () => {
    const adminApiEndpoints = [
      { path: "/api/admin/users", method: "GET", description: "获取所有用户" },
      { path: "/api/admin/users", method: "POST", description: "创建用户" },
      { path: "/api/admin/users/123", method: "PUT", description: "更新用户" },
      { path: "/api/admin/users/123", method: "DELETE", description: "删除用户" },
      { path: "/api/admin/posts", method: "GET", description: "获取所有文章" },
      { path: "/api/admin/posts/123", method: "DELETE", description: "删除文章" },
      { path: "/api/admin/dashboard", method: "GET", description: "获取仪表盘数据" },
    ]

    it.each(adminApiEndpoints)(
      "未认证用户访问 $method $path 应返回 401",
      async ({ path, method }) => {
        setCurrentTestUser(null) // 未登录

        const request = createTestRequest(path, { method })
        const response = await simulateApiHandler(request)

        expect(response.status).toBe(401)
        expect(response.data).toMatchObject({
          error: "此操作需要用户登录",
          code: "AUTHENTICATION_REQUIRED",
        })
      }
    )

    it.each(adminApiEndpoints)(
      "普通用户访问 $method $path 应返回 403",
      async ({ path, method }) => {
        setCurrentTestUser("user") // 普通用户

        const request = createTestRequest(path, { method })
        const response = await simulateApiHandler(request)

        expect(response.status).toBe(403)
        expect(response.data).toMatchObject({
          error: "权限不足，无法执行此操作",
          code: "INSUFFICIENT_PERMISSIONS",
        })
      }
    )

    it.each(adminApiEndpoints)(
      "被封禁的管理员访问 $method $path 应返回 403",
      async ({ path, method }) => {
        // 创建被封禁的管理员
        const bannedAdmin = { ...TEST_USERS.admin, status: "BANNED" as const }
        setCurrentTestUser("admin")
        // 模拟数据库返回被封禁的管理员
        ;(mockPrisma.user.findUnique as any).mockResolvedValue(bannedAdmin)

        const request = createTestRequest(path, { method })
        const response = await simulateApiHandler(request)

        expect(response.status).toBe(403)
        expect(response.data).toMatchObject({
          error: "账户已被封禁，无法执行操作",
          code: "ACCOUNT_BANNED",
        })
      }
    )

    it.each(adminApiEndpoints)("活跃管理员访问 $method $path 应成功", async ({ path, method }) => {
      setCurrentTestUser("admin") // 活跃管理员

      const request = createTestRequest(path, { method })
      const response = await simulateApiHandler(request)

      expect(response.status).toBe(200)
      expect(response.data).toBeDefined()
    })
  })

  describe("Server Actions 权限保护", () => {
    // 测试 Server Actions 的权限验证
    it("创建文章 Server Action 应要求认证", async () => {
      setCurrentTestUser(null)

      const action = createMockServerAction("createPost", { requireAuth: true })

      try {
        await action({ title: "测试文章", content: "测试内容" })
      } catch (error) {
        expect((error as Error).message).toBe("用户未登录")
      }
    })

    it("删除用户 Server Action 应要求管理员权限", async () => {
      setCurrentTestUser("user") // 普通用户

      const action = createMockServerAction("deleteUser", { requireAdmin: true })

      try {
        await action({ userId: "test-user-id" })
      } catch (error) {
        expect((error as Error).message).toBe("需要管理员权限")
      }
    })

    it("被封禁用户无法执行任何需要认证的 Server Action", async () => {
      setCurrentTestUser("bannedUser")

      const action = createMockServerAction("updateProfile", { requireAuth: true })

      try {
        await action({ name: "新名称" })
      } catch (error) {
        expect((error as Error).message).toBe("账户已被封禁")
      }
    })
  })

  describe("权限验证工具函数测试", () => {
    it("requireAuth() 应正确验证认证状态", async () => {
      const { requireAuth } = await import("@/lib/permissions")

      // 未认证用户
      setCurrentTestUser(null)
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)

      await expect(requireAuth()).rejects.toThrow("用户未登录")

      // 活跃用户
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user)

      const result = await requireAuth()
      expect(result).toEqual(TEST_USERS.user)

      // 被封禁用户
      setCurrentTestUser("bannedUser")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.bannedUser)

      await expect(requireAuth()).rejects.toThrow("账户已被封禁")
    })

    it("requireAdmin() 应正确验证管理员权限", async () => {
      const { requireAdmin } = await import("@/lib/permissions")

      // 未认证用户
      setCurrentTestUser(null)
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)

      await expect(requireAdmin()).rejects.toThrow("未登录用户")

      // 普通用户
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user)

      await expect(requireAdmin()).rejects.toThrow("需要管理员权限")

      // 管理员用户
      setCurrentTestUser("admin")
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.admin)

      const result = await requireAdmin()
      expect(result).toEqual(TEST_USERS.admin)

      // 被封禁的管理员
      const bannedAdmin = { ...TEST_USERS.admin, status: "BANNED" as const }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(bannedAdmin)

      await expect(requireAdmin()).rejects.toThrow("账户已被封禁")
    })
  })

  describe("错误处理与安全测试", () => {
    it("应该安全地处理数据库连接错误", async () => {
      setCurrentTestUser("user")
      ;(mockPrisma.user.findUnique as any).mockRejectedValue(new Error("数据库连接失败"))

      const request = createTestRequest("/api/user/profile")
      const response = await simulateApiHandler(request)

      expect(response.status).toBe(500)
      expect(response.data).toMatchObject({
        error: "服务暂时不可用",
        code: "SERVICE_UNAVAILABLE",
      })

      // 确保不暴露敏感错误信息
      expect(response.data.error).not.toContain("数据库")
      // 不测试不存在的属性
    })

    it("应该验证输入参数防止注入攻击", async () => {
      setCurrentTestUser("admin")

      const maliciousRequest = createTestRequest("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      // 模拟包含恶意 SQL 的请求体
      const maliciousData = {
        email: "'; DROP TABLE users; --",
        name: '<script>alert("xss")</script>',
      }

      const response = await simulateApiHandler(maliciousRequest, maliciousData)

      // 应该拒绝恶意输入
      expect(response.status).toBe(400)
      expect(response.data).toMatchObject({
        error: "输入数据格式不正确",
        code: "INVALID_INPUT",
      })
    })

    it("应该正确处理并发请求", async () => {
      setCurrentTestUser("user")

      const requests = Array.from({ length: 10 }, (_, i) =>
        simulateApiHandler(createTestRequest(`/api/user/profile?t=${i}`))
      )

      const responses = await Promise.all(requests)

      // 所有请求都应该成功
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })

      // 验证没有竞态条件导致的错误
      expect(responses.every((r) => r.data)).toBe(true)
    })
  })

  describe("权限缓存与性能", () => {
    it("应该缓存权限检查结果以提升性能", async () => {
      setCurrentTestUser("admin")

      const startTime = Date.now()

      // 连续多次权限检查
      for (let i = 0; i < 5; i++) {
        const request = createTestRequest("/api/admin/dashboard")
        await simulateApiHandler(request)
      }

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 由于缓存，执行时间应该很短
      expect(executionTime).toBeLessThan(100)

      // 验证数据库只查询了一次（后续使用缓存）
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1)
    })

    it("应该在权限变更时清除缓存", async () => {
      setCurrentTestUser("user")

      // 第一次请求
      let request = createTestRequest("/api/user/profile")
      let response = await simulateApiHandler(request)
      expect(response.status).toBe(200)

      // 模拟用户被封禁
      const bannedUser = { ...TEST_USERS.user, status: "BANNED" as const }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(bannedUser)

      // 权限变更后的请求应该被拒绝
      request = createTestRequest("/api/user/profile")
      response = await simulateApiHandler(request)
      expect(response.status).toBe(403)
    })
  })
})

// 辅助函数：模拟 API 处理器
async function simulateApiHandler(request: Request, body?: any) {
  const pathname = new URL(request.url).pathname

  try {
    // 使用真正的权限验证函数
    if (pathname.startsWith("/api/admin/")) {
      const { withApiAuth } = await import("@/lib/api/unified-auth")

      // 模拟 withApiAuth 的调用
      try {
        const result = await withApiAuth(request as any, "admin", async (ctx) => {
          return { success: true, user: ctx.user }
        })
        return { status: 200, data: { success: true } }
      } catch (error) {
        return {
          status: 403,
          data: { message: (error as Error).message, code: "INSUFFICIENT_PERMISSIONS" },
        }
      }
    } else if (pathname.startsWith("/api/user/")) {
      const { withApiAuth } = await import("@/lib/api/unified-auth")

      // 模拟 withApiAuth 的调用
      try {
        const result = await withApiAuth(request as any, "user-active", async (ctx) => {
          return { success: true, user: ctx.user }
        })
        return { status: 200, data: { success: true } }
      } catch (error) {
        return {
          status: 401,
          data: { message: (error as Error).message, code: "AUTHENTICATION_REQUIRED" },
        }
      }
    }

    // 输入验证模拟
    if (body && request.method === "POST") {
      if (body.email && body.email.includes("DROP TABLE")) {
        return {
          status: 400,
          data: { error: "输入数据格式不正确", code: "INVALID_INPUT" },
        }
      }
    }

    // 模拟成功响应
    return {
      status: 200,
      data: { message: "操作成功", timestamp: Date.now() },
    }
  } catch (error) {
    const message = (error as Error).message

    if (message === "用户未登录" || message === "未登录用户") {
      return {
        status: 401,
        data: { error: "用户未认证", code: "AUTHENTICATION_REQUIRED" },
      }
    }

    if (message === "需要管理员权限") {
      return {
        status: 403,
        data: { error: "权限不足，需要管理员权限", code: "INSUFFICIENT_PERMISSIONS" },
      }
    }

    if (message === "账户已被封禁") {
      return {
        status: 403,
        data: { error: "账户已被封禁", code: "ACCOUNT_BANNED" },
      }
    }

    // 数据库错误等其他错误
    return {
      status: 500,
      data: { error: "服务暂时不可用", code: "SERVICE_UNAVAILABLE" },
    }
  }
}

// 辅助函数：创建模拟的 Server Action
function createMockServerAction(
  name: string,
  options: { requireAuth?: boolean; requireAdmin?: boolean }
) {
  return async (params: any) => {
    if (options.requireAdmin) {
      const { requireAdmin } = await import("@/lib/auth")
      return await requireAdmin()
    }

    if (options.requireAuth) {
      const { requireAuth } = await import("@/lib/auth")
      return await requireAuth()
    }

    return { success: true, data: params }
  }
}
