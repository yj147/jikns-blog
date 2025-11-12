/**
 * 守卫契约测试
 * 验证四种认证策略的类型映射和语义正确性
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { withApiAuth } from "@/lib/api/unified-auth"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import type { AuthContext, AuthPolicy } from "@/lib/auth/session"

// Mock session 模块
vi.mock("@/lib/auth/session", () => ({
  fetchAuthenticatedUser: vi.fn(),
  assertPolicy: vi.fn(),
  createAuthContext: vi.fn(),
  generateRequestId: vi.fn(() => "test-request-id"),
  authLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock response 模块
vi.mock("@/lib/api/unified-response", () => ({
  createErrorResponse: vi.fn(
    (code, message) =>
      new Response(JSON.stringify({ error: { code, message } }), {
        status: code === "UNAUTHORIZED" ? 401 : 403,
      })
  ),
  createJsonResponse: vi.fn((data) => new Response(JSON.stringify(data))),
  ErrorCode: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    BAD_REQUEST: "BAD_REQUEST",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}))

// Mock logger
vi.mock("@/lib/utils/logger", () => ({
  authLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { assertPolicy, createAuthContext } from "@/lib/auth/session"

describe("守卫契约测试 - Auth Policies Contract", () => {
  const mockRequest = new NextRequest("http://localhost:3000/api/test")

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("策略: public", () => {
    it("应该总是允许访问，用户为 null", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const mockCreateAuthContext = vi.mocked(createAuthContext)

      mockAssertPolicy.mockResolvedValue([null, null])
      mockCreateAuthContext.mockReturnValue({
        user: null,
        requestId: "test-request-id",
        ip: null,
        ua: null,
        path: "/api/test",
        timestamp: new Date(),
      })

      const result = await withApiAuth(
        mockRequest,
        "public",
        async (ctx: AuthContext<"public">) => {
          // 类型测试：ctx.user 应该是 null
          type _UserType = typeof ctx.user
          const _typeTest: _UserType = null

          expect(ctx.user).toBeNull()
          expect(ctx.requestId).toBe("test-request-id")
          return { success: true, public: true }
        }
      )

      expect(result).toEqual({ success: true, public: true })
      expect(mockAssertPolicy).toHaveBeenCalledWith("public", expect.any(Object))
    })
  })

  describe("策略: any", () => {
    it("应该允许任何人访问，用户可能存在或为 null", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const mockCreateAuthContext = vi.mocked(createAuthContext)

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: "USER" as const,
        status: "ACTIVE" as const,
        name: "Test User",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValue([mockUser, null])
      mockCreateAuthContext.mockReturnValue({
        user: mockUser,
        requestId: "test-request-id",
        ip: null,
        ua: null,
        path: "/api/test",
        timestamp: new Date(),
      })

      const result = await withApiAuth(mockRequest, "any", async (ctx: AuthContext<"any">) => {
        // 类型测试：ctx.user 可能是 AuthenticatedUser | null
        if (ctx.user) {
          expect(ctx.user.id).toBe("user-123")
        }
        return { success: true, hasUser: !!ctx.user }
      })

      expect(result).toEqual({ success: true, hasUser: true })
    })

    it("应该在用户不存在时也允许访问", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const mockCreateAuthContext = vi.mocked(createAuthContext)

      mockAssertPolicy.mockResolvedValue([null, null])
      mockCreateAuthContext.mockReturnValue({
        user: null,
        requestId: "test-request-id",
        ip: null,
        ua: null,
        path: "/api/test",
        timestamp: new Date(),
      })

      const result = await withApiAuth(mockRequest, "any", async (ctx: AuthContext<"any">) => {
        expect(ctx.user).toBeNull()
        return { success: true, hasUser: false }
      })

      expect(result).toEqual({ success: true, hasUser: false })
    })
  })

  describe("策略: user-active", () => {
    it("应该要求活跃用户，类型包含 status: ACTIVE", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const mockCreateAuthContext = vi.mocked(createAuthContext)

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: "USER" as const,
        status: "ACTIVE" as const,
        name: "Test User",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValue([mockUser, null])
      mockCreateAuthContext.mockReturnValue({
        user: mockUser,
        requestId: "test-request-id",
        ip: null,
        ua: null,
        path: "/api/test",
        timestamp: new Date(),
      })

      const result = await withApiAuth(
        mockRequest,
        "user-active",
        async (ctx: AuthContext<"user-active">) => {
          // 类型测试：ctx.user 必须有 status: 'ACTIVE'
          type _StatusType = typeof ctx.user.status
          const _typeTest: _StatusType = "ACTIVE"

          expect(ctx.user.status).toBe("ACTIVE")
          expect(ctx.user.id).toBe("user-123")
          return { success: true, userId: ctx.user.id }
        }
      )

      expect(result).toEqual({ success: true, userId: "user-123" })
    })

    it("应该拒绝未认证用户", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)

      mockAssertPolicy.mockResolvedValue([
        null,
        {
          name: "AuthError",
          message: "需要登录",
          code: "UNAUTHORIZED",
          statusCode: 401,
        },
      ])

      const result = await withApiAuth(mockRequest, "user-active", async () => {
        // 这个处理函数不应该被调用
        throw new Error("Handler should not be called")
      })

      // 验证返回了错误响应
      expect(createErrorResponse).toHaveBeenCalledWith(ErrorCode.UNAUTHORIZED, "需要登录", {
        requestId: "test-request-id",
      })
    })

    it("应该拒绝被封禁用户", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)

      mockAssertPolicy.mockResolvedValue([
        null,
        {
          name: "AuthError",
          message: "用户已被封禁",
          code: "FORBIDDEN",
          statusCode: 403,
        },
      ])

      const result = await withApiAuth(mockRequest, "user-active", async () => {
        throw new Error("Handler should not be called")
      })

      expect(createErrorResponse).toHaveBeenCalledWith(ErrorCode.FORBIDDEN, "用户已被封禁", {
        requestId: "test-request-id",
      })
    })
  })

  describe("策略: admin", () => {
    it("应该要求管理员，类型包含 role: ADMIN 和 status: ACTIVE", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const mockCreateAuthContext = vi.mocked(createAuthContext)

      const mockAdmin = {
        id: "admin-123",
        email: "admin@example.com",
        role: "ADMIN" as const,
        status: "ACTIVE" as const,
        name: "Admin User",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValue([mockAdmin, null])
      mockCreateAuthContext.mockReturnValue({
        user: mockAdmin,
        requestId: "test-request-id",
        ip: null,
        ua: null,
        path: "/api/test",
        timestamp: new Date(),
      })

      const result = await withApiAuth(mockRequest, "admin", async (ctx: AuthContext<"admin">) => {
        // 类型测试：ctx.user 必须有 role: 'ADMIN' 和 status: 'ACTIVE'
        type _RoleType = typeof ctx.user.role
        type _StatusType = typeof ctx.user.status
        const _roleTest: _RoleType = "ADMIN"
        const _statusTest: _StatusType = "ACTIVE"

        expect(ctx.user.role).toBe("ADMIN")
        expect(ctx.user.status).toBe("ACTIVE")
        return { success: true, adminId: ctx.user.id }
      })

      expect(result).toEqual({ success: true, adminId: "admin-123" })
    })

    it("应该拒绝普通用户", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)

      mockAssertPolicy.mockResolvedValue([
        null,
        {
          name: "AuthError",
          message: "需要管理员权限",
          code: "FORBIDDEN",
          statusCode: 403,
        },
      ])

      const result = await withApiAuth(mockRequest, "admin", async () => {
        throw new Error("Handler should not be called")
      })

      expect(createErrorResponse).toHaveBeenCalledWith(ErrorCode.FORBIDDEN, "需要管理员权限", {
        requestId: "test-request-id",
      })
    })
  })

  describe("类型收敛验证", () => {
    it("不同策略应该返回正确的类型", () => {
      // 这些是编译时类型测试，如果类型不正确会编译失败

      // public 策略
      const publicHandler = async (ctx: AuthContext<"public">) => {
        const user: null = ctx.user
        return user
      }

      // any 策略
      const anyHandler = async (ctx: AuthContext<"any">) => {
        if (ctx.user) {
          const id: string = ctx.user.id
          return id
        }
        return null
      }

      // user-active 策略
      const userActiveHandler = async (ctx: AuthContext<"user-active">) => {
        const status: "ACTIVE" = ctx.user.status
        return status
      }

      // admin 策略
      const adminHandler = async (ctx: AuthContext<"admin">) => {
        const role: "ADMIN" = ctx.user.role
        const status: "ACTIVE" = ctx.user.status
        return { role, status }
      }

      // 验证处理函数类型正确
      expect(typeof publicHandler).toBe("function")
      expect(typeof anyHandler).toBe("function")
      expect(typeof userActiveHandler).toBe("function")
      expect(typeof adminHandler).toBe("function")
    })
  })

  describe("审计日志验证", () => {
    it("应该为非 public 策略记录成功认证", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const mockCreateAuthContext = vi.mocked(createAuthContext)
      const { authLogger } = await import("@/lib/utils/logger")

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: "USER" as const,
        status: "ACTIVE" as const,
        name: "Test User",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValue([mockUser, null])
      mockCreateAuthContext.mockReturnValue({
        user: mockUser,
        requestId: "test-request-id",
        ip: "127.0.0.1",
        ua: "Test Browser",
        path: "/api/test",
        timestamp: new Date(),
      })

      await withApiAuth(mockRequest, "user-active", async () => ({ success: true }))

      expect(authLogger.info).toHaveBeenCalledWith(
        "认证成功 - user-active 策略",
        expect.objectContaining({
          requestId: "test-request-id",
          userId: "user-123",
          path: "/api/test",
        })
      )
    })

    it("应该为失败认证记录警告", async () => {
      const mockAssertPolicy = vi.mocked(assertPolicy)
      const { authLogger } = await import("@/lib/utils/logger")

      mockAssertPolicy.mockResolvedValue([
        null,
        {
          name: "AuthError",
          message: "认证失败",
          code: "UNAUTHORIZED",
          statusCode: 401,
        },
      ])

      await withApiAuth(mockRequest, "admin", async () => ({ success: true }))

      expect(authLogger.warn).toHaveBeenCalledWith(
        "认证失败 - admin 策略",
        expect.objectContaining({
          requestId: "test-request-id",
          code: "UNAUTHORIZED",
          message: "认证失败",
        })
      )
    })
  })
})
