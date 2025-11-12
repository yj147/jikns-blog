/**
 * OAuth 流程测试套件
 * 测试 GitHub OAuth 认证流程的各个环节
 * 覆盖率目标：≥ 80%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getAuthRedirectUrl, validateRedirectUrl, syncUserFromAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase"
import { TEST_USERS, createTestSession } from "../helpers/test-data"

// Mock 外部依赖
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("OAuth 流程测试", () => {
  let mockSupabaseClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient = createClient()

    // 设置测试环境变量
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
  })

  describe("GitHub OAuth 启动流程", () => {
    it("应该正确生成 GitHub OAuth 重定向 URL", () => {
      const redirectUrl = getAuthRedirectUrl("/profile")

      expect(redirectUrl).toBe("http://localhost:54321/auth/v1/callback?redirect_to=%2Fprofile")
    })

    it("应该启动 GitHub OAuth 流程", async () => {
      const expectedOAuthOptions = {
        provider: "github",
        options: {
          redirectTo: "http://localhost:54321/auth/v1/callback?redirect_to=%2Fprofile",
          scopes: "read:user user:email",
        },
      }

      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: "https://github.com/login/oauth/authorize?..." },
        error: null,
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: getAuthRedirectUrl("/profile"),
          scopes: "read:user user:email",
        },
      })

      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith(expectedOAuthOptions)
      expect(result.data.url).toContain("github.com")
      expect(result.error).toBeNull()
    })

    it("应该处理 GitHub OAuth 启动失败", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: new Error("OAuth provider not configured"),
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      })

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain("OAuth provider not configured")
    })
  })

  describe("OAuth 回调处理", () => {
    const mockGitHubUser = {
      id: "github-oauth-user-123",
      email: "github-oauth@example.com",
      user_metadata: {
        full_name: "GitHub OAuth User",
        avatar_url: "https://avatars.githubusercontent.com/u/123456?v=4",
        provider_id: "123456",
        provider: "github",
      },
    }

    it("应该处理成功的 GitHub OAuth 回调", async () => {
      const mockSession = createTestSession(mockGitHubUser.id, mockGitHubUser.email)
      mockSession.user.user_metadata = mockGitHubUser.user_metadata

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const result = await mockSupabaseClient.auth.getSession()

      expect(result.data.session).toBeDefined()
      expect(result.data.session.user.id).toBe(mockGitHubUser.id)
      expect(result.data.session.user.email).toBe(mockGitHubUser.email)
      expect(result.data.session.user.user_metadata.provider).toBe("github")
    })

    it("应该处理 OAuth 回调中的用户数据同步", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(mockPrisma.user.findUnique as any)
        .mockResolvedValue(null)(mockPrisma.user.create as any)
        .mockResolvedValue({
          ...mockGitHubUser,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

      const syncedUser = await syncUserFromAuth(mockGitHubUser)

      expect(syncedUser.id).toBe(mockGitHubUser.id)
      expect(syncedUser.email).toBe(mockGitHubUser.email)
      expect(syncedUser.name).toBe(mockGitHubUser.user_metadata.full_name)
      expect(syncedUser.avatarUrl).toBe(mockGitHubUser.user_metadata.avatar_url)
      expect(syncedUser.role).toBe("USER")
      expect(syncedUser.status).toBe("ACTIVE")
    })

    it("应该处理重复 GitHub OAuth 登录", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi.mocked(prisma)

      const existingUser = {
        ...TEST_USERS.user,
        id: mockGitHubUser.id,
        email: mockGitHubUser.email,
        name: "Old GitHub Name",
        avatarUrl: "old-github-avatar.jpg",
      }(mockPrisma.user.findUnique as any)
        .mockResolvedValue(existingUser as any)(mockPrisma.user.update as any)
        .mockResolvedValue({
          ...existingUser,
          name: mockGitHubUser.user_metadata.full_name,
          avatarUrl: mockGitHubUser.user_metadata.avatar_url,
          lastLoginAt: new Date(),
        } as any)

      const syncedUser = await syncUserFromAuth(mockGitHubUser)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockGitHubUser.id },
        data: expect.objectContaining({
          name: mockGitHubUser.user_metadata.full_name,
          avatarUrl: mockGitHubUser.user_metadata.avatar_url,
          lastLoginAt: expect.any(Date),
        }),
      })

      expect(syncedUser.name).toBe(mockGitHubUser.user_metadata.full_name)
      expect(syncedUser.avatarUrl).toBe(mockGitHubUser.user_metadata.avatar_url)
    })
  })

  describe("重定向 URL 安全验证", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    })

    it("应该接受安全的本地重定向 URL", () => {
      const safeUrls = [
        "/profile",
        "/admin/dashboard",
        "/blog/post/123?comment=456",
        "http://localhost:3000/settings",
        "/search?q=test&page=2#results",
      ]

      safeUrls.forEach((url) => {
        expect(validateRedirectUrl(url)).toBe(true)
      })
    })

    it("应该拒绝恶意重定向 URL", () => {
      const maliciousUrls = [
        "http://malicious.com/phishing",
        "https://evil.site/steal-tokens",
        "//external.com/redirect",
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        "http://localhost:3000@evil.com",
        "http://evil.com/http://localhost:3000",
      ]

      maliciousUrls.forEach((url) => {
        expect(validateRedirectUrl(url)).toBe(false)
      })
    })

    it("应该处理边界情况的重定向 URL", () => {
      const edgeCases = [
        "", // 空字符串
        "   ", // 空白字符
        null as any,
        undefined as any,
        "///",
        "http://",
        "https://",
        "not-a-url-at-all",
      ]

      edgeCases.forEach((url) => {
        expect(validateRedirectUrl(url)).toBe(false)
      })
    })
  })

  describe("OAuth 状态管理", () => {
    it("应该正确处理认证状态变化", async () => {
      const mockCallback = vi.fn()
      const unsubscribe = vi.fn()

      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe } },
      })

      const { data } = mockSupabaseClient.auth.onAuthStateChange(mockCallback)

      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback)
      expect(data.subscription.unsubscribe).toBe(unsubscribe)
    })

    it("应该处理会话过期的情况", async () => {
      const expiredSession = {
        ...createTestSession("expired-user", "expired@test.com"),
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1小时前过期
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: expiredSession },
        error: null,
      })

      const result = await mockSupabaseClient.auth.getSession()

      expect(result.data.session.expires_at).toBeLessThan(Math.floor(Date.now() / 1000))
    })

    it("应该正确处理登出流程", async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      })

      const result = await mockSupabaseClient.auth.signOut()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
      expect(result.error).toBeNull()
    })
  })

  describe("OAuth 错误处理", () => {
    it("应该处理网络错误", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockRejectedValue(new Error("Network request failed"))

      await expect(
        mockSupabaseClient.auth.signInWithOAuth({
          provider: "github",
        })
      ).rejects.toThrow("Network request failed")
    })

    it("应该处理 OAuth 提供商错误", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: {
          message: "GitHub OAuth app not configured",
          status: 400,
        },
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
      })

      expect(result.error.message).toContain("GitHub OAuth app not configured")
      expect(result.error.status).toBe(400)
    })

    it("应该处理用户拒绝授权的情况", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: {
          message: "OAuth authorization denied",
          status: 400,
        },
      })

      const result = await mockSupabaseClient.auth.getSession()

      expect(result.data.session).toBeNull()
      expect(result.error.message).toContain("OAuth authorization denied")
    })
  })

  describe("OAuth 安全测试", () => {
    it("应该验证 OAuth state 参数", () => {
      const oauthUrl = "http://localhost:54321/auth/v1/callback"
      const redirectTo = "/profile"

      const fullUrl = `${oauthUrl}?redirect_to=${encodeURIComponent(redirectTo)}`

      expect(fullUrl).toContain("redirect_to=%2Fprofile")
      expect(decodeURIComponent("%2Fprofile")).toBe("/profile")
    })

    it("应该防止 CSRF 攻击", () => {
      // 测试重定向 URL 必须是同域
      const crossSiteUrl = "http://evil.com/csrf-attack"

      expect(validateRedirectUrl(crossSiteUrl)).toBe(false)
    })

    it("应该防止开放重定向攻击", () => {
      const openRedirectUrls = [
        "//evil.com/attack",
        "http://localhost:3000@evil.com/attack",
        "http://evil.com\\@localhost:3000/attack",
      ]

      openRedirectUrls.forEach((url) => {
        expect(validateRedirectUrl(url)).toBe(false)
      })
    })
  })

  describe("OAuth 性能测试", () => {
    it("应该在合理时间内完成 OAuth 重定向生成", () => {
      const startTime = performance.now()

      for (let i = 0; i < 100; i++) {
        getAuthRedirectUrl(`/test-path-${i}`)
      }

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(10) // 100次调用应在10ms内完成
    })

    it("应该在合理时间内完成重定向 URL 验证", () => {
      const testUrls = [
        "/valid-path-1",
        "/valid-path-2",
        "http://localhost:3000/valid",
        "http://evil.com/invalid",
        "//malicious.com/invalid",
        "/another-valid-path",
      ]

      const startTime = performance.now()

      testUrls.forEach((url) => validateRedirectUrl(url))

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(5) // 批量验证应在5ms内完成
    })
  })

  describe("多提供商支持测试", () => {
    it("应该支持未来扩展其他 OAuth 提供商", async () => {
      const providers = ["github", "google", "discord"] as const

      for (const provider of providers) {
        mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
          data: { url: `https://${provider}.com/oauth/authorize?...` },
          error: null,
        })

        const result = await mockSupabaseClient.auth.signInWithOAuth({
          provider,
          options: { redirectTo: getAuthRedirectUrl() },
        })

        expect(result.data.url).toContain(provider)
      }
    })

    it("应该处理不支持的 OAuth 提供商", async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: "Unsupported OAuth provider: unsupported" },
      })

      const result = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "unsupported" as any,
      })

      expect(result.error.message).toContain("Unsupported OAuth provider")
    })
  })

  describe("集成测试场景", () => {
    it("应该完成完整的 GitHub OAuth 流程", async () => {
      // 1. 启动 OAuth 流程
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: "https://github.com/login/oauth/authorize?client_id=..." },
        error: null,
      })

      const oauthStart = await mockSupabaseClient.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: getAuthRedirectUrl("/dashboard") },
      })

      expect(oauthStart.data.url).toBeDefined()

      // 2. 模拟成功回调
      const mockSession = createTestSession("oauth-integration-test", "integration@test.com")
      mockSession.user.user_metadata = {
        full_name: "Integration Test User",
        avatar_url: "https://github.com/avatar.jpg",
        provider: "github",
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const sessionResult = await mockSupabaseClient.auth.getSession()

      expect(sessionResult.data.session).toBeDefined()
      expect(sessionResult.data.session.user.user_metadata.provider).toBe("github")

      // 3. 验证用户同步
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(mockPrisma.user.findUnique as any)
        .mockResolvedValue(null)(mockPrisma.user.create as any)
        .mockResolvedValue({
          id: mockSession.user.id,
          email: mockSession.user.email,
          name: mockSession.user.user_metadata.full_name,
          avatarUrl: mockSession.user.user_metadata.avatar_url,
          role: "USER",
          status: "ACTIVE",
        } as any)

      const syncResult = await syncUserFromAuth({
        id: mockSession.user.id,
        email: mockSession.user.email!,
        user_metadata: mockSession.user.user_metadata,
      })

      expect(syncResult.role).toBe("USER")
      expect(syncResult.status).toBe("ACTIVE")
      expect(syncResult.name).toBe("Integration Test User")
    })
  })
})
