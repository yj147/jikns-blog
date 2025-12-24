/**
 * 核心认证功能稳定性测试
 * 专注于测试最重要的认证和权限功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { TEST_USERS } from "./helpers/test-data"

// Mock 设置
const mockPrismaUser = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
}

const mockSupabaseAuth = {
  getUser: vi.fn(),
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockPrismaUser,
  },
}))

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ auth: mockSupabaseAuth }),
  createServerSupabaseClient: () => ({ auth: mockSupabaseAuth }),
}))

describe("核心认证功能稳定性测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("用户认证状态检查", () => {
    it("应该正确验证管理员权限", async () => {
      const testUser = TEST_USERS.admin

      // Mock getUser instead of getSession
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: testUser.id,
            email: testUser.email,
          },
        },
        error: null,
      })

      mockPrismaUser.findUnique.mockResolvedValue(testUser)

      const { requireAdmin } = await import("@/lib/auth")
      const result = await requireAdmin()

      expect(result).toBeDefined()
      expect(result.email).toBe(testUser.email)
      expect(result.role).toBe("ADMIN")
    })

    it("应该拒绝普通用户的管理员权限", async () => {
      const normalUser = TEST_USERS.user

      // Mock getUser instead of getSession
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: normalUser.id,
            email: normalUser.email,
          },
        },
        error: null,
      })

      mockPrismaUser.findUnique.mockResolvedValue(normalUser)

      const { requireAdmin } = await import("@/lib/auth")

      await expect(requireAdmin()).rejects.toThrow("需要管理员权限")
    })
  })

  describe("权限验证", () => {
    it("应该正确验证已认证用户", async () => {
      const normalUser = TEST_USERS.user

      // Mock getUser instead of getSession
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: normalUser.id,
            email: normalUser.email,
          },
        },
        error: null,
      })

      mockPrismaUser.findUnique.mockResolvedValue(normalUser)

      const { requireAuth } = await import("@/lib/auth")
      const result = await requireAuth()

      expect(result).toBeDefined()
      expect(result.email).toBe(normalUser.email)
      expect(result.status).toBe("ACTIVE")
    })

    it("应该正确处理被封禁用户", async () => {
      const bannedUser = TEST_USERS.bannedUser

      // Mock getUser instead of getSession
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: {
          user: {
            id: bannedUser.id,
            email: bannedUser.email,
          },
        },
        error: null,
      })

      mockPrismaUser.findUnique.mockResolvedValue(bannedUser)

      const { requireAuth } = await import("@/lib/auth")

      await expect(requireAuth()).rejects.toThrow("账户已被封禁")
    })

    it("应该拒绝未登录用户", async () => {
      // Mock getUser instead of getSession
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { requireAuth } = await import("@/lib/auth")

      await expect(requireAuth()).rejects.toThrow("请先登录")
    })
  })

  describe("用户数据同步", () => {
    it("应该正确创建新用户", async () => {
      const newUserData = {
        id: "new-user-id",
        email: "newuser@test.com",
        name: "新用户",
        avatarUrl: null,
        bio: null,
        location: null,
        socialLinks: null,
        role: "USER" as const,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }

      // Mock findUnique 返回 null（新用户）
      mockPrismaUser.findUnique.mockResolvedValue(null)
      // Mock create 返回新用户
      mockPrismaUser.create.mockResolvedValue(newUserData)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const result = await syncUserFromAuth({
        id: newUserData.id,
        email: newUserData.email,
        user_metadata: {
          full_name: newUserData.name,
        },
      })

      expect(result).toBeDefined()
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: newUserData.id },
        })
      )
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: newUserData.id,
            email: newUserData.email,
          }),
        })
      )
    })

    it("应该正确更新现有用户（仅更新 lastLoginAt，已有 name 不覆盖）", async () => {
      const existingUser = {
        ...TEST_USERS.user,
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "现有 bio",
        location: "现有 location",
        socialLinks: { github: "https://github.com/test" },
      }
      const updatedUser = { ...existingUser, lastLoginAt: new Date() }

      // Mock findUnique 返回现有用户
      mockPrismaUser.findUnique.mockResolvedValue(existingUser)
      // Mock update 返回更新后的用户
      mockPrismaUser.update.mockResolvedValue(updatedUser)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const result = await syncUserFromAuth({
        id: existingUser.id,
        email: existingUser.email,
        user_metadata: {
          full_name: "更新的用户名",
        },
      })

      expect(result).toBeDefined()
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existingUser.id },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      )
      // 验证不会覆盖已有的 name
      const updateCall = mockPrismaUser.update.mock.calls[0][0]
      expect(updateCall.data.name).toBeUndefined()
    })
  })

  describe("错误处理", () => {
    it("应该正确处理数据库连接错误", async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: "test-id", email: "test@test.com" },
          },
        },
        error: null,
      })

      mockPrismaUser.findUnique.mockRejectedValue(new Error("数据库连接失败"))

      const { getCurrentUser } = await import("@/lib/auth")

      const result = await getCurrentUser()
      expect(result).toBeNull()
    })

    it("应该正确处理无效的用户数据", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth")

      await expect(
        syncUserFromAuth({
          id: "",
          email: "",
          user_metadata: {},
        })
      ).rejects.toThrow()
    })
  })
})
