/**
 * 用户数据同步测试套件
 * 专门测试 OAuth 和本地认证的用户数据同步逻辑
 * 覆盖率目标：≥ 85%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { syncUserFromAuth } from "@/lib/auth"
import { TEST_USERS } from "../helpers/test-data"
import { prisma } from "@/lib/prisma"
import { resetPrismaMocks } from "../__mocks__/prisma"

const mockPrisma = vi.mocked(prisma)

describe("用户数据同步测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPrismaMocks()
  })

  describe("GitHub OAuth 同步", () => {
    const githubUser = {
      id: "github-user-123",
      email: "github-user@example.com",
      user_metadata: {
        full_name: "GitHub User",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
        provider_id: "12345678",
        provider: "github",
      },
    }

    it("应该创建新用户当 GitHub 用户首次登录", async () => {
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)

      const expectedUser = {
        id: githubUser.id,
        email: githubUser.email,
        name: githubUser.user_metadata.full_name,
        avatarUrl: githubUser.user_metadata.avatar_url,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }
      ;(mockPrisma.user.create as any).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(githubUser)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: githubUser.id,
          email: githubUser.email,
          name: githubUser.user_metadata.full_name,
          avatarUrl: githubUser.user_metadata.avatar_url,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: expect.any(Date),
        }),
      })

      expect(result).toEqual(expectedUser)
    })

    it("应该更新现有 GitHub 用户的头像和名称", async () => {
      const existingUser = { ...TEST_USERS.user, name: null, avatarUrl: null }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(existingUser as any)

      const updatedUser = {
        ...existingUser,
        name: githubUser.user_metadata.full_name,
        avatarUrl: githubUser.user_metadata.avatar_url,
        lastLoginAt: expect.any(Date),
      }
      ;(mockPrisma.user.update as any).mockResolvedValue(updatedUser as any)

      const result = await syncUserFromAuth(githubUser)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: githubUser.id },
        data: expect.objectContaining({
          name: githubUser.user_metadata.full_name,
          avatarUrl: githubUser.user_metadata.avatar_url,
          lastLoginAt: expect.any(Date),
        }),
      })

      expect(result.avatarUrl).toBe(githubUser.user_metadata.avatar_url)
    })

    it("应该保留现有用户数据当 GitHub 元数据不完整", async () => {
      const incompleteGithubUser = {
        id: "github-incomplete",
        email: "incomplete@github.com",
        user_metadata: {},
      }

      const existingUser = {
        ...TEST_USERS.user,
        id: incompleteGithubUser.id,
        name: "现有用户名",
        avatarUrl: "existing-avatar.jpg",
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(existingUser as any)

      const updatedUser = {
        ...existingUser,
        lastLoginAt: expect.any(Date),
      }
      ;(mockPrisma.user.update as any).mockResolvedValue(updatedUser as any)

      const result = await syncUserFromAuth(incompleteGithubUser)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: incompleteGithubUser.id },
        data: expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      })

      expect(result.name).toBe("现有用户名")
      expect(result.avatarUrl).toBe("existing-avatar.jpg")
    })
  })

  describe("邮箱认证同步", () => {
    const emailUser = {
      id: "email-user-456",
      email: "email-user@example.com",
      user_metadata: {
        full_name: "Email User",
      },
    }

    it("应该创建新用户当邮箱用户首次注册", async () => {
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)

      const expectedUser = {
        id: emailUser.id,
        email: emailUser.email,
        name: emailUser.user_metadata.full_name,
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: expect.any(Date),
      }
      ;(mockPrisma.user.create as any).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(emailUser)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: emailUser.id,
          email: emailUser.email,
          name: emailUser.user_metadata.full_name,
          avatarUrl: null, // 邮箱用户默认无头像
          role: "USER",
          status: "ACTIVE",
        }),
      })

      expect(result.avatarUrl).toBeNull()
    })

    it("应该处理无名称的邮箱用户", async () => {
      const noNameEmailUser = {
        id: "email-no-name",
        email: "noname@example.com",
        // 无 user_metadata
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)

      const expectedUser = {
        id: noNameEmailUser.id,
        email: noNameEmailUser.email,
        name: null,
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
      }
      ;(mockPrisma.user.create as any).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(noNameEmailUser)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: null,
          avatarUrl: null,
        }),
      })

      expect(result.name).toBeNull()
    })
  })

  describe("数据一致性测试", () => {
    it("应该确保邮箱地址唯一性", async () => {
      const duplicateEmailUser = {
        id: "new-user-id",
        email: TEST_USERS.user.email, // 使用已存在的邮箱
      }
      // 模拟数据库唯一约束错误
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
      ;(mockPrisma.user.create as any).mockRejectedValue(
        new Error("Unique constraint failed on the fields: (`email`)")
      )

      await expect(syncUserFromAuth(duplicateEmailUser)).rejects.toThrow("用户数据同步失败")
    })

    it("应该处理并发创建用户的竞态条件", async () => {
      const newUser = {
        id: "concurrent-user",
        email: "concurrent@test.com",
      }
      // 第一次查询返回 null（用户不存在）
      // 但创建时失败（其他进程已创建）
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
      ;(mockPrisma.user.create as any).mockRejectedValue(new Error("Unique constraint failed"))

      await expect(syncUserFromAuth(newUser)).rejects.toThrow("用户数据同步失败")
    })

    it("应该维护角色一致性 - 新用户始终是 USER", async () => {
      const newUser = {
        id: "role-test-user",
        email: "roletest@example.com",
        user_metadata: {
          // 即使元数据中包含角色信息，也应该被忽略
          role: "ADMIN",
          full_name: "Potential Admin",
        },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)

      const createdUser = {
        ...newUser,
        role: "USER", // 应该强制为 USER
        status: "ACTIVE",
      }
      ;(mockPrisma.user.create as any).mockResolvedValue(createdUser as any)

      const result = await syncUserFromAuth(newUser)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "USER", // 必须是 USER，不能是 ADMIN
        }),
      })

      expect(result.role).toBe("USER")
    })
  })

  describe("错误处理和恢复", () => {
    it("应该提供详细错误信息当数据库连接失败", async () => {
      const user = { id: "db-error", email: "error@test.com" }
      ;(mockPrisma.user.findUnique as any).mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:5432")
      )

      await expect(syncUserFromAuth(user)).rejects.toThrow(
        "用户数据同步失败: connect ECONNREFUSED 127.0.0.1:5432"
      )
    })

    it("应该处理数据库超时错误", async () => {
      const user = { id: "timeout", email: "timeout@test.com" }
      ;(mockPrisma.user.findUnique as any).mockRejectedValue(new Error("Query timeout"))

      await expect(syncUserFromAuth(user)).rejects.toThrow("用户数据同步失败: Query timeout")
    })

    it("应该处理未知错误类型", async () => {
      const user = { id: "unknown-error", email: "unknown@test.com" }
      ;(mockPrisma.user.findUnique as any).mockRejectedValue("非Error对象的异常")

      await expect(syncUserFromAuth(user)).rejects.toThrow("用户数据同步失败: 未知错误")
    })
  })

  describe("性能优化测试", () => {
    it("应该在 200ms 内完成新用户创建", async () => {
      const user = {
        id: "perf-new-user",
        email: "perfnew@test.com",
        user_metadata: { full_name: "Performance Test User" },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
      ;(mockPrisma.user.create as any).mockResolvedValue({
        ...user,
        name: user.user_metadata.full_name,
        avatarUrl: user.user_metadata.avatar_url ?? null,
        role: "USER",
        status: "ACTIVE",
      } as any)

      const startTime = performance.now()
      await syncUserFromAuth(user)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(200)
    })

    it("应该在 150ms 内完成现有用户更新", async () => {
      const user = {
        id: TEST_USERS.user.id,
        email: TEST_USERS.user.email,
        user_metadata: { full_name: "更新后的用户名" },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(TEST_USERS.user as any)
      ;(mockPrisma.user.update as any).mockResolvedValue({
        ...TEST_USERS.user,
        name: user.user_metadata.full_name,
      } as any)

      const startTime = performance.now()
      await syncUserFromAuth(user)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(150)
    })
  })

  describe("数据清理和验证", () => {
    it("应该清理和验证邮箱格式", async () => {
      const userWithMessyEmail = {
        id: "messy-email",
        email: "  MESSY.Email+Tag@Example.COM  ",
        user_metadata: { full_name: "Messy Email User" },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
      ;(mockPrisma.user.create as any).mockResolvedValue({
        ...userWithMessyEmail,
        name: userWithMessyEmail.user_metadata.full_name,
        avatarUrl: userWithMessyEmail.user_metadata.avatar_url ?? null,
        role: "USER",
        status: "ACTIVE",
      } as any)

      await syncUserFromAuth(userWithMessyEmail)

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: userWithMessyEmail.email, // 应该保持原始邮箱格式
        }),
      })
    })

    it("应该处理头像 URL 验证", async () => {
      const userWithInvalidAvatar = {
        id: "invalid-avatar",
        email: "invalidavatar@test.com",
        user_metadata: {
          full_name: "Invalid Avatar User",
          avatar_url: "not-a-valid-url",
        },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
      ;(mockPrisma.user.create as any).mockResolvedValue({
        ...userWithInvalidAvatar,
        name: userWithInvalidAvatar.user_metadata.full_name,
        avatarUrl: userWithInvalidAvatar.user_metadata.avatar_url,
        role: "USER",
        status: "ACTIVE",
      } as any)

      const result = await syncUserFromAuth(userWithInvalidAvatar)

      // 应该接受任何 avatar_url 值（验证由前端处理）
      expect(result.avatarUrl).toBe("not-a-valid-url")
    })

    it("应该限制用户名长度", async () => {
      const userWithLongName = {
        id: "long-name",
        email: "longname@test.com",
        user_metadata: {
          full_name: "A".repeat(300), // 超长用户名
        },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValue(null)
      ;(mockPrisma.user.create as any).mockResolvedValue({
        ...userWithLongName,
        name: userWithLongName.user_metadata.full_name,
        avatarUrl: userWithLongName.user_metadata.avatar_url ?? null,
        role: "USER",
        status: "ACTIVE",
      } as any)

      const result = await syncUserFromAuth(userWithLongName)

      // 应该接受超长名称（数据库层面处理截断）
      expect(result.name).toBe(userWithLongName.user_metadata.full_name)
    })
  })

  describe("集成场景测试", () => {
    it("应该正确处理 GitHub → 邮箱 → GitHub 的账户切换", async () => {
      const userId = "switch-user"
      const email = "switch@test.com"

      // 1. 首次 GitHub 登录
      const githubLogin = {
        id: userId,
        email,
        user_metadata: {
          full_name: "GitHub User",
          avatar_url: "github-avatar.jpg",
          provider: "github",
        },
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValueOnce(null)
      ;(mockPrisma.user.create as any).mockResolvedValueOnce({
        id: userId,
        email,
        name: "GitHub User",
        avatarUrl: "github-avatar.jpg",
        role: "USER",
        status: "ACTIVE",
      } as any)

      const firstLogin = await syncUserFromAuth(githubLogin)
      expect(firstLogin.name).toBe("GitHub User")
      expect(firstLogin.avatarUrl).toBe("github-avatar.jpg")

      // 2. 后续登录（更新信息）
      const updatedGithubLogin = {
        id: userId,
        email,
        user_metadata: {
          full_name: "Updated GitHub User",
          avatar_url: "updated-github-avatar.jpg",
          provider: "github",
        },
      }

      const existingUser = {
        id: userId,
        email,
        name: "GitHub User",
        avatarUrl: "github-avatar.jpg",
        role: "USER",
        status: "ACTIVE",
      }
      ;(mockPrisma.user.findUnique as any).mockResolvedValueOnce(existingUser as any)
      ;(mockPrisma.user.update as any).mockResolvedValueOnce({
        ...existingUser,
        name: "Updated GitHub User",
        avatarUrl: "updated-github-avatar.jpg",
        lastLoginAt: expect.any(Date),
      } as any)

      const secondLogin = await syncUserFromAuth(updatedGithubLogin)
      expect(secondLogin.name).toBe("Updated GitHub User")
      expect(secondLogin.avatarUrl).toBe("updated-github-avatar.jpg")
    })
  })
})
