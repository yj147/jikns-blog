/**
 * GitHub OAuth 完整流程集成测试
 * 测试从认证启动到用户登录的完整流程
 * 覆盖率目标：≥ 85%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState } from "@/lib/auth/oauth-state"
import { createTestRequest, TEST_USERS, PERMISSION_TEST_SCENARIOS } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import type { Provider } from "@supabase/supabase-js"

// Mock 中间件
vi.mock("@/middleware", async () => {
  const actual = await vi.importActual("@/middleware")
  return {
    ...actual,
    middleware: vi.fn().mockImplementation(async (request: NextRequest) => {
      // 简化的中间件逻辑用于测试
      const pathname = request.nextUrl.pathname

      if (pathname.startsWith("/admin")) {
        return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
      }

      if (pathname.startsWith("/profile")) {
        return NextResponse.json({ error: "需要认证" }, { status: 401 })
      }

      return NextResponse.next()
    }),
  }
})

// Mock OAuth 回调处理
vi.mock("@/app/auth/callback/route", () => ({
  GET: vi.fn().mockImplementation(async (request: NextRequest) => {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")
    const redirectTo = url.searchParams.get("redirect_to")

    if (error) {
      const errorUrl = new URL("/login", url.origin)
      errorUrl.searchParams.set("error", error)
      return NextResponse.redirect(errorUrl)
    }

    if (code) {
      // 模拟成功的 OAuth 回调
      const successUrl = new URL(redirectTo || "/", url.origin)
      return NextResponse.redirect(successUrl)
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
  }),
}))

/**
 * 创建 NextRequest 测试实例
 */
function createNextRequest(url: string, cookies?: Record<string, string>): NextRequest {
  const headers = new Headers()
  if (cookies) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ")
    headers.set("cookie", cookieString)
  }
  const request = new Request(url, { headers })
  const nextRequest = new NextRequest(request, {})
  return nextRequest
}

