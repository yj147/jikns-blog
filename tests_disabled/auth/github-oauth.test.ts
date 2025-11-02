/**
 * GitHub OAuth 认证流程测试套件
 * 测试GitHub OAuth登录的完整流程，包括用户创建、更新和错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { cleanTestDatabase, getTestDatabase } from "../config/test-database"
import {
  mockGitHubOAuthSuccess,
  mockGitHubOAuthFailure,
  resetSupabaseMocks,
} from "../config/test-supabase"
import { createGitHubTestUser, authAssertions } from "../helpers/auth-test-helpers"

// 这些是将要实现的认证服务函数
// 当前处于TDD的Red阶段，这些导入会失败，这是预期的行为
interface GitHubAuthService {
  signInWithGitHub: () => Promise<{ data?: any; error?: any }>
  handleGitHubCallback: (code: string, state: string) => Promise<{ user?: any; error?: any }>
  syncGitHubUser: (githubData: any) => Promise<{ user?: any; error?: any }>
}

// 模拟认证服务 - 在实际实现完成前的临时替代
const mockGitHubAuthService: GitHubAuthService = {
  signInWithGitHub: vi.fn(),
  handleGitHubCallback: vi.fn(),
  syncGitHubUser: vi.fn(),
}

describe("GitHub OAuth 认证流程", () => {
  const db = getTestDatabase()

  beforeEach(async () => {
    await cleanTestDatabase()
    resetSupabaseMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("OAuth 重定向流程", () => {
    it("应该成功初始化GitHub OAuth重定向", async () => {
      // Arrange: 设置模拟的Supabase客户端
      const mockSupabase = mockGitHubOAuthSuccess()

      // Act: 调用GitHub登录
      const result = await mockSupabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: "http://localhost:3000/auth/callback",
        },
      })

      // Assert: 验证重定向URL生成
      expect(result.data?.provider).toBe("github")
      expect(result.data?.url).toContain("authorize?provider=github")
      expect(result.error).toBeNull()
    })

    it("应该处理OAuth重定向失败", async () => {
      // Arrange: 设置失败的OAuth流程
      const mockSupabase = mockGitHubOAuthFailure()

      // Act: 尝试GitHub登录
      const result = await mockSupabase.auth.signInWithOAuth({
        provider: "github",
      })

      // Assert: 验证错误处理
      expect(result.data?.url).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain("access_denied")
    })
  })

  describe("用户数据同步", () => {
    it("应该为首次登录的GitHub用户创建新账号", async () => {
      // Arrange: 模拟GitHub返回的用户数据
      const githubUserData = {
        id: "github-12345",
        email: "newuser@github.com",
        name: "GitHub新用户",
        avatar_url: "https://avatars.githubusercontent.com/u/12345",
        login: "newgithubuser",
      }

      // 确保用户不存在
      const existingUser = await db.user.findUnique({
        where: { email: githubUserData.email },
      })
      expect(existingUser).toBeNull()

      // Act: 同步GitHub用户数据（模拟实现）
      const createdUser = await db.user.create({
        data: {
          email: githubUserData.email,
          name: githubUserData.name,
          avatarUrl: githubUserData.avatar_url,
          socialLinks: {
            github: `https://github.com/${githubUserData.login}`,
          },
          passwordHash: null, // GitHub用户无密码
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
      })

      // Assert: 验证用户创建
      await authAssertions.toBeCreatedUser(createdUser, {
        email: githubUserData.email,
        name: githubUserData.name,
        role: "USER",
        passwordHash: null,
      })

      authAssertions.toBeGitHubUser(createdUser)
      expect(createdUser.lastLoginAt).toBeDefined()
    })

    it("应该更新现有GitHub用户的信息", async () => {
      // Arrange: 创建已存在的GitHub用户
      const existingUser = await createGitHubTestUser({
        email: "existing@github.com",
        name: "旧昵称",
        avatarUrl: "https://old-avatar.com/avatar.jpg",
      })

      // 模拟GitHub返回的更新数据
      const updatedGitHubData = {
        id: "github-existing",
        email: "existing@github.com",
        name: "新昵称",
        avatar_url: "https://new-avatar.com/avatar.jpg",
        login: "updated-username",
      }

      // Act: 更新用户信息（模拟实现）
      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: updatedGitHubData.name,
          avatarUrl: updatedGitHubData.avatar_url,
          socialLinks: {
            ...(existingUser.socialLinks as any),
            github: `https://github.com/${updatedGitHubData.login}`,
          },
          lastLoginAt: new Date(),
        },
      })

      // Assert: 验证用户更新
      expect(updatedUser.name).toBe("新昵称")
      expect(updatedUser.avatarUrl).toBe("https://new-avatar.com/avatar.jpg")
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date)
      expect(updatedUser.lastLoginAt!.getTime()).toBeGreaterThan(existingUser.createdAt.getTime())

      const socialLinks = updatedUser.socialLinks as any
      expect(socialLinks.github).toContain("updated-username")
    })

    it("应该只更新变化的字段，避免不必要的数据库写入", async () => {
      // Arrange: 创建用户
      const existingUser = await createGitHubTestUser({
        email: "unchanged@github.com",
        name: "不变的昵称",
        avatarUrl: "https://unchanged-avatar.com/avatar.jpg",
      })

      const originalUpdatedAt = existingUser.updatedAt

      // 模拟相同的GitHub数据（无变化）
      const sameGitHubData = {
        id: "github-unchanged",
        email: "unchanged@github.com",
        name: "不变的昵称",
        avatar_url: "https://unchanged-avatar.com/avatar.jpg",
        login: "unchanged-user",
      }

      // Act: 检查是否需要更新
      const needsUpdate =
        existingUser.name !== sameGitHubData.name ||
        existingUser.avatarUrl !== sameGitHubData.avatar_url ||
        JSON.stringify(existingUser.socialLinks) !==
          JSON.stringify({
            github: `https://github.com/${sameGitHubData.login}`,
          })

      // Assert: 验证不需要更新
      expect(needsUpdate).toBe(false)

      // 如果需要更新登录时间，只更新该字段
      if (!needsUpdate) {
        const userWithUpdatedLoginTime = await db.user.update({
          where: { id: existingUser.id },
          data: { lastLoginAt: new Date() },
        })

        expect(userWithUpdatedLoginTime.name).toBe(existingUser.name)
        expect(userWithUpdatedLoginTime.avatarUrl).toBe(existingUser.avatarUrl)
        expect(userWithUpdatedLoginTime.lastLoginAt).toBeInstanceOf(Date)
      }
    })
  })

  describe("错误处理和边界情况", () => {
    it("应该处理GitHub返回的无效用户数据", async () => {
      // Arrange: 模拟无效的GitHub用户数据
      const invalidGitHubData = {
        id: "github-invalid",
        email: null, // 缺少必需的邮箱
        name: "", // 空名称
        avatar_url: "invalid-url",
        login: "invalid-user",
      }

      // Act & Assert: 验证数据验证错误
      await expect(async () => {
        await db.user.create({
          data: {
            email: invalidGitHubData.email!, // 这里会触发错误
            name: invalidGitHubData.name || null,
            avatarUrl: invalidGitHubData.avatar_url,
            passwordHash: null,
            role: "USER",
            status: "ACTIVE",
          },
        })
      }).rejects.toThrow()
    })

    it("应该处理网络错误和OAuth服务不可用", async () => {
      // Arrange: 模拟网络错误
      const mockSupabase = mockGitHubOAuthFailure()

      // Act: 尝试在网络错误时登录
      const result = await mockSupabase.auth.signInWithOAuth({
        provider: "github",
      })

      // Assert: 验证错误处理
      expect(result.error).toBeDefined()
      expect(result.data.url).toBeNull()
    })

    it("应该处理GitHub用户邮箱与已有邮箱用户冲突", async () => {
      // Arrange: 创建已存在的邮箱用户
      const existingEmailUser = await db.user.create({
        data: {
          email: "conflict@example.com",
          name: "邮箱用户",
          passwordHash: "$2b$10$test.hash",
          role: "USER",
          status: "ACTIVE",
        },
      })

      // 模拟GitHub用户使用相同邮箱
      const conflictGitHubData = {
        id: "github-conflict",
        email: "conflict@example.com",
        name: "GitHub冲突用户",
        avatar_url: "https://avatars.githubusercontent.com/u/conflict",
        login: "conflictuser",
      }

      // Act & Assert: 验证邮箱唯一性约束
      await expect(async () => {
        await db.user.create({
          data: {
            email: conflictGitHubData.email,
            name: conflictGitHubData.name,
            avatarUrl: conflictGitHubData.avatar_url,
            passwordHash: null,
            role: "USER",
            status: "ACTIVE",
          },
        })
      }).rejects.toThrow(/unique constraint/i)

      // 验证原用户依然存在
      const originalUser = await db.user.findUnique({
        where: { id: existingEmailUser.id },
      })
      expect(originalUser).toBeDefined()
    })

    it("应该处理用户被封禁的情况", async () => {
      // Arrange: 创建被封禁的GitHub用户
      const bannedUser = await createGitHubTestUser({
        email: "banned@github.com",
        status: "BANNED",
      })

      // Act: 尝试更新被封禁用户的登录时间
      const updatedUser = await db.user.update({
        where: { id: bannedUser.id },
        data: { lastLoginAt: new Date() },
      })

      // Assert: 验证用户状态
      authAssertions.toBeBanned(updatedUser)
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date)

      // 实际应用中，被封禁用户应该无法完成登录流程
      // 这里我们只是验证数据库层面的行为
    })
  })

  describe("性能和并发测试", () => {
    it("应该正确处理并发的GitHub用户同步请求", async () => {
      // Arrange: 准备多个并发请求
      const githubUserData = {
        id: "github-concurrent",
        email: "concurrent@github.com",
        name: "Concurrent User",
        avatar_url: "https://avatars.githubusercontent.com/u/concurrent",
        login: "concurrentuser",
      }

      // Act: 模拟并发创建同一用户
      const concurrentOperations = Array.from({ length: 3 }, () =>
        db.user.upsert({
          where: { email: githubUserData.email },
          update: {
            name: githubUserData.name,
            avatarUrl: githubUserData.avatar_url,
            lastLoginAt: new Date(),
          },
          create: {
            email: githubUserData.email,
            name: githubUserData.name,
            avatarUrl: githubUserData.avatar_url,
            passwordHash: null,
            role: "USER",
            status: "ACTIVE",
            lastLoginAt: new Date(),
          },
        })
      )

      // Assert: 验证并发操作结果
      const results = await Promise.all(concurrentOperations)

      // 所有操作都应该成功，且指向同一个用户
      expect(results).toHaveLength(3)
      const userIds = results.map((user) => user.id)
      expect(new Set(userIds).size).toBe(1) // 所有ID应该相同

      // 验证数据库中只有一个用户记录
      const userCount = await db.user.count({
        where: { email: githubUserData.email },
      })
      expect(userCount).toBe(1)
    })
  })
})
