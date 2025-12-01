import { describe, it, expect, vi, beforeEach } from "vitest"
import { TEST_USERS } from "../helpers/test-data"

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))

const mockAuth = vi.mocked(await import("@/lib/auth"))
const permissions = await import("@/lib/permissions")
// 触发 lib/auth/permissions.ts 的 re-export 覆盖率
await import("@/lib/auth/permissions")

const setCurrentUser = (user: any | null) => {
  mockAuth.getAuthenticatedUser.mockResolvedValue({ user, error: null } as any)
  mockAuth.getCurrentUser.mockResolvedValue(user as any)
}

describe("权限框架 - 管理员与作者识别", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("角色识别", () => {
    it("ADMIN 应被识别为管理员", async () => {
      setCurrentUser(TEST_USERS.admin)
      expect(await permissions.hasRole("ADMIN")).toBe(true)
      expect(await permissions.isAuthor()).toBe(false)
    })

    it("普通用户应被识别为作者", async () => {
      setCurrentUser(TEST_USERS.user)
      expect(await permissions.hasRole("USER")).toBe(true)
      expect(await permissions.isAuthor()).toBe(true)
    })

    it("未登录返回 false", async () => {
      setCurrentUser(null)
      expect(await permissions.hasRole("ADMIN")).toBe(false)
      expect(await permissions.isAuthor()).toBe(false)
    })
  })

  describe("基础身份校验", () => {
    it("requireAuth 未登录抛 UNAUTHORIZED", async () => {
      setCurrentUser(null)
      await expect(permissions.requireAuth()).rejects.toHaveProperty("code", "UNAUTHORIZED")
    })

    it("requireAdmin 非管理员抛 FORBIDDEN", async () => {
      setCurrentUser(TEST_USERS.user)
      await expect(permissions.requireAdmin()).rejects.toHaveProperty("code", "FORBIDDEN")
    })
  })

  describe("作者/管理员资源控制", () => {
    const resource = { id: "r1", authorId: TEST_USERS.user.id, visibility: "PRIVATE" }

    it("管理员可访问任意资源", async () => {
      setCurrentUser(TEST_USERS.admin)
      expect(await permissions.canAccessObject(resource)).toBe(true)
    })

    it("作者可访问自己的资源", async () => {
      setCurrentUser(TEST_USERS.user)
      expect(await permissions.canAccessObject(resource)).toBe(true)
    })

    it("作者不可访问他人私有资源", async () => {
      setCurrentUser(TEST_USERS.user)
      expect(await permissions.canAccessObject({ ...resource, authorId: "someone" })).toBe(false)
    })

    it("未登录仅可访问公开资源", async () => {
      setCurrentUser(null)
      expect(await permissions.canAccessObject({ ...resource, visibility: "PUBLIC" })).toBe(true)
      expect(await permissions.canAccessObject(resource)).toBe(false)
    })

    it("封禁用户拒绝访问", async () => {
      setCurrentUser(TEST_USERS.bannedUser)
      expect(await permissions.canAccessObject(resource)).toBe(false)
    })

    it("字符串资源访问: 公开路径允许未登录", async () => {
      setCurrentUser(null)
      expect(await permissions.canAccessResource("/")).toBe(true)
    })
  })

  describe("requireAuthorOrAdmin", () => {
    it("作者本人通过", async () => {
      setCurrentUser(TEST_USERS.user)
      const user = await permissions.requireAuthorOrAdmin(TEST_USERS.user.id)
      expect(user.id).toBe(TEST_USERS.user.id)
    })

    it("管理员通过", async () => {
      setCurrentUser(TEST_USERS.admin)
      const user = await permissions.requireAuthorOrAdmin("someone")
      expect(user.role).toBe("ADMIN")
    })

    it("越权用户抛出 FORBIDDEN", async () => {
      setCurrentUser(TEST_USERS.user)
      await expect(permissions.requireAuthorOrAdmin("other" as string)).rejects.toHaveProperty(
        "code",
        "FORBIDDEN"
      )
    })
  })

  describe("路由权限", () => {
    it("管理员路径仅管理员可访问", async () => {
      setCurrentUser(TEST_USERS.user)
      expect(await permissions.checkRoutePermission("/api/admin/users")).toBe(false)
      setCurrentUser(TEST_USERS.admin)
      expect(await permissions.checkRoutePermission("/api/admin/users")).toBe(true)
    })

    it("Feed 管理路径作者可访问", async () => {
      setCurrentUser(TEST_USERS.user)
      expect(await permissions.checkRoutePermission("/api/admin/feeds")).toBe(true)
    })

    it("未登录访问需认证路径返回 false", async () => {
      setCurrentUser(null)
      expect(await permissions.checkRoutePermission("/profile")).toBe(false)
    })
  })

  describe("角色变更即时生效", () => {
    it("第二次检查应读取最新角色而非缓存", async () => {
      mockAuth.getAuthenticatedUser.mockResolvedValue({ user: TEST_USERS.user, error: null } as any)
      mockAuth.getCurrentUser
        .mockResolvedValueOnce(TEST_USERS.user as any)
        .mockResolvedValueOnce({ ...TEST_USERS.user, role: "ADMIN" } as any)

      const first = await permissions.hasRole("ADMIN")
      const second = await permissions.hasRole("ADMIN")

      expect(first).toBe(false)
      expect(second).toBe(true)
      expect(mockAuth.getCurrentUser).toHaveBeenCalledTimes(2)
    })
  })

  describe("批量与 API 权限", () => {
    it("batchPermissionCheck 对未登录仅公开资源为 true", async () => {
      setCurrentUser(null)
      const result = await permissions.batchPermissionCheck(["/", "/admin"])
      expect(result["/"]).toBe(true)
      expect(result["/admin"]).toBe(false)
    })

    it("validateApiPermissions admin 成功返回用户", async () => {
      setCurrentUser(TEST_USERS.admin)
      const res = await permissions.validateApiPermissions(new Request("http://localhost/api"), "admin")
      expect(res.success).toBe(true)
      expect(res.user?.role).toBe("ADMIN")
    })

    it("validateApiPermissions auth 未登录返回错误", async () => {
      setCurrentUser(null)
      const res = await permissions.validateApiPermissions(new Request("http://localhost/api"), "auth")
      expect(res.success).toBe(false)
      expect(res.error?.statusCode).toBe(401)
    })
  })
})
