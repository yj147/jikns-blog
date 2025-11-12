/**
 * Route Guard 会话刷新测试
 * 验证 route-guard.ts 能正确处理 Supabase 会话刷新
 */

import { NextRequest } from "next/server"
import { getUserOrNull, requireAuth, requireAdmin } from "@/lib/auth/route-guard"
import { cookies } from "next/headers"
import { vi } from "vitest"

// Mock Supabase
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((url, key, options) => {
    const mockCookies = options.cookies

    return {
      auth: {
        getUser: vi.fn(async () => {
          const sessionCookie = mockCookies.get("sb-auth-token")

          // 模拟会话刷新场景：
          // 1. 如果有旧 session，触发刷新
          if (sessionCookie === "old-session-token") {
            // 模拟 Supabase 刷新会话
            mockCookies.set("sb-auth-token", "new-session-token", {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              maxAge: 604800, // 7 days
              path: "/",
            })

            return {
              data: {
                user: {
                  id: "test-user-id",
                  email: "test@example.com",
                },
              },
              error: null,
            }
          }

          // 2. 如果有新 session，正常返回用户
          if (sessionCookie === "new-session-token") {
            return {
              data: {
                user: {
                  id: "test-user-id",
                  email: "test@example.com",
                },
              },
              error: null,
            }
          }

          // 3. 没有 session
          return {
            data: { user: null },
            error: null,
          }
        }),
      },
    }
  }),
}))

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id === "test-user-id") {
          return {
            id: "test-user-id",
            email: "test@example.com",
            role: "USER",
            status: "ACTIVE",
          }
        }
        if (where.id === "admin-user-id") {
          return {
            id: "admin-user-id",
            email: "admin@example.com",
            role: "ADMIN",
            status: "ACTIVE",
          }
        }
        return null
      }),
    },
  },
}))

// Mock next/headers
const mockCookieStore = new Map<string, any>()

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockCookieStore.get(name),
    set: (name: string, value: string, options?: any) => {
      mockCookieStore.set(name, { value, ...options })
    },
    delete: (name: string) => {
      mockCookieStore.delete(name)
    },
  })),
}))

describe("Route Guard Session Refresh Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieStore.clear()
  })

  describe("getUserOrNull", () => {
    it("应该在会话过期时触发刷新并更新 cookie", async () => {
      // 设置旧的会话 cookie
      mockCookieStore.set("sb-auth-token", { value: "old-session-token" })

      // 创建模拟请求
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          cookie: "sb-auth-token=old-session-token",
        },
      })

      // 调用 getUserOrNull
      const user = await getUserOrNull(request)

      // 验证用户信息返回正确
      expect(user).toEqual({
        id: "test-user-id",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
      })

      // 验证 cookie 被更新
      const updatedCookie = mockCookieStore.get("sb-auth-token")
      expect(updatedCookie.value).toBe("new-session-token")
      expect(updatedCookie.httpOnly).toBe(true)
      expect(updatedCookie.secure).toBe(true)
    })

    it("应该在没有会话时返回 null", async () => {
      // 创建没有 cookie 的请求
      const request = new NextRequest("http://localhost:3000/api/test")

      const user = await getUserOrNull(request)

      expect(user).toBeNull()
    })
  })

  describe("requireAuth", () => {
    it("应该在会话刷新后返回用户信息", async () => {
      // 设置旧的会话 cookie
      mockCookieStore.set("sb-auth-token", { value: "old-session-token" })

      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          cookie: "sb-auth-token=old-session-token",
        },
      })

      const result = await requireAuth(request)

      // 不应该返回错误响应
      expect(result).not.toBeInstanceOf(Response)

      // 应该返回用户信息
      expect(result).toEqual({
        id: "test-user-id",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
      })
    })

    it("应该在无会话时返回 401 错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/test")

      const result = await requireAuth(request)

      // 应该返回错误响应
      expect(result).toBeInstanceOf(Response)

      if (result instanceof Response) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.code).toBe("UNAUTHORIZED")
      }
    })
  })

  describe("边缘场景", () => {
    it("应该处理 cookie 设置失败的情况", async () => {
      // 模拟 cookie 设置失败
      const originalSet = mockCookieStore.set
      mockCookieStore.set = vi.fn(() => {
        throw new Error("Cannot set cookie")
      })

      // 设置旧会话
      mockCookieStore.set("sb-auth-token", { value: "old-session-token" })
      mockCookieStore.set = originalSet // 恢复 set 方法以便读取

      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          cookie: "sb-auth-token=old-session-token",
        },
      })

      // 不应该抛出错误，应该优雅地处理
      const user = await getUserOrNull(request)

      // 即使 cookie 设置失败，仍应返回用户信息
      expect(user).toBeTruthy()
    })

    it("应该处理并发会话刷新", async () => {
      // 设置旧会话
      mockCookieStore.set("sb-auth-token", { value: "old-session-token" })

      const request1 = new NextRequest("http://localhost:3000/api/test1", {
        headers: { cookie: "sb-auth-token=old-session-token" },
      })
      const request2 = new NextRequest("http://localhost:3000/api/test2", {
        headers: { cookie: "sb-auth-token=old-session-token" },
      })

      // 并发请求
      const [user1, user2] = await Promise.all([getUserOrNull(request1), getUserOrNull(request2)])

      // 两个请求都应该成功
      expect(user1).toBeTruthy()
      expect(user2).toBeTruthy()

      // cookie 应该被正确更新
      expect(mockCookieStore.get("sb-auth-token").value).toBe("new-session-token")
    })
  })
})