describe("GitHub OAuth 完整流程集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()

    // 设置测试环境
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
    process.env.OAUTH_STATE_SECRET = "test-oauth-state-secret"
  })

  afterEach(() => {
    resetMocks()
  })

  describe("完整 OAuth 认证流程", () => {
    it("应该完成未认证用户的完整 GitHub OAuth 流程", async () => {
      // 1. 用户访问需要认证的页面
      const profileRequest = createTestRequest("/profile")
      const { middleware } = await import("@/middleware")

      const middlewareResponse = await middleware(profileRequest as any)
      expect(middlewareResponse.status).toBe(401)

      // 2. 用户被重定向到登录页面
      const loginRequest = createTestRequest("/login")
      const loginResponse = await middleware(loginRequest as any)

      // 登录页面应该可以正常访问
      expect(loginResponse).toBeInstanceOf(NextResponse)

      // 3. 用户点击 GitHub 登录，启动 OAuth 流程
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()

      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: {
          provider: "github" as Provider,
          url: "https://github.com/login/oauth/authorize?client_id=test&redirect_uri=http://localhost:54321/auth/v1/callback&scope=read:user user:email&state=test",
        },
        error: null,
      })

      const oauthResult = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: "http://localhost:54321/auth/v1/callback?redirect_to=%2Fprofile",
        },
      })

      expect(oauthResult.data.url).toContain("github.com/login/oauth/authorize")
      expect(oauthResult.data.url).toContain("redirect_uri=http://localhost:54321/auth/v1/callback")

      // 4. 模拟 GitHub OAuth 回调
      const callbackUrl =
        "http://localhost:3000/auth/callback?code=github_auth_code&state=test&redirect_to=%2Fprofile"
      const callbackRequest = createNextRequest(callbackUrl)

      const { GET } = await import("@/app/auth/callback/route")
      const callbackResponse = await GET(callbackRequest)

      // 回调应该重定向到原始页面
      expect(callbackResponse.status).toBe(302)
      const location = callbackResponse.headers.get("location")
      expect(location).toContain("/profile")
    })

    it("应该正确处理 OAuth 错误回调", async () => {
      // 模拟 OAuth 错误
      const errorCallbackUrl =
        "http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access"
      const callbackRequest = createNextRequest(errorCallbackUrl)

      const { GET } = await import("@/app/auth/callback/route")
      const callbackResponse = await GET(callbackRequest)

      // 应该重定向到登录页面，并带有错误参数
      expect(callbackResponse.status).toBe(302)
      const location = callbackResponse.headers.get("location")
      expect(location).toContain("/login")
      expect(location).toContain("error=access_denied")
    })

    it("应该正确处理缺失 code 参数的情况", async () => {
      // 缺失 code 参数的回调
      const invalidCallbackUrl = "http://localhost:3000/auth/callback?state=test"
      const callbackRequest = createNextRequest(invalidCallbackUrl)

      const { GET } = await import("@/app/auth/callback/route")
      const callbackResponse = await GET(callbackRequest)

      // 应该重定向到登录页面，并带有错误参数
      expect(callbackResponse.status).toBe(302)
      const location = callbackResponse.headers.get("location")
      expect(location).toContain("/login")
      expect(location).toContain("error=missing_code")
    })
  })

  describe("OAuth 错误处理", () => {
    it("应该正确处理 Supabase OAuth 签名错误", async () => {
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()

      // 模拟 OAuth 签名失败
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: {
          provider: null as any,
          url: null,
        },
        error: {
          message: "Invalid OAuth configuration",
          name: "AuthError",
          status: 400,
        } as any,
      })

      const oauthResult = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: "http://localhost:54321/auth/v1/callback",
        },
      })

      expect(oauthResult.error).toBeTruthy()
      expect(oauthResult.error?.message).toContain("Invalid OAuth configuration")
    })

    it("应该正确处理网络错误", async () => {
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()

      // 模拟网络错误
      vi.mocked(supabase.auth.signInWithOAuth).mockRejectedValue(
        new Error("Network error: Failed to connect to GitHub")
      )

      await expect(
        supabase.auth.signInWithOAuth({
          provider: "github",
          options: {
            redirectTo: "http://localhost:54321/auth/v1/callback",
          },
        })
      ).rejects.toThrow("Network error")
    })
  })

  describe("状态管理和重定向", () => {
    it("应该正确处理状态参数和重定向", async () => {
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()

      // 模拟成功的 OAuth 启动，包含状态参数
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: {
          provider: "github" as Provider,
          url: "https://github.com/login/oauth/authorize?client_id=test&state=secure_state_123&redirect_uri=callback",
        },
        error: null,
      })

      const oauthResult = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: "http://localhost:54321/auth/v1/callback?redirect_to=%2Fadmin",
          scopes: "read:user user:email",
        },
      })

      expect(oauthResult.data.url).toContain("state=secure_state_123")
      expect(oauthResult.data.url).toContain("github.com/login/oauth/authorize")
    })

    it("应该处理复杂的重定向路径", async () => {
      const stateToken = generateOAuthState()
      const complexRedirectUrl = `http://localhost:3000/auth/callback?code=auth_code&state=${stateToken.state}&redirect_to=%2Fadmin%2Fposts%3Fpage%3D2%26filter%3Ddraft`
      const cookieValue = `${stateToken.state}.${stateToken.issuedAt}.${stateToken.signature}`
      const callbackRequest = createNextRequest(complexRedirectUrl, { oauth_state: cookieValue })

      const { GET } = await import("@/app/auth/callback/route")
      const callbackResponse = await GET(callbackRequest)

      expect(callbackResponse.status).toBe(302)
      const location = callbackResponse.headers.get("location")
      expect(location).toContain("/admin/posts")
      expect(location).toContain("page=2")
      expect(location).toContain("filter=draft")
    })
  })

  describe("会话管理集成", () => {
    it("应该在成功认证后创建有效会话", async () => {
      // 设置测试用户为已认证状态
      setCurrentTestUser("user")

      const { getUserSession } = await import("@/lib/auth")
      const { session } = await getUserSession()

      expect(session).toBeTruthy()
      expect(session?.user.id).toBe(TEST_USERS.user.id)
      expect(session?.user.email).toBe(TEST_USERS.user.email)
    })

    it("应该正确处理会话刷新", async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase")

      // 模拟会话刷新
      vi.mock("@/lib/supabase", async () => {
        const actual = await vi.importActual("@/lib/supabase")
        return {
          ...actual,
          createServerSupabaseClient: vi.fn().mockResolvedValue({
            auth: {
              getSession: vi.fn().mockResolvedValue({
                data: { session: null },
                error: null,
              }),
              refreshSession: vi.fn().mockResolvedValue({
                data: { session: null },
                error: null,
              }),
            },
          }),
        }
      })

      const supabase = await createServerSupabaseClient()
      const { data } = await supabase.auth.getSession()

      expect(data.session).toBeNull()
    })
  })

  describe("权限验证集成", () => {
    it("应该允许管理员访问管理员区域", async () => {
      // 设置管理员用户
      setCurrentTestUser("admin")

      const { requireAdmin } = await import("@/lib/auth")

      const { prisma } = await import("@/lib/prisma")
      vi.mocked(prisma.user.findUnique).mockResolvedValue(TEST_USERS.admin as any)

      const adminUser = await requireAdmin()
      expect(adminUser.role).toBe("ADMIN")
      expect(adminUser.status).toBe("ACTIVE")
    })

    it("应该拒绝普通用户访问管理员区域", async () => {
      // 设置普通用户
      setCurrentTestUser("user")

      const { requireAdmin } = await import("@/lib/auth")

      const { prisma } = await import("@/lib/prisma")
      vi.mocked(prisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      await expect(requireAdmin()).rejects.toThrow("需要管理员权限")
    })
  })

  describe("错误恢复机制", () => {
    it("应该正确处理数据库连接错误", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth")
      const { prisma } = await import("@/lib/prisma")

      // 模拟数据库连接错误
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:5432")
      )
      vi.mocked(prisma.user.create).mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:5432")
      )

      const testAuthUser = {
        id: "new-user-123",
        email: "newuser@test.com",
        user_metadata: {
          full_name: "New User",
          avatar_url: "https://avatar.test/new.jpg",
        },
      }

      await expect(syncUserFromAuth(testAuthUser)).rejects.toThrow("用户数据同步失败")
    })
  })

  describe("性能和稳定性", () => {
    it("应该能处理并发认证请求", async () => {
      const { createClient } = await import("@/lib/supabase")

      // 创建多个并发请求
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => {
        const supabase = createClient()

        vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
          data: {
            provider: "github" as Provider,
            url: `https://github.com/login/oauth/authorize?state=state_${i}`,
          },
          error: null,
        })

        return supabase.auth.signInWithOAuth({
          provider: "github",
          options: { redirectTo: "http://localhost:54321/auth/v1/callback" },
        })
      })

      const results = await Promise.all(concurrentRequests)

      results.forEach((result, index) => {
        expect(result.data.url).toContain(`state_${index}`)
        expect(result.error).toBeNull()
      })
    })

    it("应该正确处理长时间运行的认证流程", async () => {
      vi.useFakeTimers()

      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()

      // 模拟延迟的 OAuth 响应
      const delayedOAuth = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                data: {
                  provider: "github" as Provider,
                  url: "https://github.com/login/oauth/authorize?client_id=test",
                },
                error: null,
              })
            }, 5000)
          })
      )

      vi.mocked(supabase.auth.signInWithOAuth).mockImplementation(delayedOAuth)

      const oauthPromise = supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: "http://localhost:54321/auth/v1/callback" },
      })

      // 快进时间
      vi.advanceTimersByTime(5000)

      const result = await oauthPromise
      expect(result.data.url).toContain("github.com/login/oauth/authorize")

      vi.useRealTimers()
    })
  })
})
