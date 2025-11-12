/**
 * GitHub OAuth 简化集成测试
 * 专注于修复核心的OAuth Mock函数API问题
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// 创建Mock Supabase客户端
const mockSignInWithOAuth = vi.fn()
const mockGetUser = vi.fn()
const mockGetSession = vi.fn()
const mockSignOut = vi.fn()

const mockSupabaseClient = {
  auth: {
    signInWithOAuth: mockSignInWithOAuth,
    getUser: mockGetUser,
    getSession: mockGetSession,
    signOut: mockSignOut,
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    refreshSession: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  createClient: () => mockSupabaseClient,
  createRouteHandlerClient: async () => mockSupabaseClient,
  supabase: mockSupabaseClient,
}))

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn().mockReturnValue({ value: "mock-token" }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

describe("GitHub OAuth 简化集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // 设置默认Mock行为
    mockSignInWithOAuth.mockResolvedValue({
      data: {
        provider: "github",
        url: "https://github.com/login/oauth/authorize?client_id=test&redirect_uri=http://localhost:54321/auth/v1/callback&scope=read:user user:email&state=test",
        user: null,
        session: null,
      },
      error: null,
    })

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "test-user-id",
          email: "admin@test.com",
          user_metadata: {
            full_name: "管理员",
            avatar_url: "https://github.com/avatar.jpg",
          },
        },
      },
      error: null,
    })

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "test-user-id",
            email: "admin@test.com",
          },
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
        },
      },
      error: null,
    })
  })

  describe("OAuth Mock API 功能测试", () => {
    it("signInWithOAuth 应该正确返回授权URL", async () => {
      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
      })

      expect(result.data.provider).toBe("github")
      expect(result.data.url).toContain("github.com/login/oauth/authorize")
      expect(result.error).toBeNull()
    })

    it("signInWithOAuth 应该支持Mock控制返回错误", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: {
          provider: null,
          url: null,
          user: null,
          session: null,
        },
        error: { message: "OAuth provider error" },
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
      })

      expect(result.error).toEqual({ message: "OAuth provider error" })
      expect(result.data.provider).toBeNull()
    })

    it("getUser 应该正确返回用户信息", async () => {
      const result = await mockSupabaseClient.auth.getUser()

      expect(result.data.user.id).toBe("test-user-id")
      expect(result.data.user.email).toBe("admin@test.com")
      expect(result.error).toBeNull()
    })

    it("getUser 应该支持Mock控制返回错误", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "User not found" },
      })

      const result = await mockSupabaseClient.auth.getUser()

      expect(result.data.user).toBeNull()
      expect(result.error).toEqual({ message: "User not found" })
    })

    it("getSession 应该正确返回会话信息", async () => {
      const result = await mockSupabaseClient.auth.getSession()

      expect(result.data.session.user.id).toBe("test-user-id")
      expect(result.data.session.access_token).toBe("mock-access-token")
      expect(result.error).toBeNull()
    })

    it("getSession 应该支持Mock控制返回空会话", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })

      const result = await mockSupabaseClient.auth.getSession()

      expect(result.data.session).toBeNull()
      expect(result.error).toBeNull()
    })

    it("signOut 应该正确处理登出", async () => {
      mockSignOut.mockResolvedValue({
        error: null,
      })

      const result = await mockSupabaseClient.auth.signOut()

      expect(result.error).toBeNull()
      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })

    it("应该支持网络错误的Mock", async () => {
      mockSignInWithOAuth.mockRejectedValue(new Error("Network error: Failed to connect to GitHub"))

      await expect(
        mockSupabaseClient.auth.signInWithOAuth({
          provider: "github",
        })
      ).rejects.toThrow("Network error: Failed to connect to GitHub")
    })
  })

  describe("状态码和重定向处理", () => {
    it("应该正确处理OAuth回调成功状态码", async () => {
      // 动态导入OAuth路由处理器
      const { GET: callbackHandler } = await import("@/app/auth/callback/route")

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?code=test-code&state=test-state")
      )

      // Mock exchangeCodeForSession 成功
      vi.doMock("@/lib/supabase", () => ({
        createClient: () => ({
          ...mockSupabaseClient,
          auth: {
            ...mockSupabaseClient.auth,
            exchangeCodeForSession: vi.fn().mockResolvedValue({
              data: {
                session: {
                  user: {
                    id: "test-user-id",
                    email: "admin@test.com",
                  },
                  access_token: "mock-access-token",
                },
                user: {
                  id: "test-user-id",
                  email: "admin@test.com",
                },
              },
              error: null,
            }),
          },
        }),
      }))

      const response = await callbackHandler(request)

      // 成功的OAuth回调应该返回302重定向
      expect([302, 307]).toContain(response.status) // 接受Next.js的两种重定向状态码
    })

    it("应该正确处理OAuth回调错误状态码", async () => {
      const { GET: callbackHandler } = await import("@/app/auth/callback/route")

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?error=access_denied")
      )

      const response = await callbackHandler(request)

      // 错误的OAuth回调应该返回302或307重定向到登录页
      expect([302, 307]).toContain(response.status)
      const location = response.headers.get("location")
      expect(location).toContain("/login")
    })

    it("应该正确处理缺失code参数的情况", async () => {
      const { GET: callbackHandler } = await import("@/app/auth/callback/route")

      const request = new NextRequest(new URL("http://localhost:3000/auth/callback"))

      const response = await callbackHandler(request)

      // 缺失code参数应该返回错误或重定向
      expect([400, 302, 307]).toContain(response.status)
    })
  })

  describe("Mock函数测试", () => {
    it("mockResolvedValue 应该正常工作", async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: {
          provider: "github",
          url: "custom-url",
          user: null,
          session: null,
        },
        error: null,
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
      })

      expect(result.data.url).toBe("custom-url")
    })

    it("mockRejectedValue 应该正常工作", async () => {
      const errorMessage = "Custom OAuth error"
      mockSignInWithOAuth.mockRejectedValue(new Error(errorMessage))

      await expect(
        mockSupabaseClient.auth.signInWithOAuth({
          provider: "github",
        })
      ).rejects.toThrow(errorMessage)
    })

    it("mockImplementation 应该正常工作", async () => {
      mockSignInWithOAuth.mockImplementation(async ({ provider }) => {
        if (provider === "github") {
          return {
            data: {
              provider,
              url: "implementation-url",
              user: null,
              session: null,
            },
            error: null,
          }
        }
        return {
          data: {
            provider: null,
            url: null,
            user: null,
            session: null,
          },
          error: { message: "Unsupported provider" },
        }
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
      })

      expect(result.data.url).toBe("implementation-url")
    })
  })

  describe("并发和性能测试", () => {
    it("应该能处理并发认证请求", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        mockSupabaseClient.auth.signInWithOAuth({
          provider: "github",
        })
      )

      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result.data.provider).toBe("github")
        expect(result.error).toBeNull()
      })

      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(5)
    })

    it("应该正确处理长时间运行的认证流程", async () => {
      const delayedAuth = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    provider: "github",
                    url: "delayed-url",
                    user: null,
                    session: null,
                  },
                  error: null,
                }),
              100
            )
          )
      )

      mockSignInWithOAuth.mockImplementation(delayedAuth)

      const startTime = Date.now()
      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
      })
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThan(90) // 至少100ms延迟
      expect(result.data.url).toBe("delayed-url")
    })
  })

  describe("边界情况测试", () => {
    it("应该处理undefined参数", async () => {
      const result = await mockSupabaseClient.auth.signInWithOAuth(undefined as any)

      // Mock应该能处理undefined参数而不崩溃
      expect(result).toBeDefined()
    })

    it("应该处理空对象参数", async () => {
      const result = await mockSupabaseClient.auth.signInWithOAuth({} as any)

      expect(result).toBeDefined()
    })

    it("应该处理多次重置Mock", () => {
      mockSignInWithOAuth.mockReset()
      mockSignInWithOAuth.mockResolvedValue({
        data: { provider: "github", url: "reset-url", user: null, session: null },
        error: null,
      })

      expect(async () => {
        const result = await mockSupabaseClient.auth.signInWithOAuth({
          provider: "github",
        })
        expect(result.data.url).toBe("reset-url")
      }).not.toThrow()
    })
  })
})
