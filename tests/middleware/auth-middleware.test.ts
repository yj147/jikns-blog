import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { middleware } from "../../middleware"

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => mockSupabaseClient,
}))

describe("认证中间件测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("公开路由访问", () => {
    it("应该允许访问首页", async () => {
      const request = new NextRequest(new URL("http://localhost:3000/"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })

    it("应该允许访问博客列表页", async () => {
      const request = new NextRequest(new URL("http://localhost:3000/blog"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })

    it("应该允许访问登录页", async () => {
      const request = new NextRequest(new URL("http://localhost:3000/login"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })
  })

  describe("需认证路由访问", () => {
    it("未登录用户访问 /profile 应该重定向到登录页", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/profile"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toContain("/login")
    })

    it("已登录用户访问 /profile 应该通过", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "user-123",
              email: "user@test.com",
              user_metadata: { role: "USER" },
            },
          },
        },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/profile"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })
  })

  describe("管理员路由访问", () => {
    it("未登录用户访问 /admin 应该重定向到登录页", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/admin"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toContain("/login")
    })

    it("普通用户访问 /admin 应该重定向到首页", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "user-123",
              email: "user@test.com",
              user_metadata: { role: "USER" },
            },
          },
        },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/admin"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toContain("/")
    })

    it("管理员用户访问 /admin 应该通过", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "admin-123",
              email: "admin@test.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/admin"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })
  })

  describe("API 路由权限", () => {
    it("未登录访问需认证的 API 应该返回 401", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/api/user"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(401)
    })

    it("已登录用户访问用户 API 应该通过", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "user-123",
              email: "user@test.com",
              user_metadata: { role: "USER" },
            },
          },
        },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/api/user"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })

    it("普通用户访问管理员 API 应该返回 403", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "user-123",
              email: "user@test.com",
              user_metadata: { role: "USER" },
            },
          },
        },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/users"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(403)
    })

    it("管理员用户访问管理员 API 应该通过", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "admin-123",
              email: "admin@test.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        },
        error: null,
      })

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/users"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(200)
    })
  })

  describe("错误处理", () => {
    it("Supabase 认证失败时应该安全处理", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error("认证服务不可用"),
      })

      const request = new NextRequest(new URL("http://localhost:3000/profile"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toContain("/unauthorized")
    })

    it("网络错误时应该安全降级", async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(new Error("网络错误"))

      const request = new NextRequest(new URL("http://localhost:3000/admin"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
    })
  })

  describe("会话管理", () => {
    it("应该正确处理过期的会话", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "JWT expired" },
      })

      const request = new NextRequest(new URL("http://localhost:3000/profile"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toContain("/unauthorized")
    })

    it("应该处理无效的 JWT 令牌", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid JWT" },
      })

      const request = new NextRequest(new URL("http://localhost:3000/admin"))
      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toContain("/unauthorized")
    })
  })
})
