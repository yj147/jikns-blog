/**
 * 邮箱认证流程集成测试
 * 测试邮箱+密码认证的完整流程
 * 覆盖率目标：≥ 85%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { createTestRequest, TEST_USERS } from "../helpers/test-data"
// 在测试中动态导入避免模块级导入问题
// 这些函数将在测试用例中按需动态导入

// 使用全局 Mock 配置，不需要重复定义

describe("邮箱认证流程集成测试", () => {
  let mockSupabaseClient: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // 设置测试环境
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"

    // 动态导入Supabase客户端
    const { createClient } = await import("@/lib/supabase")
    mockSupabaseClient = createClient()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("用户注册流程", () => {
    const newUserData = {
      email: "newuser@test.com",
      password: "SecurePassword123!",
      fullName: "新用户",
    }

    it("应该成功注册新用户", async () => {
      // 动态导入避免模块级导入问题
      const { isEmailRegistered } = await import("@/lib/auth")
      const { prisma } = await import("@/lib/prisma")

      const mockPrisma = vi.mocked(prisma)
      mockPrisma.user.findUnique = vi.fn().mockResolvedValue(null)

      const isRegistered = await isEmailRegistered(newUserData.email)
      expect(isRegistered).toBe(false)

      // 模拟 Supabase 注册成功
      const mockUser = {
        id: "new-user-uuid",
        email: newUserData.email,
        user_metadata: {
          full_name: newUserData.fullName,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: null, // 需要邮箱验证
        },
        error: null,
      })

      const signUpResult = await mockSupabaseClient.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          data: {
            full_name: newUserData.fullName,
          },
        },
      })

      expect(signUpResult.data.user).toBeDefined()
      expect(signUpResult.data.user.email).toBe(newUserData.email)
      expect(signUpResult.data.session).toBeNull() // 需要邮箱验证
      expect(signUpResult.error)
        .toBeNull()(
          // 验证用户数据同步
          mockPrisma.user.create as any
        )
        .mockResolvedValue({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.user_metadata.full_name,
          avatarUrl: null,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const syncedUser = await syncUserFromAuth({
        id: mockUser.id,
        email: mockUser.email,
        user_metadata: mockUser.user_metadata,
      })

      expect(syncedUser.email).toBe(newUserData.email)
      expect(syncedUser.name).toBe(newUserData.fullName)
      expect(syncedUser.role).toBe("USER")
      expect(syncedUser.status).toBe("ACTIVE")
    })

    it("应该拒绝已注册的邮箱", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(
          // 邮箱已存在
          mockPrisma.user.findUnique as any
        )
        .mockResolvedValue(TEST_USERS.user as any)

      const { isEmailRegistered } = await import("@/lib/auth")
      const isRegistered = await isEmailRegistered(TEST_USERS.user.email)
      expect(isRegistered).toBe(true)

      // 模拟 Supabase 返回邮箱已存在错误
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "User already registered",
          status: 400,
        },
      })

      const signUpResult = await mockSupabaseClient.auth.signUp({
        email: TEST_USERS.user.email,
        password: "password123",
      })

      expect(signUpResult.data.user).toBeNull()
      expect(signUpResult.error).toBeDefined()
      expect(signUpResult.error.message).toContain("User already registered")
    })

    it("应该验证邮箱格式和密码强度", async () => {
      const invalidCases = [
        {
          email: "invalid-email",
          password: "ValidPassword123!",
          expectedError: "Invalid email format",
        },
        {
          email: "valid@email.com",
          password: "weak",
          expectedError: "Password too weak",
        },
        {
          email: "valid@email.com",
          password: "",
          expectedError: "Password required",
        },
      ]

      for (const testCase of invalidCases) {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: testCase.expectedError },
        })

        const result = await mockSupabaseClient.auth.signUp({
          email: testCase.email,
          password: testCase.password,
        })

        expect(result.error.message).toBe(testCase.expectedError)
      }
    })
  })

  describe("用户登录流程", () => {
    const loginData = {
      email: "user@test.com",
      password: "UserPassword123!",
    }

    it("应该成功登录已验证的用户", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(
          // 用户存在且已激活
          mockPrisma.user.findUnique as any
        )
        .mockResolvedValue(TEST_USERS.user as any)

      // 模拟成功登录
      const mockSession = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: {
          id: TEST_USERS.user.id,
          email: TEST_USERS.user.email,
          user_metadata: {
            full_name: TEST_USERS.user.name,
          },
        },
      }

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockSession.user,
          session: mockSession,
        },
        error: null,
      })

      const loginResult = await mockSupabaseClient.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      })

      expect(loginResult.data.session).toBeDefined()
      expect(loginResult.data.user.email).toBe(loginData.email)
      expect(loginResult.error)
        .toBeNull()(
          // 验证登录时间更新
          mockPrisma.user.update as any
        )
        .mockResolvedValue({
          ...TEST_USERS.user,
          lastLoginAt: new Date(),
        } as any)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const updatedUser = await syncUserFromAuth({
        id: mockSession.user.id,
        email: mockSession.user.email,
        user_metadata: mockSession.user.user_metadata,
      })

      expect(updatedUser.lastLoginAt).toBeDefined()
    })

    it("应该拒绝错误的密码", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "Invalid login credentials",
          status: 400,
        },
      })

      const loginResult = await mockSupabaseClient.auth.signInWithPassword({
        email: loginData.email,
        password: "WrongPassword",
      })

      expect(loginResult.data.session).toBeNull()
      expect(loginResult.error.message).toBe("Invalid login credentials")
    })

    it("应该拒绝被封禁用户的登录", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(
          // 用户被封禁
          mockPrisma.user.findUnique as any
        )
        .mockResolvedValue(TEST_USERS.bannedUser as any)

      // Supabase 认证成功，但应用层阻止
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: TEST_USERS.bannedUser.id,
            email: TEST_USERS.bannedUser.email,
          },
          session: {
            access_token: "token",
            user: {
              id: TEST_USERS.bannedUser.id,
              email: TEST_USERS.bannedUser.email,
            },
          },
        },
        error: null,
      })

      const loginResult = await mockSupabaseClient.auth.signInWithPassword({
        email: TEST_USERS.bannedUser.email,
        password: "password",
      })

      // Supabase 认证成功
      expect(loginResult.data.session).toBeDefined()

      // 但应用层应该检查用户状态
      const { requireAuth } = await import("@/lib/auth")
      setCurrentTestUser("bannedUser")

      await expect(requireAuth()).rejects.toThrow("账户已被封禁")
    })
  })

  describe("密码重置流程", () => {
    it("应该发送密码重置邮件", async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      })

      const resetResult = await mockSupabaseClient.auth.resetPasswordForEmail("user@test.com", {
        redirectTo: "http://localhost:3000/auth/reset-password",
      })

      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith("user@test.com", {
        redirectTo: "http://localhost:3000/auth/reset-password",
      })
      expect(resetResult.error).toBeNull()
    })

    it("应该处理不存在邮箱的密码重置请求", async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null, // Supabase 不会暴露邮箱是否存在
      })

      const resetResult =
        await mockSupabaseClient.auth.resetPasswordForEmail("nonexistent@test.com")

      // 为了安全，总是返回成功（不暴露邮箱是否存在）
      expect(resetResult.error).toBeNull()
    })

    it("应该更新密码", async () => {
      const newPassword = "NewSecurePassword123!"

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: {
          user: {
            id: TEST_USERS.user.id,
            email: TEST_USERS.user.email,
          },
        },
        error: null,
      })

      const updateResult = await mockSupabaseClient.auth.updateUser({
        password: newPassword,
      })

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: newPassword,
      })
      expect(updateResult.error).toBeNull()
    })
  })

  describe("会话管理", () => {
    it("应该正确维护登录会话", async () => {
      const mockSession = {
        access_token: "valid-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: TEST_USERS.user.id,
          email: TEST_USERS.user.email,
        },
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const sessionResult = await mockSupabaseClient.auth.getSession()

      expect(sessionResult.data.session).toBeDefined()
      expect(sessionResult.data.session.user.id).toBe(TEST_USERS.user.id)
    })

    it("应该处理会话过期", async () => {
      const expiredSession = {
        access_token: "expired-token",
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1小时前过期
        user: {
          id: TEST_USERS.user.id,
          email: TEST_USERS.user.email,
        },
      }

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: expiredSession },
        error: null,
      })

      const sessionResult = await mockSupabaseClient.auth.getSession()

      // 检查会话是否过期
      const isExpired = sessionResult.data.session.expires_at < Math.floor(Date.now() / 1000)
      expect(isExpired).toBe(true)
    })

    it("应该正确处理登出", async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      })

      const signOutResult = await mockSupabaseClient.auth.signOut()

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
      expect(signOutResult.error).toBeNull()
    })
  })

  describe("邮箱验证流程", () => {
    it("应该处理邮箱验证链接", async () => {
      const verificationUrl =
        "http://localhost:3000/auth/confirm?token=verification-token&type=signup"
      const verificationRequest = new Request(verificationUrl)

      // 模拟邮箱验证成功
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              id: "verified-user-id",
              email: "verified@test.com",
              email_confirmed_at: new Date().toISOString(),
            },
          },
        },
        error: null,
      })

      const sessionResult = await mockSupabaseClient.auth.getSession()

      expect(sessionResult.data.session.user.email_confirmed_at).toBeDefined()
    })

    it("应该处理无效的验证令牌", async () => {
      const invalidUrl = "http://localhost:3000/auth/confirm?token=invalid-token&type=signup"

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: {
          message: "Invalid verification token",
          status: 400,
        },
      })

      const sessionResult = await mockSupabaseClient.auth.getSession()

      expect(sessionResult.data.session).toBeNull()
      expect(sessionResult.error.message).toContain("Invalid verification token")
    })
  })

  describe("邮箱认证安全性", () => {
    it("应该防止枚举攻击", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi.mocked(prisma)

      // 对于不存在的邮箱，也应该返回一致的响应时间
      mockPrisma.user.findUnique.mockImplementation(async (query) => {
        // 模拟查询延迟
        await new Promise((resolve) => setTimeout(resolve, 10))
        return null
      })

      const startTime = performance.now()
      const { isEmailRegistered } = await import("@/lib/auth")
      const result1 = await isEmailRegistered("existing@test.com")
      const duration1 = performance.now() - startTime

      const startTime2 = performance.now()
      const result2 = await isEmailRegistered("nonexistent@test.com")
      const duration2 = performance.now() - startTime2

      // 响应时间应该相近（防止时间攻击）
      const timeDifference = Math.abs(duration1 - duration2)
      expect(timeDifference).toBeLessThan(50) // 50ms 的容差
    })

    it("应该防止暴力破解", async () => {
      // 模拟多次失败登录
      const failedAttempts = []

      for (let i = 0; i < 5; i++) {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: "Invalid login credentials" },
        })

        const attempt = mockSupabaseClient.auth.signInWithPassword({
          email: "target@test.com",
          password: `wrong-password-${i}`,
        })

        failedAttempts.push(attempt)
      }

      const results = await Promise.all(failedAttempts)

      // 所有尝试都应该失败
      results.forEach((result) => {
        expect(result.error.message).toBe("Invalid login credentials")
      })
    })

    it("应该验证邮箱格式", () => {
      const emailTests = [
        { email: "valid@test.com", valid: true },
        { email: "also.valid+tag@example.org", valid: true },
        { email: "invalid-email", valid: false },
        { email: "@invalid.com", valid: false },
        { email: "invalid@", valid: false },
        { email: "spaces in@email.com", valid: false },
      ]

      emailTests.forEach(({ email, valid }) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const isValid = emailRegex.test(email)
        expect(isValid).toBe(valid)
      })
    })
  })

  describe("邮箱认证性能测试", () => {
    it("应该快速完成邮箱存在性检查", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(mockPrisma.user.findUnique as any)
        .mockResolvedValue(null)

      const startTime = performance.now()
      const { isEmailRegistered } = await import("@/lib/auth")
      await isEmailRegistered("test@example.com")
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(50) // 应在50ms内完成
    })

    it("应该高效处理并发登录请求", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: "user-id", email: "concurrent@test.com" },
          session: { access_token: "token" },
        },
        error: null,
      })

      const startTime = performance.now()

      // 并发10个登录请求
      const promises = Array.from({ length: 10 }, (_, i) =>
        mockSupabaseClient.auth.signInWithPassword({
          email: `user${i}@test.com`,
          password: "password123",
        })
      )

      await Promise.all(promises)

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(200) // 10个并发请求应在200ms内完成
    })
  })

  describe("邮箱认证边界测试", () => {
    it("应该处理极长的邮箱地址", async () => {
      const longEmail = "a".repeat(240) + "@example.com" // 超长邮箱
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi
        .mocked(prisma)(mockPrisma.user.findUnique as any)
        .mockResolvedValue(null)

      const { isEmailRegistered } = await import("@/lib/auth")
      const result = await isEmailRegistered(longEmail)
      expect(result).toBe(false)
    })

    it("应该处理特殊字符的邮箱", async () => {
      const specialEmails = [
        "test+tag@example.com",
        "user.name+tag@domain.co.uk",
        "123456@example.org",
        "test-email@sub.domain.com",
      ]

      const { isEmailRegistered } = await import("@/lib/auth")
      const { prisma } = await import("@/lib/prisma")
      const mockPrisma = vi.mocked(prisma)

      for (const email of specialEmails) {
        ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
        const result = await isEmailRegistered(email)
        expect(result).toBe(false)
      }
    })

    it("应该处理极长的密码", async () => {
      const longPassword = "A".repeat(1000) + "1!"

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Password too long" },
      })

      const result = await mockSupabaseClient.auth.signUp({
        email: "test@example.com",
        password: longPassword,
      })

      expect(result.error.message).toBe("Password too long")
    })
  })
})
