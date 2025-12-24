/**
 * 用户资料同步集成测试套件
 * 测试增强的 syncUserFromAuth 逻辑，包括智能更新和 UI 显示
 * 覆盖 GitHub OAuth 和邮箱认证的首登与复登场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { syncUserFromAuth } from "@/lib/auth"
import { TEST_USERS } from "../helpers/test-data"
import { prisma } from "@/lib/prisma"

// Mock 依赖
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const mockPrisma = vi.mocked(prisma)

describe("用户资料同步集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 模拟当前时间
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-08-25T10:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("GitHub OAuth 首登场景", () => {
    const githubUserFirstLogin = {
      id: "github-123",
      email: "john@github.com",
      user_metadata: {
        full_name: "John GitHub",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
        user_name: "johngit", // 额外的用户名字段
        provider: "github",
      },
    }

    it("应该创建新用户并提取所有可用的用户信息", async () => {
      // 模拟用户不存在
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const expectedUser = {
        id: githubUserFirstLogin.id,
        email: githubUserFirstLogin.email,
        name: githubUserFirstLogin.user_metadata.full_name,
        avatarUrl: githubUserFirstLogin.user_metadata.avatar_url,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
        createdAt: new Date("2025-08-25T10:00:00.000Z"),
        updatedAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.create.mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(githubUserFirstLogin)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: githubUserFirstLogin.id,
          email: githubUserFirstLogin.email,
          name: "John GitHub", // 使用 full_name
          avatarUrl: "https://avatars.githubusercontent.com/u/123?v=4",
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
        }),
      })

      expect(result).toMatchObject(expectedUser)
    })

    it("应该处理 GitHub 用户名回退逻辑 - name 优先于 user_name", async () => {
      const githubUserWithFallback = {
        id: "github-fallback",
        email: "fallback@github.com",
        user_metadata: {
          name: "Primary Name",
          user_name: "fallback_username",
          avatar_url: "https://avatars.githubusercontent.com/u/456",
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const expectedUser = {
        id: githubUserWithFallback.id,
        email: githubUserWithFallback.email,
        name: "Primary Name", // 应该使用 name 而不是 user_name
        avatarUrl: githubUserWithFallback.user_metadata.avatar_url,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.create.mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(githubUserWithFallback)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Primary Name", // 确认使用正确的名称
        }),
      })
    })

    it("应该处理 picture 字段作为头像 URL 回退", async () => {
      const githubUserWithPicture = {
        id: "github-picture",
        email: "picture@github.com",
        user_metadata: {
          full_name: "Picture User",
          picture: "https://example.com/picture.jpg", // 使用 picture 而不是 avatar_url
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const expectedUser = {
        id: githubUserWithPicture.id,
        email: githubUserWithPicture.email,
        name: "Picture User",
        avatarUrl: "https://example.com/picture.jpg", // 应该使用 picture 字段
        role: "USER",
        status: "ACTIVE",
      }

      mockPrisma.user.create.mockResolvedValue(expectedUser as any)

      await syncUserFromAuth(githubUserWithPicture)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          avatarUrl: "https://example.com/picture.jpg",
        }),
      })
    })
  })

  describe("GitHub OAuth 复登场景", () => {
    const existingGithubUser = {
      id: "github-existing",
      email: "existing@github.com",
      name: "Old Name",
      avatarUrl: "https://old-avatar.com/old.jpg",
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      lastLoginAt: new Date("2025-01-01"),
    }

    it("应该智能更新 - 仅当有变更时才更新名称和头像", async () => {
      const githubUserLogin = {
        id: "github-existing",
        email: "existing@github.com",
        user_metadata: {
          full_name: "New GitHub Name", // 名称有变更
          avatar_url: "https://new-avatar.com/new.jpg", // 头像有变更
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingGithubUser as any)

      const updatedUser = {
        ...existingGithubUser,
        name: "New GitHub Name",
        avatarUrl: "https://new-avatar.com/new.jpg",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser as any)

      const result = await syncUserFromAuth(githubUserLogin)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "github-existing" },
        data: {
          name: "New GitHub Name", // 应该更新
          avatarUrl: "https://new-avatar.com/new.jpg", // 应该更新
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
        },
      })

      expect(result.name).toBe("New GitHub Name")
      expect(result.avatarUrl).toBe("https://new-avatar.com/new.jpg")
    })

    it("应该保留现有数据 - 当 GitHub 数据为空或无变更时", async () => {
      const githubUserNoChange = {
        id: "github-existing",
        email: "existing@github.com",
        user_metadata: {
          full_name: "Old Name", // 与现有数据相同
          avatar_url: "https://old-avatar.com/old.jpg", // 与现有数据相同
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingGithubUser as any)

      const updatedUser = {
        ...existingGithubUser,
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser as any)

      await syncUserFromAuth(githubUserNoChange)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "github-existing" },
        data: {
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
          // 注意：没有 name 和 avatarUrl，因为没有变更
        },
      })
    })

    it("应该只更新头像 - 当名称相同但头像有变更", async () => {
      const githubUserAvatarChange = {
        id: "github-existing",
        email: "existing@github.com",
        user_metadata: {
          full_name: "Old Name", // 相同
          avatar_url: "https://updated-avatar.com/updated.jpg", // 不同
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingGithubUser as any)

      const updatedUser = {
        ...existingGithubUser,
        avatarUrl: "https://updated-avatar.com/updated.jpg",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser as any)

      await syncUserFromAuth(githubUserAvatarChange)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "github-existing" },
        data: {
          avatarUrl: "https://updated-avatar.com/updated.jpg",
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
          // 注意：没有 name，因为没有变更
        },
      })
    })

    it("应该处理空数据库字段的智能填充", async () => {
      const existingUserWithNulls = {
        ...existingGithubUser,
        name: null, // 数据库中没有名称
        avatarUrl: null, // 数据库中没有头像
      }

      const githubUserWithData = {
        id: "github-existing",
        email: "existing@github.com",
        user_metadata: {
          full_name: "GitHub Provided Name",
          avatar_url: "https://github-avatar.com/new.jpg",
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingUserWithNulls as any)

      const updatedUser = {
        ...existingUserWithNulls,
        name: "GitHub Provided Name",
        avatarUrl: "https://github-avatar.com/new.jpg",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser as any)

      await syncUserFromAuth(githubUserWithData)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "github-existing" },
        data: {
          name: "GitHub Provided Name", // 应该填充空字段
          avatarUrl: "https://github-avatar.com/new.jpg", // 应该填充空字段
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
        },
      })
    })
  })

  describe("邮箱认证首登场景", () => {
    const emailUserFirstLogin = {
      id: "email-123",
      email: "user@example.com",
      user_metadata: {
        // 邮箱认证通常没有头像，可能有或没有名称
      },
    }

    it("应该创建邮箱用户 - 无头像和名称", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const expectedUser = {
        id: emailUserFirstLogin.id,
        email: emailUserFirstLogin.email,
        name: null,
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.create.mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(emailUserFirstLogin)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: emailUserFirstLogin.id,
          email: emailUserFirstLogin.email,
          name: null,
          avatarUrl: null,
          role: "USER",
          status: "ACTIVE",
        }),
      })

      expect(result.name).toBeNull()
      expect(result.avatarUrl).toBeNull()
    })

    it("应该创建邮箱用户 - 有名称但无头像", async () => {
      const emailUserWithName = {
        id: "email-with-name",
        email: "named@example.com",
        user_metadata: {
          full_name: "Email User Name",
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const expectedUser = {
        id: emailUserWithName.id,
        email: emailUserWithName.email,
        name: "Email User Name",
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.create.mockResolvedValue(expectedUser as any)

      await syncUserFromAuth(emailUserWithName)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Email User Name",
          avatarUrl: null,
        }),
      })
    })
  })

  describe("邮箱认证复登场景", () => {
    const existingEmailUser = {
      id: "email-existing",
      email: "existing@example.com",
      name: "Existing Email User",
      avatarUrl: null,
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date("2025-01-01"),
      lastLoginAt: new Date("2025-01-01"),
    }

    it("应该仅更新 lastLoginAt - 邮箱认证通常无额外数据", async () => {
      const emailUserLogin = {
        id: "email-existing",
        email: "existing@example.com",
        user_metadata: {}, // 邮箱认证通常没有额外的元数据
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingEmailUser as any)

      const updatedUser = {
        ...existingEmailUser,
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser as any)

      await syncUserFromAuth(emailUserLogin)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "email-existing" },
        data: {
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
          // 没有其他字段更新，因为邮箱认证没有提供新数据
        },
      })
    })
  })

  describe("跨认证方式场景", () => {
    it("应该处理从邮箱认证到 GitHub OAuth 的数据增强", async () => {
      // 用户最初通过邮箱注册，没有头像和完整姓名
      const existingEmailOnlyUser = {
        id: "cross-auth-user",
        email: "cross@example.com",
        name: null,
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date("2025-01-01"),
        lastLoginAt: new Date("2025-01-01"),
      }

      // 后来通过 GitHub OAuth 登录，提供了丰富的数据
      const githubEnhancedLogin = {
        id: "cross-auth-user",
        email: "cross@example.com",
        user_metadata: {
          full_name: "GitHub Enhanced User",
          avatar_url: "https://github-avatar.com/enhanced.jpg",
          provider: "github",
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingEmailOnlyUser as any)

      const enhancedUser = {
        ...existingEmailOnlyUser,
        name: "GitHub Enhanced User",
        avatarUrl: "https://github-avatar.com/enhanced.jpg",
        lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
      }

      mockPrisma.user.update.mockResolvedValue(enhancedUser as any)

      const result = await syncUserFromAuth(githubEnhancedLogin)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "cross-auth-user" },
        data: {
          name: "GitHub Enhanced User", // 填充空的名称字段
          avatarUrl: "https://github-avatar.com/enhanced.jpg", // 填充空的头像字段
          lastLoginAt: new Date("2025-08-25T10:00:00.000Z"),
        },
      })

      expect(result.name).toBe("GitHub Enhanced User")
      expect(result.avatarUrl).toBe("https://github-avatar.com/enhanced.jpg")
    })
  })

  describe("错误处理和边界情况", () => {
    it("应该拒绝没有邮箱的用户", async () => {
      const userWithoutEmail = {
        id: "no-email-user",
        email: null, // 无邮箱
        user_metadata: {
          full_name: "No Email User",
        },
      }

      await expect(syncUserFromAuth(userWithoutEmail as any)).rejects.toThrow("用户邮箱不能为空")

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it("应该处理数据库错误并提供有意义的错误信息", async () => {
      const user = {
        id: "db-error-user",
        email: "error@test.com",
      }

      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database connection failed"))

      await expect(syncUserFromAuth(user)).rejects.toThrow(
        "用户数据同步失败: Database connection failed"
      )
    })
  })

  describe("性能和日志验证", () => {
    it("应该记录详细的同步日志", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      const githubUser = {
        id: "log-test-user",
        email: "logtest@github.com",
        user_metadata: {
          full_name: "Log Test User",
          avatar_url: "https://test-avatar.com/test.jpg",
        },
      }

      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        ...githubUser,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: new Date(),
      } as any)

      await syncUserFromAuth(githubUser)

      expect(consoleSpy).toHaveBeenCalledWith(
        "同步用户资料:",
        expect.objectContaining({
          userId: githubUser.id,
          email: githubUser.email,
          extractedName: "Log Test User",
          extractedAvatarUrl: expect.stringContaining("https://test-avatar.com/test.jpg"),
        })
      )

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/新用户创建成功.*首登/))

      consoleSpy.mockRestore()
    })
  })
})
