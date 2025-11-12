import { describe, it, expect, vi, beforeEach } from "vitest"
import { withAuth, withAdminAuth, batchPermissionCheck } from "@/lib/permissions"
import type { AuthenticatedUser } from "@/lib/auth/session"

vi.mock("@/lib/auth/session", () => ({
  fetchAuthenticatedUser: vi.fn(),
}))

import { fetchAuthenticatedUser } from "@/lib/auth/session"

const mockedFetchAuthenticatedUser = vi.mocked(fetchAuthenticatedUser)

const activeUser: AuthenticatedUser = {
  id: "user-123",
  email: "user@example.com",
  role: "USER",
  status: "ACTIVE",
  name: "Test User",
  avatarUrl: null,
}

const adminUser: AuthenticatedUser = {
  ...activeUser,
  id: "admin-001",
  role: "ADMIN",
}

const bannedUser: AuthenticatedUser = {
  ...activeUser,
  status: "BANNED",
}

describe("权限装饰器", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("withAuth", () => {
    it("应在用户已认证时执行原始操作并传递参数", async () => {
      mockedFetchAuthenticatedUser.mockResolvedValueOnce(activeUser)
      const baseAction = vi.fn(async (payload: { id: string }) => ({
        ok: true,
        id: payload.id,
      }))

      const guarded = withAuth(baseAction)
      const result = await guarded({ id: "payload-1" })

      expect(baseAction).toHaveBeenCalledWith({ id: "payload-1" })
      expect(result).toEqual({ ok: true, id: "payload-1" })
    })

    it("应在未登录时抛出认证错误", async () => {
      mockedFetchAuthenticatedUser.mockResolvedValueOnce(null)
      const guarded = withAuth(async () => true)

      await expect(guarded()).rejects.toThrow("用户未登录")
    })

    it("应在用户被封禁时抛出权限错误", async () => {
      mockedFetchAuthenticatedUser.mockResolvedValueOnce(bannedUser)
      const guarded = withAuth(async () => true)

      await expect(guarded()).rejects.toThrow("账户已被封禁")
    })
  })

  describe("withAdminAuth", () => {
    it("应允许管理员执行操作", async () => {
      mockedFetchAuthenticatedUser.mockResolvedValueOnce(adminUser)
      const adminAction = vi.fn(async () => "ok")

      const guarded = withAdminAuth(adminAction)
      const result = await guarded()

      expect(adminAction).toHaveBeenCalledTimes(1)
      expect(result).toBe("ok")
    })

    it("应拒绝非管理员用户", async () => {
      mockedFetchAuthenticatedUser.mockResolvedValueOnce(activeUser)
      const guarded = withAdminAuth(async () => "never")

      await expect(guarded()).rejects.toThrow("需要管理员权限")
    })
  })
})

describe("batchPermissionCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("应根据用户状态返回正确的资源访问结果（未登录用户）", async () => {
    mockedFetchAuthenticatedUser.mockResolvedValueOnce(null)

    const resources = ["/", "/admin", "/profile"]
    const result = await batchPermissionCheck(resources)

    expect(result["/"]).toBe(true) // 公共资源
    expect(result["/profile"]).toBe(false)
    expect(result["/admin"]).toBe(false)
  })

  it("应根据用户状态返回正确的资源访问结果（普通活跃用户）", async () => {
    mockedFetchAuthenticatedUser.mockResolvedValueOnce(activeUser)

    const resources = ["/blog", "/admin/users", "/profile/settings"]
    const result = await batchPermissionCheck(resources)

    expect(result["/blog"]).toBe(true)
    expect(result["/profile/settings"]).toBe(true)
    expect(result["/admin/users"]).toBe(false)
  })

  it("应允许管理员访问所有资源", async () => {
    mockedFetchAuthenticatedUser.mockResolvedValueOnce(adminUser)

    const resources = ["/", "/admin/dashboard", "/api/admin/users"]
    const result = await batchPermissionCheck(resources)

    expect(Object.values(result)).toEqual([true, true, true])
  })
})
