/**
 * 认证会话日志字段完整性测试
 * 验证所有日志调用包含基础四字段：{requestId, path, ip, userId}
 */

import { describe, test, expect, vi, beforeEach } from "vitest"
import { authLogger } from "@/lib/utils/logger"
import { buildSessionLogContext } from "@/lib/utils/auth-logging"

const reactModule = vi.hoisted(() => ({ __esModule: true, cache: (fn: any) => fn }))
const nextCacheModule = vi.hoisted(() => ({
  __esModule: true,
  unstable_cache: (fn: any) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock("@/lib/prisma", async () => {
  const { mockPrisma } = await import("../__mocks__/prisma")
  return { __esModule: true, prisma: mockPrisma }
})
vi.mock("@/lib/supabase", async () => {
  const supabase = await import("../__mocks__/supabase")
  return { __esModule: true, ...supabase }
})
vi.mock("react", () => reactModule)
vi.mock("next/cache", () => nextCacheModule)

describe("认证会话日志字段基线测试", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe("buildSessionLogContext", () => {
    test("应该返回完整的四字段上下文", () => {
      const context = buildSessionLogContext("user-123", {
        requestId: "req-123",
        path: "/api/test",
        ip: "192.168.1.1",
      })

      expect(context).toEqual({
        requestId: "req-123",
        path: "/api/test",
        ip: "192.168.1.1",
        userId: "user-123",
      })
    })

    test("缺少额外参数时应使用默认值", () => {
      const context = buildSessionLogContext("user-456")

      expect(context).toEqual({
        requestId: "session-internal",
        path: "internal-function",
        ip: "unknown",
        userId: "user-456",
      })
    })

    test("没有任何参数时应返回基础默认值", () => {
      const context = buildSessionLogContext()

      expect(context).toEqual({
        requestId: "session-internal",
        path: "internal-function",
        ip: "unknown",
        userId: undefined,
      })
    })
  })

  describe("Session.ts 日志调用验证", () => {
    test("fetchSupabaseUser 错误日志应包含完整上下文", async () => {
      const { createServerSupabaseClient } = await import("@/lib/supabase")
      ;(createServerSupabaseClient as any).mockResolvedValue({
        auth: {
          getUser: () => ({
            error: { message: "测试错误" },
            data: { user: null },
          }),
        },
      })

      // 动态导入以避免循环依赖
      const sessionModule = await import("@/lib/auth/session")
      await sessionModule.fetchAuthenticatedUser()

      // 验证错误日志包含必要字段
      expect(authLogger.error).toHaveBeenCalledWith(
        "获取Supabase用户失败",
        expect.objectContaining({
          requestId: expect.any(String),
          path: expect.any(String),
          ip: expect.any(String),
          error: "测试错误",
        })
      )
    })

    test("fetchUserFromDatabase 错误日志应包含userId", async () => {
      const { prisma } = await import("@/lib/prisma")
      const { createServerSupabaseClient } = await import("@/lib/supabase")

      // Mock Supabase 返回有效用户
      ;(createServerSupabaseClient as any).mockResolvedValue({
        auth: {
          getUser: () => ({
            data: {
              user: {
                id: "test-user-123",
                email: "test@example.com",
              },
            },
            error: null,
          }),
        },
      })

      // Mock prisma.user.findUnique 抛出错误
      ;(prisma.user.findUnique as any).mockRejectedValue(new Error("数据库连接失败"))

      // 调用 fetchAuthenticatedUser 来间接触发 fetchUserFromDatabase 错误
      const sessionModule = await import("@/lib/auth/session")
      await sessionModule.fetchAuthenticatedUser()

      // 验证错误日志被调用，并包含完整的四字段上下文
      expect(authLogger.error).toHaveBeenCalledWith(
        "数据库用户查询失败",
        expect.objectContaining({
          requestId: expect.any(String),
          path: expect.any(String),
          ip: expect.any(String),
          userId: "test-user-123", // 这是关键验证点
          error: expect.any(Error),
        })
      )

      // 验证错误对象包含正确的错误信息
      const errorCall = (authLogger.error as any).mock.calls.find(
        (call: any[]) => call[0] === "数据库用户查询失败"
      )
      expect(errorCall[1].error.message).toBe("数据库连接失败")
    })

    test("syncUserFromAuth 成功日志应包含完整上下文", async () => {
      const { prisma } = await import("@/lib/prisma")
      const mockUser = {
        id: "user-789",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }

      ;(prisma.user.upsert as any).mockResolvedValue(mockUser)

      const sessionModule = await import("@/lib/auth/session")
      await sessionModule.syncUserFromAuth({
        id: "user-789",
        email: "test@example.com",
        user_metadata: {
          full_name: "Test User",
        },
      })

      // 验证成功日志包含完整上下文
      expect(authLogger.info).toHaveBeenCalledWith(
        "用户资料同步成功",
        expect.objectContaining({
          requestId: expect.any(String),
          path: expect.any(String),
          ip: expect.any(String),
          userId: "user-789",
          email: "test@example.com",
        })
      )
    })

    test("clearUserCache 日志应包含userId", async () => {
      const sessionModule = await import("@/lib/auth/session")
      await sessionModule.clearUserCache("user-999")

      // 验证缓存清理日志
      expect(authLogger.info).toHaveBeenCalledWith(
        "清除用户缓存",
        expect.objectContaining({
          requestId: expect.any(String),
          path: expect.any(String),
          ip: expect.any(String),
          userId: "user-999",
        })
      )
    })
  })
})
