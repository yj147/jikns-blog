/**
 * 权限系统集成测试
 * 测试用户认证、授权和权限检查
 * 覆盖率目标：≥ 95%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TEST_USERS } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import { mockPrisma, resetPrismaMocks, mockDatabaseError } from "../__mocks__/prisma"
import { setupTestEnv } from "../helpers/test-env"

// Mock 认证模块
vi.mock("@/lib/supabase", async () => {
  const { createMockSupabaseClient } = await import("../__mocks__/supabase")
  return {
    createServerSupabaseClient: vi.fn(() => createMockSupabaseClient()),
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("权限系统集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    resetPrismaMocks()

    // 使用标准化环境配置
    setupTestEnv()
  })

  afterEach(() => {
    resetMocks()
    resetPrismaMocks()
  })

  describe("getCurrentUser() 函数测试", () => {
    it("已登录用户应该返回用户信息", async () => {
      setCurrentTestUser("user")

      const { getCurrentUser } = await import("@/lib/auth")
      const user = await getCurrentUser()

      expect(user).toBeTruthy()
      expect(user?.id).toBe(TEST_USERS.user.id)
      expect(user?.email).toBe(TEST_USERS.user.email)
      expect(user?.role).toBe("USER")
    })

    it("未登录用户应该返回 null", async () => {
      setCurrentTestUser(null)

      const { getCurrentUser } = await import("@/lib/auth")
      const user = await getCurrentUser()

      expect(user).toBeNull()
    })

    it("会话存在但数据库中用户不存在应该返回 null", async () => {
      setCurrentTestUser("user")

      // Mock 数据库查询返回 null
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)

      const { getCurrentUser } = await import("@/lib/auth")
      const user = await getCurrentUser()

      expect(user).toBeNull()
    })
  })

  describe("requireAuth() 函数测试", () => {
    it("已认证的活跃用户应该返回用户信息", async () => {
      setCurrentTestUser("user")

      const { requireAuth } = await import("@/lib/auth")
      const user = await requireAuth()

      expect(user).toBeTruthy()
      expect(user.id).toBe(TEST_USERS.user.id)
      expect(user.status).toBe("ACTIVE")
    })

    it("未登录用户应该抛出认证错误", async () => {
      setCurrentTestUser(null)

      const { requireAuth } = await import("@/lib/auth")

      await expect(requireAuth()).rejects.toThrow("用户未登录")
    })

    it("被封禁用户应该抛出权限错误", async () => {
      setCurrentTestUser("bannedUser")

      const { requireAuth } = await import("@/lib/auth")

      await expect(requireAuth()).rejects.toThrow("账户已被封禁")
    })

    it("应该正确处理数据库查询错误", async () => {
      setCurrentTestUser("user")
      mockDatabaseError(new Error("数据库连接超时"))

      const { requireAuth } = await import("@/lib/auth")

      await expect(requireAuth()).rejects.toThrow()
    })
  })

  describe("requireAdmin() 函数测试", () => {
    it("未登录用户应该抛出认证错误", async () => {
      setCurrentTestUser(null)

      const { requireAdmin } = await import("@/lib/auth")

      await expect(requireAdmin()).rejects.toThrow("未登录用户")
    })

    it("普通用户应该抛出权限错误", async () => {
      setCurrentTestUser("user")

      const { requireAdmin } = await import("@/lib/auth")

      await expect(requireAdmin()).rejects.toThrow("需要管理员权限")
    })

    it("被封禁的管理员应该抛出账户状态错误", async () => {
      // 创建被封禁的管理员用户
      const bannedAdmin = {
        ...TEST_USERS.admin,
        status: "BANNED" as const,
      }
      setCurrentTestUser("bannedUser")

      // Mock 数据库返回被封禁的管理员用户
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(bannedAdmin as any)

      const { requireAdmin } = await import("@/lib/auth")

      await expect(requireAdmin()).rejects.toThrow("账户已被封禁")
    })

    it("活跃的管理员应该成功验证", async () => {
      setCurrentTestUser("admin")

      const { requireAdmin } = await import("@/lib/auth")
      const admin = await requireAdmin()

      expect(admin).toBeTruthy()
      expect(admin.role).toBe("ADMIN")
      expect(admin.status).toBe("ACTIVE")
    })

    it("数据库错误应该抛出异常", async () => {
      setCurrentTestUser("admin")
      mockDatabaseError(new Error("数据库查询超时"))

      const { requireAdmin } = await import("@/lib/auth")

      await expect(requireAdmin()).rejects.toThrow()
    })
  })

  describe("syncUserFromAuth() 函数测试", () => {
    it("应该创建新用户", async () => {
      const newAuthUser = {
        id: "new-user-123",
        email: "newuser@test.com",
        user_metadata: {
          full_name: "New User",
          avatar_url: "https://avatar.test/new.jpg",
        },
      }

      // Mock 数据库查询：用户不存在
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)

      // Mock 创建用户
      const expectedNewUser = {
        ...TEST_USERS.user,
        id: newAuthUser.id,
        email: newAuthUser.email,
        name: "New User",
        avatarUrl: "https://avatar.test/new.jpg",
        role: "USER",
        status: "ACTIVE",
      }
      vi.mocked(mockPrisma.user.create).mockResolvedValue(expectedNewUser as any)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const result = await syncUserFromAuth(newAuthUser)

      expect(result.id).toBe(newAuthUser.id)
      expect(result.email).toBe(newAuthUser.email)
      expect(result.name).toBe("New User")
      expect(result.role).toBe("USER")
      expect(mockPrisma.user.create).toHaveBeenCalled()
    })

    it("应该更新现有用户", async () => {
      const existingAuthUser = {
        id: TEST_USERS.user.id,
        email: TEST_USERS.user.email,
        user_metadata: {
          full_name: "Updated Name",
          avatar_url: "https://avatar.test/updated.jpg",
        },
      }

      // Mock 数据库查询：用户存在
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      // Mock 更新用户
      const expectedUpdatedUser = {
        ...TEST_USERS.user,
        name: "Updated Name",
        avatarUrl: "https://avatar.test/updated.jpg",
        lastLoginAt: new Date(),
      }
      vi.mocked(mockPrisma.user.update).mockResolvedValue(expectedUpdatedUser as any)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const result = await syncUserFromAuth(existingAuthUser)

      expect(result.name).toBe("Updated Name")
      expect(result.avatarUrl).toBe("https://avatar.test/updated.jpg")
      expect(mockPrisma.user.update).toHaveBeenCalled()
    })

    it("邮箱为空应该抛出错误", async () => {
      const invalidAuthUser = {
        id: "user-123",
        email: null,
        user_metadata: null,
      }

      const { syncUserFromAuth } = await import("@/lib/auth")

      await expect(syncUserFromAuth(invalidAuthUser)).rejects.toThrow("用户邮箱不能为空")
    })

    it("数据库错误应该抛出同步失败错误", async () => {
      const authUser = {
        id: "user-123",
        email: "test@test.com",
        user_metadata: null,
      }

      mockDatabaseError(new Error("数据库连接失败"))

      const { syncUserFromAuth } = await import("@/lib/auth")

      await expect(syncUserFromAuth(authUser)).rejects.toThrow("用户数据同步失败")
    })
  })

  describe("isEmailRegistered() 函数测试", () => {
    it("已注册的邮箱应该返回 true", async () => {
      // Mock 数据库查询返回用户记录
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      const { isEmailRegistered } = await import("@/lib/auth")
      const result = await isEmailRegistered(TEST_USERS.user.email)

      expect(result).toBe(true)
    })

    it("未注册的邮箱应该返回 false", async () => {
      // Mock 数据库查询返回 null
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)

      const { isEmailRegistered } = await import("@/lib/auth")
      const result = await isEmailRegistered("unregistered@test.com")

      expect(result).toBe(false)
    })

    it("应该处理邮箱大小写", async () => {
      // Mock 数据库查询返回用户记录
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      const { isEmailRegistered } = await import("@/lib/auth")
      const result = await isEmailRegistered("ADMIN@TEST.COM")

      expect(result).toBe(true)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "admin@test.com" },
        select: { id: true },
      })
    })

    it("数据库错误应该返回 false 而不是抛出异常", async () => {
      mockDatabaseError(new Error("数据库连接失败"))

      const { isEmailRegistered } = await import("@/lib/auth")
      const result = await isEmailRegistered("test@test.com")

      expect(result).toBe(false)
    })
  })

  describe("重定向 URL 验证", () => {
    it("validateRedirectUrl() 应该验证安全的重定向 URL", async () => {
      const { validateRedirectUrl } = await import("@/lib/auth")

      // 测试有效的相对路径
      expect(validateRedirectUrl("/admin")).toBe(true)
      expect(validateRedirectUrl("/profile?tab=settings")).toBe(true)

      // 测试有效的同域绝对 URL
      expect(validateRedirectUrl("http://localhost:3000/admin")).toBe(true)
    })

    it("validateRedirectUrl() 应该拒绝危险的重定向 URL", async () => {
      const { validateRedirectUrl } = await import("@/lib/auth")

      // 测试外部域名
      expect(validateRedirectUrl("https://evil.com/steal-data")).toBe(false)
      expect(validateRedirectUrl("http://malicious.site")).toBe(false)

      // 测试无效格式
      expect(validateRedirectUrl("")).toBe(false)
      expect(validateRedirectUrl("///")).toBe(false)
      expect(validateRedirectUrl("not-a-url")).toBe(false)
    })

    it("getAuthRedirectUrl() 应该生成正确的回调 URL", async () => {
      const { getAuthRedirectUrl } = await import("@/lib/auth")

      // 测试基本回调 URL (修正期望值)
      const basicUrl = getAuthRedirectUrl()
      expect(basicUrl).toBe("http://localhost:3000/auth/callback")

      // 测试带重定向参数的 URL (修正期望值)
      const redirectUrl = getAuthRedirectUrl("/admin/posts")
      expect(redirectUrl).toContain("redirect=%2Fadmin%2Fposts")
      expect(redirectUrl).toContain("http://localhost:3000/auth/callback")
    })
  })

  describe("会话安全检查", () => {
    it("getUserSession() 应该返回有效会话", async () => {
      setCurrentTestUser("user")

      const { getUserSession } = await import("@/lib/auth")
      const { session, error } = await getUserSession()

      expect(session).toBeTruthy()
      expect(session?.user.id).toBe(TEST_USERS.user.id)
      expect(error).toBeNull()
    })

    it("getUserSession() 应该处理会话错误", async () => {
      setCurrentTestUser(null)

      // 需要 Mock Supabase 客户端返回错误
      const { createServerSupabaseClient } = await import("@/lib/supabase")

      vi.mocked(createServerSupabaseClient).mockResolvedValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: new Error("Session expired"),
          }),
        },
      } as any)

      const { getUserSession } = await import("@/lib/auth")
      const { session, error } = await getUserSession()

      expect(session).toBeNull()
      expect(error).toBeTruthy()
    })
  })

  describe("边界条件测试", () => {
    it("应该处理 undefined 用户元数据", async () => {
      const authUserWithoutMetadata = {
        id: "user-no-metadata",
        email: "nometadata@test.com",
        user_metadata: undefined,
      }

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(mockPrisma.user.create).mockResolvedValue({
        ...TEST_USERS.user,
        id: authUserWithoutMetadata.id,
        email: authUserWithoutMetadata.email,
        name: null,
        avatarUrl: null,
      } as any)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const result = await syncUserFromAuth(authUserWithoutMetadata)

      expect(result.id).toBe(authUserWithoutMetadata.id)
      expect(result.name).toBeNull()
      expect(result.avatarUrl).toBeNull()
    })

    it("应该处理空的用户元数据", async () => {
      const authUserWithEmptyMetadata = {
        id: "user-empty-metadata",
        email: "empty@test.com",
        user_metadata: {},
      }

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(mockPrisma.user.create).mockResolvedValue({
        ...TEST_USERS.user,
        id: authUserWithEmptyMetadata.id,
        email: authUserWithEmptyMetadata.email,
        name: null,
        avatarUrl: null,
      } as any)

      const { syncUserFromAuth } = await import("@/lib/auth")
      const result = await syncUserFromAuth(authUserWithEmptyMetadata)

      expect(result.name).toBeNull()
      expect(result.avatarUrl).toBeNull()
    })
  })
})
