/**
 * 管理员用户管理 API 测试套件
 * 测试范围: GET /api/admin/users, POST/DELETE /ban, POST /role
 * 覆盖率目标: ≥90%
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET as getUsersList, POST as createUser } from "@/app/api/admin/users/route"
import { POST as banUser, DELETE as unbanUser } from "@/app/api/admin/users/[userId]/ban/route"
import { POST as changeRole } from "@/app/api/admin/users/[userId]/role/route"
import type { User } from "@/lib/generated/prisma"

// Mock dependencies
const mockRequireAdmin = vi.hoisted(() => vi.fn())
const mockGenerateRequestId = vi.hoisted(() => vi.fn(() => "test-request-id"))
const mockClearUserCache = vi.hoisted(() => vi.fn())
const mockValidateApiPermissions = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: mockRequireAdmin,
  generateRequestId: mockGenerateRequestId,
  clearUserCache: mockClearUserCache,
  requireAdminUser: vi.fn(),
}))

vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: mockValidateApiPermissions,
}))

vi.mock("@/lib/audit-log", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit-log")>()
  return {
    ...actual,
    auditLogger: {
      logEvent: vi.fn(),
    },
    getClientIP: vi.fn(() => "127.0.0.1"),
    getClientUserAgent: vi.fn(() => "vitest-test-agent"),
  }
})

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock Prisma
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }

  return {
    prisma: mockPrisma,
  }
})

const { prisma } = await import("@/lib/prisma")
const { auditLogger } = await import("@/lib/audit-log")

describe("管理员用户管理 API 测试", () => {
  const mockAdminUser: User = {
    id: "admin-123",
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN",
    status: "ACTIVE",
    avatarUrl: null,
    bio: null,
    location: null,
    website: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    lastLoginAt: new Date("2024-01-15"),
  }

  const mockRegularUser: User = {
    id: "user-456",
    email: "user@example.com",
    name: "Regular User",
    role: "USER",
    status: "ACTIVE",
    avatarUrl: null,
    bio: null,
    location: null,
    website: null,
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-10"),
    lastLoginAt: new Date("2024-01-20"),
  }

  const mockBannedUser: User = {
    id: "user-789",
    email: "banned@example.com",
    name: "Banned User",
    role: "USER",
    status: "BANNED",
    avatarUrl: null,
    bio: null,
    location: null,
    website: null,
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-05"),
    lastLoginAt: new Date("2024-01-08"),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateRequestId.mockReturnValue("test-request-id")
    mockRequireAdmin.mockResolvedValue(mockAdminUser)
    mockValidateApiPermissions.mockResolvedValue({
      success: true,
      error: null,
      user: mockAdminUser,
    })
  })

  describe("GET /api/admin/users - 获取用户列表", () => {
    it("应该成功返回用户列表和统计信息", async () => {
      const mockUsersData = [
        {
          ...mockAdminUser,
          _count: { posts: 10, comments: 5, activities: 15 },
        },
        {
          ...mockRegularUser,
          _count: { posts: 3, comments: 8, activities: 2 },
        },
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsersData)
      vi.mocked(prisma.user.count).mockResolvedValueOnce(2) // Total count
      vi.mocked(prisma.user.count).mockResolvedValueOnce(50) // Total users
      vi.mocked(prisma.user.count).mockResolvedValueOnce(45) // Active users
      vi.mocked(prisma.user.count).mockResolvedValueOnce(3) // Admin users
      vi.mocked(prisma.user.count).mockResolvedValueOnce(2) // Today's new users
      vi.mocked(prisma.user.count).mockResolvedValueOnce(5) // Banned users

      const request = new NextRequest("http://localhost/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.users).toHaveLength(2)
      expect(data.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        hasMore: false,
      })
      expect(data.data.summary).toMatchObject({
        totalUsers: 50,
        activeUsers: 45,
        adminUsers: 3,
        todayNewUsers: 2,
        bannedUsers: 5,
      })
    })

    it("应该支持分页参数", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(100)

      const request = new NextRequest(
        "http://localhost/api/admin/users?page=2&limit=10"
      )
      const response = await getUsersList(request)
      const data = await response.json()

      expect(data.data.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 100,
        totalPages: 10,
      })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * 10
          take: 10,
        })
      )
    })

    it("应该支持按状态筛选", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = new NextRequest(
        "http://localhost/api/admin/users?status=BANNED"
      )
      await getUsersList(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "BANNED",
          }),
        })
      )
    })

    it("应该支持按角色筛选", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = new NextRequest(
        "http://localhost/api/admin/users?role=ADMIN"
      )
      await getUsersList(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: "ADMIN",
          }),
        })
      )
    })

    it("应该支持搜索功能", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = new NextRequest(
        "http://localhost/api/admin/users?search=test"
      )
      await getUsersList(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: "test", mode: "insensitive" } },
              { email: { contains: "test", mode: "insensitive" } },
            ],
          }),
        })
      )
    })

    it("应该限制最大每页数量为100", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = new NextRequest(
        "http://localhost/api/admin/users?limit=500"
      )
      await getUsersList(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Clamped to MAX_LIMIT
        })
      )
    })

    it("非管理员应该返回403", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("需要管理员权限"))

      const request = new NextRequest("http://localhost/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("需要管理员权限")
    })

    it("数据库错误应该返回500", async () => {
      vi.mocked(prisma.user.findMany).mockRejectedValue(
        new Error("Database connection failed")
      )

      const request = new NextRequest("http://localhost/api/admin/users")
      const response = await getUsersList(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("获取用户列表失败")
    })
  })

  describe("POST /api/admin/users/[userId]/ban - 封禁用户", () => {
    it("应该成功封禁用户", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser)
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockRegularUser,
        status: "BANNED",
      })

      const request = new NextRequest(
        "http://localhost/api/admin/users/user-456/ban",
        { method: "POST" }
      )

      const response = await banUser(request, {
        params: Promise.resolve({ userId: "user-456" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("用户已封禁")

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-456" },
          data: { status: "BANNED" },
        })
      )

      expect(mockClearUserCache).toHaveBeenCalledWith("user-456")
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ACCOUNT_BANNED",
          resource: "user:user-456",
          success: true,
        })
      )
    })

    it("应该阻止管理员封禁自己", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser)

      const request = new NextRequest(
        "http://localhost/api/admin/users/admin-123/ban",
        { method: "POST" }
      )

      const response = await banUser(request, {
        params: Promise.resolve({ userId: "admin-123" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("不能封禁自己")

      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ADMIN_ACTION",
          success: false,
          errorMessage: "管理员不能封禁自己",
        })
      )
    })

    it("用户不存在应该返回404", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost/api/admin/users/nonexistent/ban",
        { method: "POST" }
      )

      const response = await banUser(request, {
        params: Promise.resolve({ userId: "nonexistent" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("用户不存在")
    })

    it("数据库错误应该返回500并记录审计日志", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser)
      vi.mocked(prisma.user.update).mockRejectedValue(
        new Error("Database error")
      )

      const request = new NextRequest(
        "http://localhost/api/admin/users/user-456/ban",
        { method: "POST" }
      )

      const response = await banUser(request, {
        params: Promise.resolve({ userId: "user-456" }),
      })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)

      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ACCOUNT_BANNED",
          success: false,
          errorMessage: "Database error",
        })
      )
    })
  })

  describe("DELETE /api/admin/users/[userId]/ban - 解除封禁", () => {
    it("应该成功解除封禁", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockBannedUser)
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockBannedUser,
        status: "ACTIVE",
      })

      const request = new NextRequest(
        "http://localhost/api/admin/users/user-789/ban",
        { method: "DELETE" }
      )

      const response = await unbanUser(request, {
        params: Promise.resolve({ userId: "user-789" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("用户已解封")

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-789" },
          data: { status: "ACTIVE" },
        })
      )

      expect(mockClearUserCache).toHaveBeenCalledWith("user-789")
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ACCOUNT_UNBANNED",
          resource: "user:user-789",
          success: true,
        })
      )
    })

    it("用户不存在应该返回404", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost/api/admin/users/nonexistent/ban",
        { method: "DELETE" }
      )

      const response = await unbanUser(request, {
        params: Promise.resolve({ userId: "nonexistent" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("用户不存在")
    })
  })

  describe("POST /api/admin/users/[userId]/role - 修改用户角色", () => {
    it("应该成功将用户提升为管理员", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser)
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockRegularUser,
        role: "ADMIN",
      })

      const request = new NextRequest(
        "http://localhost/api/admin/users/user-456/role",
        {
          method: "POST",
          body: JSON.stringify({ role: "ADMIN" }),
        }
      )

      const response = await changeRole(request, {
        params: Promise.resolve({ userId: "user-456" }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe("角色已更新为 ADMIN")

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-456" },
          data: { role: "ADMIN" },
        })
      )

      expect(mockClearUserCache).toHaveBeenCalledWith("user-456")
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ROLE_CHANGED",
          resource: "user:user-456",
          success: true,
        })
      )
    })

    it("应该阻止管理员降级自己", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser)

      const request = new NextRequest(
        "http://localhost/api/admin/users/admin-123/role",
        {
          method: "POST",
          body: JSON.stringify({ role: "USER" }),
        }
      )

      const response = await changeRole(request, {
        params: Promise.resolve({ userId: "admin-123" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("不能降级自己的角色")

      expect(prisma.user.update).not.toHaveBeenCalled()
      expect(auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ADMIN_ACTION",
          success: false,
          errorMessage: "管理员不能降级自己",
        })
      )
    })

    it("缺少role参数应该返回400", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser)

      const request = new NextRequest(
        "http://localhost/api/admin/users/user-456/role",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      )

      const response = await changeRole(request, {
        params: Promise.resolve({ userId: "user-456" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("无效的角色值")
    })

    it("无效的role值应该返回400", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser)

      const request = new NextRequest(
        "http://localhost/api/admin/users/user-456/role",
        {
          method: "POST",
          body: JSON.stringify({ role: "SUPERADMIN" }),
        }
      )

      const response = await changeRole(request, {
        params: Promise.resolve({ userId: "user-456" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("无效的角色值")
    })

    it("用户不存在应该返回404", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost/api/admin/users/nonexistent/role",
        {
          method: "POST",
          body: JSON.stringify({ role: "ADMIN" }),
        }
      )

      const response = await changeRole(request, {
        params: Promise.resolve({ userId: "nonexistent" }),
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.message).toBe("用户不存在")
    })
  })

  describe("POST /api/admin/users - 创建新用户", () => {
    it("应该成功创建新用户", async () => {
      const newUserData = {
        id: "new-user-id",
        email: "newuser@example.com",
        name: "New User",
        role: "USER" as const,
        status: "ACTIVE" as const,
        createdAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // Email doesn't exist
      vi.mocked(prisma.user.create).mockResolvedValue(newUserData as User)

      const request = new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "newuser@example.com",
          name: "New User",
          role: "USER",
          status: "ACTIVE",
        }),
      })

      const response = await createUser(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data).toMatchObject({
        email: "newuser@example.com",
        name: "New User",
        role: "USER",
        status: "ACTIVE",
      })
      expect(data.message).toBe("用户创建成功")
    })

    it("邮箱格式不正确应该返回400", async () => {
      const request = new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "invalid-email",
          name: "Test User",
        }),
      })

      const response = await createUser(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INVALID_EMAIL")
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it("用户名少于2个字符应该返回400", async () => {
      const request = new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          name: "A",
        }),
      })

      const response = await createUser(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INVALID_NAME")
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it("无效的角色应该返回400", async () => {
      const request = new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
          role: "SUPERADMIN",
        }),
      })

      const response = await createUser(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe("INVALID_ROLE")
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it("邮箱已存在应该返回409", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser)

      const request = new NextRequest("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          name: "Duplicate User",
        }),
      })

      const response = await createUser(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.code).toBe("EMAIL_EXISTS")
      expect(prisma.user.create).not.toHaveBeenCalled()
    })
  })
})
