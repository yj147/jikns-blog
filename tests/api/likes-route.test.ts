/**
 * 点赞 API 路由测试
 * 测试 /api/likes 端点的所有功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/likes/route"
import * as interactionsLib from "@/lib/interactions"
import { InteractionTargetNotFoundError } from "@/lib/interactions/errors"
import * as authSession from "@/lib/auth/session"
import * as auditLog from "@/lib/audit-log"
import { RateLimiter } from "@/lib/security"
import { AuthError } from "@/lib/error-handling/auth-error"
import { API_ERROR_MESSAGES } from "@/lib/api/error-messages"

// Mock 依赖
vi.mock("@/lib/interactions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/interactions")>("@/lib/interactions")
  return {
    ...actual,
    toggleLike: vi.fn(),
    getLikeStatus: vi.fn(),
    getLikeUsers: vi.fn(),
  }
})
vi.mock("@/lib/auth/session", () => ({
  fetchAuthenticatedUser: vi.fn(),
  getOptionalViewer: vi.fn(),
  assertPolicy: vi.fn(),
  generateRequestId: vi.fn(() => "test-request-id"),
}))
vi.mock("@/lib/audit-log")

describe("点赞 API 路由测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock auditLogger
    vi.mocked(auditLog.auditLogger.logEvent).mockResolvedValue(undefined)
    vi.mocked(auditLog.getClientIP).mockReturnValue("127.0.0.1")
    vi.mocked(auditLog.getClientUserAgent).mockReturnValue("test-agent")

    // 默认 mock getUserOrNull 返回 null（未登录）
    vi.mocked(authSession.getOptionalViewer).mockResolvedValue(null)
    vi.mocked(authSession.assertPolicy).mockResolvedValue([
      { id: "user-1", email: "test@example.com" } as any,
      null,
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // 重置速率限制记录，避免测试相互污染
    RateLimiter.resetAllRateLimits?.()
  })

  describe("GET /api/likes - 获取点赞状态", () => {
    it("应该返回点赞状态（匿名用户）", async () => {
      const mockStatus = { isLiked: false, count: 5 }
      vi.mocked(authSession.getOptionalViewer).mockResolvedValue(null)
      vi.mocked(interactionsLib.getLikeStatus).mockResolvedValue(mockStatus)

      const request = new NextRequest(
        "http://localhost:3000/api/likes?targetType=post&targetId=123&action=status"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockStatus)
      expect(interactionsLib.getLikeStatus).toHaveBeenCalledWith("post", "123", undefined)
      expect(auditLog.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LIKE_STATUS",
          resource: "post:123",
          success: true,
        })
      )
    })

    it("应该返回点赞状态（登录用户）", async () => {
      const mockUser = { id: "user-1", email: "test@example.com" }
      const mockStatus = { isLiked: true, count: 10 }
      vi.mocked(authSession.getOptionalViewer).mockResolvedValue(mockUser as any)
      vi.mocked(interactionsLib.getLikeStatus).mockResolvedValue(mockStatus)

      const request = new NextRequest(
        "http://localhost:3000/api/likes?targetType=activity&targetId=456&action=status"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockStatus)
      expect(interactionsLib.getLikeStatus).toHaveBeenCalledWith("activity", "456", "user-1")
      expect(auditLog.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LIKE_STATUS",
          resource: "activity:456",
          userId: "user-1",
          details: expect.objectContaining({
            isLiked: true,
            count: 10,
            hasUser: true,
          }),
        })
      )
    })

    it("应该返回错误：缺少 targetType", async () => {
      const request = new NextRequest("http://localhost:3000/api/likes?targetId=123")
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain(API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    })

    it("应该返回错误：无效的 targetType", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/likes?targetType=invalid&targetId=123"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain(API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    })

    it("应该返回错误：缺少 targetId", async () => {
      const request = new NextRequest("http://localhost:3000/api/likes?targetType=post")
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain(API_ERROR_MESSAGES.MISSING_TARGET_ID)
    })
  })

  describe("GET /api/likes - 获取点赞用户列表", () => {
    it("应该返回点赞用户列表（带分页）", async () => {
      const mockUsers = [
        { id: "user-1", name: "User 1", avatarUrl: null },
        { id: "user-2", name: "User 2", avatarUrl: null },
      ]
      const mockResult = {
        users: mockUsers,
        hasMore: true,
        nextCursor: "next-cursor",
      }
      vi.mocked(interactionsLib.getLikeUsers).mockResolvedValue(mockResult)

      const request = new NextRequest(
        "http://localhost:3000/api/likes?targetType=post&targetId=123&action=users&limit=10&cursor=cursor-1"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockUsers)
      // 游标分页不再强制包含 page 字段
      expect(data.meta.pagination).toEqual({
        limit: 10,
        total: -1,
        hasMore: true,
        nextCursor: "next-cursor",
      })
      expect(interactionsLib.getLikeUsers).toHaveBeenCalledWith("post", "123", 10, "cursor-1")
      expect(auditLog.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LIKE_USERS",
          resource: "post:123",
          details: expect.objectContaining({
            resultCount: 2,
            hasMore: true,
          }),
        })
      )
    })

    it("应该使用默认分页参数", async () => {
      const mockResult = {
        users: [],
        hasMore: false,
      }
      vi.mocked(interactionsLib.getLikeUsers).mockResolvedValue(mockResult)

      const request = new NextRequest(
        "http://localhost:3000/api/likes?targetType=post&targetId=123&action=users"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(interactionsLib.getLikeUsers).toHaveBeenCalledWith("post", "123", 10, undefined)
    })

    it("应该返回错误：缺少参数", async () => {
      const request = new NextRequest("http://localhost:3000/api/likes?action=users")
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("GET /api/likes - 无效 action", () => {
    it("应该返回错误：无效的 action", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/likes?targetType=post&targetId=123&action=invalid"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain(API_ERROR_MESSAGES.INVALID_ACTION)
    })
  })

  describe("POST /api/likes - 切换点赞状态", () => {
    it("应该成功切换点赞状态（已登录用户）", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", role: "USER", status: "ACTIVE" }
      const mockStatus = { isLiked: true, count: 6 }

      vi.mocked(authSession.assertPolicy).mockResolvedValue([mockUser as any, null])
      vi.mocked(interactionsLib.toggleLike).mockResolvedValue(mockStatus)

      const request = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: "123" }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockStatus)
      // 路由向服务层传递 requestId（第4参）
      expect(interactionsLib.toggleLike).toHaveBeenCalledWith(
        "post",
        "123",
        "user-1",
        "test-request-id"
      )
      expect(auditLog.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LIKE_TOGGLE",
          resource: "post:123",
          userId: "user-1",
          details: expect.objectContaining({
            operation: "liked",
          }),
        })
      )
    })

    it("应该返回错误：未登录", async () => {
      vi.mocked(authSession.assertPolicy).mockResolvedValue([
        null,
        new AuthError("请先登录", "UNAUTHORIZED", 401),
      ])

      const request = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: "123" }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNAUTHORIZED")
      expect(data.error.message).toContain("请先登录")
    })

    it("应该返回错误：目标不存在", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", role: "USER", status: "ACTIVE" }

      vi.mocked(authSession.assertPolicy).mockResolvedValue([mockUser as any, null])
      vi.mocked(interactionsLib.toggleLike).mockRejectedValue(
        new InteractionTargetNotFoundError("post", "non-existent")
      )

      const request = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: "non-existent" }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("NOT_FOUND")
      expect(data.error.message).toContain("目标不存在")
    })

    it("应该返回错误：缺少必填字段", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", role: "USER", status: "ACTIVE" }

      vi.mocked(authSession.assertPolicy).mockResolvedValue([mockUser as any, null])

      const request = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "post" }), // 缺少 targetId
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain("Missing required fields")
      expect(data.error.message).toContain("targetId")
    })

    it("应该返回错误：无效的 targetType", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", role: "USER", status: "ACTIVE" }

      vi.mocked(authSession.assertPolicy).mockResolvedValue([mockUser as any, null])

      const request = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "invalid", targetId: "123" }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
      expect(data.error.message).toContain(API_ERROR_MESSAGES.INVALID_TARGET_TYPE)
    })

    it("应该成功取消点赞", async () => {
      const mockUser = { id: "user-1", email: "test@example.com", role: "USER", status: "ACTIVE" }
      const mockStatus = { isLiked: false, count: 5 }

      vi.mocked(authSession.assertPolicy).mockResolvedValue([mockUser as any, null])
      vi.mocked(interactionsLib.toggleLike).mockResolvedValue(mockStatus)

      const request = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "activity", targetId: "456" }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockStatus)
      expect(interactionsLib.toggleLike).toHaveBeenCalledWith(
        "activity",
        "456",
        "user-1",
        "test-request-id"
      )
      expect(auditLog.auditLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LIKE_TOGGLE",
          resource: "activity:456",
          userId: "user-1",
          details: expect.objectContaining({
            operation: "unliked",
          }),
        })
      )
    })

    it("应该返回错误：超过速率限制", async () => {
      const mockUser = {
        id: "user-rl-1",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
      }

      vi.mocked(authSession.assertPolicy).mockResolvedValue([mockUser as any, null])

      // 启用限流并设置阈值为每窗口1次
      const prev = {
        enabled: process.env.LIKES_RATE_LIMIT_ENABLED,
        window: process.env.LIKES_RATE_LIMIT_WINDOW_MS,
        perUser: process.env.LIKES_RATE_LIMIT_TOGGLE_USER,
        perIP: process.env.LIKES_RATE_LIMIT_TOGGLE_IP,
      }
      process.env.LIKES_RATE_LIMIT_ENABLED = "true"
      process.env.LIKES_RATE_LIMIT_WINDOW_MS = "60000"
      process.env.LIKES_RATE_LIMIT_TOGGLE_USER = "1"
      process.env.LIKES_RATE_LIMIT_TOGGLE_IP = "9999"

      // 第一次请求通过
      vi.mocked(interactionsLib.toggleLike).mockResolvedValue({ isLiked: true, count: 1 } as any)
      const req1 = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: "post-rl-1" }),
      })
      const res1 = await POST(req1)
      const data1 = await res1.json()
      expect(res1.status).toBe(200)
      expect(data1.success).toBe(true)

      // 第二次命中限流
      const req2 = new NextRequest("http://localhost:3000/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetType: "post", targetId: "post-rl-1" }),
      })
      const res2 = await POST(req2)
      const data2 = await res2.json()
      expect(res2.status).toBe(429)
      expect(data2.success).toBe(false)
      expect(data2.error.code).toBe("RATE_LIMIT_EXCEEDED")

      // 恢复环境变量
      process.env.LIKES_RATE_LIMIT_ENABLED = prev.enabled
      process.env.LIKES_RATE_LIMIT_WINDOW_MS = prev.window
      process.env.LIKES_RATE_LIMIT_TOGGLE_USER = prev.perUser
      process.env.LIKES_RATE_LIMIT_TOGGLE_IP = prev.perIP
    })
  })
})
