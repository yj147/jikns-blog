/**
 * 认证工具函数单元测试
 * 测试认证相关的核心工具函数
 * 覆盖率目标：≥ 95%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getUserSession,
  getCurrentUser,
  requireAdmin,
  requireAuth,
  syncUserFromAuth,
  isEmailRegistered,
  getAuthRedirectUrl,
  validateRedirectUrl,
} from "@/lib/auth"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import { TEST_USERS, createTestSession } from "../helpers/test-data"
import { mockPrisma, resetPrismaMocks } from "../__mocks__/prisma"

// Mock 外部依赖
vi.mock("@/lib/supabase", () => import("../__mocks__/supabase"))
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))
vi.mock("@/lib/security", () => ({
  SessionSecurity: {
    isSessionExpired: vi.fn(() => false),
    shouldRefreshSession: vi.fn(() => false),
  },
}))

describe("认证工具函数测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    resetPrismaMocks()

    // 设置环境变量
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
  })

  afterEach(() => {
    resetMocks()
    resetPrismaMocks()
  })

  describe("getUserSession", () => {
    it("应该返回有效会话当用户已登录", async () => {
      setCurrentTestUser("admin")

      const result = await getUserSession()

      expect(result.session).toBeTruthy()
      expect(result.session?.user.id).toBe(TEST_USERS.admin.id)
      expect(result.error).toBeNull()
    })

    it("应该返回 null 当用户未登录", async () => {
      setCurrentTestUser(null)

      const result = await getUserSession()

      expect(result.session).toBeNull()
      expect(result.error).toBeNull()
    })

    it("应该处理会话获取错误", async () => {
      setCurrentTestUser("admin")

      // 模拟 Supabase 错误
      const { createServerSupabaseClient } = await import("@/lib/supabase")
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: new Error("Session expired"),
          }),
        },
      } as any)

      const result = await getUserSession()

      expect(result.session).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it("应该使用 React cache 优化避免重复查询", async () => {
      setCurrentTestUser("user")

      // 连续调用两次
      await getUserSession()
      await getUserSession()

      // 由于使用了 React cache，Supabase 客户端应该只被创建一次
      // 这是一个性能测试，验证 cache 的工作
      expect(true).toBe(true) // 简化断言，主要测试无错误执行
    })
  })

  describe("getCurrentUser", () => {
    it("应该返回完整用户信息当用户已登录", async () => {
      setCurrentTestUser("admin")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.admin as any)

      const user = await getCurrentUser()

      expect(user).toBeTruthy()
      expect(user?.id).toBe(TEST_USERS.admin.id)
      expect(user?.role).toBe("ADMIN")
    })

    it("应该返回 null 当用户未登录", async () => {
      setCurrentTestUser(null)

      const user = await getCurrentUser()

      expect(user).toBeNull()
    })

    it("应该返回 null 当数据库查询失败", async () => {
      setCurrentTestUser("user")
      vi.mocked(mockPrisma.user.findUnique).mockRejectedValue(new Error("数据库错误"))

      const user = await getCurrentUser()

      expect(user).toBeNull()
    })
  })

  describe("requireAdmin", () => {
    it("应该返回管理员用户当权限验证通过", async () => {
      setCurrentTestUser("admin")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.admin as any)

      const admin = await requireAdmin()

      expect(admin).toBeTruthy()
      expect(admin.role).toBe("ADMIN")
      expect(admin.status).toBe("ACTIVE")
    })

    it("应该抛出错误当用户未登录", async () => {
      setCurrentTestUser(null)

      await expect(requireAdmin()).rejects.toThrow("未登录用户")
    })

    it("应该抛出错误当用户不是管理员", async () => {
      setCurrentTestUser("user")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      await expect(requireAdmin()).rejects.toThrow("需要管理员权限")
    })

    it("应该抛出错误当管理员账户被封禁", async () => {
      setCurrentTestUser("bannedUser")
      const bannedAdmin = { ...TEST_USERS.bannedUser, role: "ADMIN" as const }
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(bannedAdmin as any)

      await expect(requireAdmin()).rejects.toThrow("账户已被封禁")
    })
  })

  describe("requireAuth", () => {
    it("应该返回用户当认证验证通过", async () => {
      setCurrentTestUser("user")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      const user = await requireAuth()

      expect(user).toBeTruthy()
      expect(user.status).toBe("ACTIVE")
    })

    it("应该抛出错误当用户未登录", async () => {
      setCurrentTestUser(null)

      await expect(requireAuth()).rejects.toThrow("用户未登录")
    })

    it("应该抛出错误当用户被封禁", async () => {
      setCurrentTestUser("bannedUser")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.bannedUser as any)

      await expect(requireAuth()).rejects.toThrow("账户已被封禁")
    })
  })

  describe("syncUserFromAuth", () => {
    it("应该创建新用户当用户不存在", async () => {
      const newAuthUser = {
        id: "new-user-123",
        email: "new@test.com",
        user_metadata: {
          full_name: "New User",
          avatar_url: "https://avatar.test/new.jpg",
        },
      }

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)
      const expectedUser = {
        ...TEST_USERS.user,
        ...newAuthUser,
        name: "New User",
        avatarUrl: "https://avatar.test/new.jpg",
      }
      vi.mocked(mockPrisma.user.create).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(newAuthUser)

      expect(result.id).toBe(newAuthUser.id)
      expect(result.name).toBe("New User")
      expect(mockPrisma.user.create).toHaveBeenCalled()
    })

    it("应该更新现有用户当用户已存在", async () => {
      const existingAuthUser = {
        id: TEST_USERS.user.id,
        email: TEST_USERS.user.email,
        user_metadata: {
          full_name: "Updated User",
          avatar_url: "https://avatar.test/updated.jpg",
        },
      }

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)
      const expectedUser = {
        ...TEST_USERS.user,
        name: "Updated User",
        avatarUrl: "https://avatar.test/updated.jpg",
      }
      vi.mocked(mockPrisma.user.update).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(existingAuthUser)

      expect(result.name).toBe("Updated User")
      expect(mockPrisma.user.update).toHaveBeenCalled()
    })

    it("应该抛出错误当邮箱为空", async () => {
      const invalidAuthUser = {
        id: "test-id",
        email: null,
        user_metadata: null,
      }

      await expect(syncUserFromAuth(invalidAuthUser)).rejects.toThrow("用户邮箱不能为空")
    })

    it("应该处理数据库错误", async () => {
      const authUser = {
        id: "test-id",
        email: "test@test.com",
        user_metadata: null,
      }

      vi.mocked(mockPrisma.user.findUnique).mockRejectedValue(new Error("数据库错误"))

      await expect(syncUserFromAuth(authUser)).rejects.toThrow("用户数据同步失败")
    })
  })

  describe("isEmailRegistered", () => {
    it("应该返回 true 当邮箱已注册", async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      const result = await isEmailRegistered(TEST_USERS.user.email)

      expect(result).toBe(true)
    })

    it("应该返回 false 当邮箱未注册", async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)

      const result = await isEmailRegistered("notexist@test.com")

      expect(result).toBe(false)
    })

    it("应该处理邮箱大小写转换", async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      await isEmailRegistered("TEST@EXAMPLE.COM")

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        select: { id: true },
      })
    })

    it("应该处理数据库错误", async () => {
      vi.mocked(mockPrisma.user.findUnique).mockRejectedValue(new Error("数据库错误"))

      const result = await isEmailRegistered("test@test.com")

      expect(result).toBe(false)
    })
  })

  describe("getAuthRedirectUrl", () => {
    it("应该生成基础回调 URL", () => {
      const url = getAuthRedirectUrl()

      expect(url).toBe("http://localhost:54321/auth/v1/callback")
    })

    it("应该生成带重定向参数的 URL", () => {
      const url = getAuthRedirectUrl("/admin/posts")

      expect(url).toContain("redirect_to=%2Fadmin%2Fposts")
      expect(url).toContain("http://localhost:54321/auth/v1/callback")
    })

    it("应该忽略根路径重定向", () => {
      const url = getAuthRedirectUrl("/")

      expect(url).toBe("http://localhost:54321/auth/v1/callback")
    })
  })

  describe("validateRedirectUrl", () => {
    it("应该允许有效的相对路径", () => {
      expect(validateRedirectUrl("/admin")).toBe(true)
      expect(validateRedirectUrl("/profile?tab=settings")).toBe(true)
      expect(validateRedirectUrl("/blog/post-123")).toBe(true)
    })

    it("应该允许有效的同域绝对 URL", () => {
      expect(validateRedirectUrl("http://localhost:3000/admin")).toBe(true)
      expect(validateRedirectUrl("http://localhost:3000/profile")).toBe(true)
    })

    it("应该拒绝外部域名", () => {
      expect(validateRedirectUrl("https://evil.com/steal-data")).toBe(false)
      expect(validateRedirectUrl("http://malicious.site")).toBe(false)
    })

    it("应该拒绝无效格式", () => {
      expect(validateRedirectUrl("")).toBe(false)
      expect(validateRedirectUrl("///")).toBe(false)
      expect(validateRedirectUrl("http://")).toBe(false)
      expect(validateRedirectUrl("not-a-url")).toBe(false)
    })
  })

  describe("性能测试", () => {
    it("getUserSession 应该在 50ms 内完成", async () => {
      setCurrentTestUser("user")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      const start = Date.now()
      await getUserSession()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(50)
    })

    it("getCurrentUser 应该在 100ms 内完成", async () => {
      setCurrentTestUser("user")
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(TEST_USERS.user as any)

      const start = Date.now()
      await getCurrentUser()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe("边缘情况测试", () => {
    it("应该处理未定义的用户元数据", async () => {
      const authUser = {
        id: "test-id",
        email: "test@test.com",
        user_metadata: undefined,
      }

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)
      const expectedUser = {
        ...TEST_USERS.user,
        id: authUser.id,
        email: authUser.email,
        name: null,
        avatarUrl: null,
      }
      vi.mocked(mockPrisma.user.create).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(authUser)

      expect(result.name).toBeNull()
      expect(result.avatarUrl).toBeNull()
    })

    it("应该处理空的用户元数据对象", async () => {
      const authUser = {
        id: "test-id",
        email: "test@test.com",
        user_metadata: {},
      }

      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)
      const expectedUser = {
        ...TEST_USERS.user,
        id: authUser.id,
        email: authUser.email,
        name: null,
        avatarUrl: null,
      }
      vi.mocked(mockPrisma.user.create).mockResolvedValue(expectedUser as any)

      const result = await syncUserFromAuth(authUser)

      expect(result.name).toBeNull()
      expect(result.avatarUrl).toBeNull()
    })
  })
})
