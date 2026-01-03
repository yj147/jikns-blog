/**
 * 收藏 API 路由测试
 * 验证收藏功能的查询、切换和列表接口
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/bookmarks/route"
import * as interactions from "@/lib/interactions"
import { InteractionTargetNotFoundError } from "@/lib/interactions/errors"
import * as authSession from "@/lib/auth/session"
import * as auditLog from "@/lib/audit-log"
import { ErrorCode } from "@/lib/api/unified-response"
import { RateLimiter } from "@/lib/security"
import { AuthError } from "@/lib/error-handling/auth-error"

// Mock 依赖
vi.mock("@/lib/interactions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/interactions")>("@/lib/interactions")
  return {
    ...actual,
    toggleBookmark: vi.fn(),
    getBookmarkStatus: vi.fn(),
    getUserBookmarks: vi.fn(),
  }
})
vi.mock("@/lib/auth/session", () => ({
  fetchAuthenticatedUser: vi.fn(),
  getOptionalViewer: vi.fn(),
  assertPolicy: vi.fn(),
  generateRequestId: vi.fn(() => "test-request-id"),
}))
vi.mock("@/lib/audit-log", () => ({
  auditLogger: {
    logEvent: vi.fn().mockResolvedValue(undefined),
    logEventAsync: vi.fn(),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "test-agent"),
}))

const mockedInteractions = vi.mocked(interactions)
const mockedSession = vi.mocked(authSession)
const mockedAudit = vi.mocked(auditLog)

describe("Bookmarks API Route", () => {
  // 定义测试用户
  const mockUser = {
    id: "user-1",
    email: "user@example.com",
    role: "USER",
    status: "ACTIVE",
    name: "Test User",
    avatarUrl: null,
  }

  const mockAdminUser = {
    ...mockUser,
    id: "admin-1",
    role: "ADMIN",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedSession.getOptionalViewer.mockResolvedValue(null)
    mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
    mockedSession.generateRequestId.mockReturnValue("test-request-id")
  })

  afterEach(() => {
    RateLimiter.resetAllRateLimits?.()
  })

  describe("GET /api/bookmarks?action=status", () => {
    it("应该为匿名用户返回收藏状态", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/bookmarks?action=status&postId=post-1"
      )

      mockedSession.getOptionalViewer.mockResolvedValue(null)
      mockedInteractions.getBookmarkStatus.mockResolvedValue({
        isBookmarked: false,
        count: 5,
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        isBookmarked: false,
        count: 5,
      })
      expect(mockedInteractions.getBookmarkStatus).toHaveBeenCalledWith("post-1", undefined)
    })

    it("应该为登录用户返回实际收藏状态", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/bookmarks?action=status&postId=post-1"
      )

      mockedSession.getOptionalViewer.mockResolvedValue(mockUser as any)
      mockedInteractions.getBookmarkStatus.mockResolvedValue({
        isBookmarked: true,
        count: 5,
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        isBookmarked: true,
        count: 5,
      })
      expect(mockedInteractions.getBookmarkStatus).toHaveBeenCalledWith("post-1", "user-1")
      expect(mockedAudit.auditLogger.logEventAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "BOOKMARK_STATUS",
          resource: "post:post-1",
          success: true,
          userId: "user-1",
        })
      )
    })

    it("缺少postId参数应该返回400错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks?action=status")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(data.error.message).toContain("缺少 postId")
    })
  })

  describe("GET /api/bookmarks?action=list", () => {
    it("userId=me 应该返回当前用户的收藏列表", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/bookmarks?action=list&userId=me&limit=10"
      )

      // Mock 认证通过
      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
      mockedInteractions.getUserBookmarks.mockResolvedValue({
        items: [
          {
            id: "bookmark-1",
            createdAt: "2024-01-01T00:00:00Z",
            post: {
              id: "post-1",
              slug: "test-post",
              title: "Test Post",
              coverImage: null,
              author: {
                id: "author-1",
                name: "Author",
                avatarUrl: null,
              },
            },
          },
        ],
        hasMore: false,
        nextCursor: undefined,
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      // 游标分页不再强制包含 page 字段
      expect(data.meta.pagination).toEqual({
        limit: 10,
        total: -1,
        hasMore: false,
        nextCursor: undefined,
      })
      expect(mockedInteractions.getUserBookmarks).toHaveBeenCalledWith("user-1", {
        cursor: undefined,
        limit: 10,
      })
    })

    it("未登录用户应该返回401错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks?action=list&userId=me")

      mockedSession.assertPolicy.mockResolvedValue([
        null,
        new AuthError("请先登录", "UNAUTHORIZED", 401),
      ])

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("普通用户访问其他用户的收藏列表应该返回403", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/bookmarks?action=list&userId=other-user"
      )

      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.FORBIDDEN)
      expect(data.error.message).toContain("无权查看其他用户")
    })

    it("管理员可以访问其他用户的收藏列表", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/bookmarks?action=list&userId=other-user"
      )

      mockedSession.assertPolicy.mockResolvedValue([mockAdminUser as any, null])
      mockedInteractions.getUserBookmarks.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: undefined,
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockedInteractions.getUserBookmarks).toHaveBeenCalledWith("other-user", {
        cursor: undefined,
        limit: 10,
      })
    })

    it("支持分页参数", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/bookmarks?action=list&userId=me&limit=20&cursor=cursor-123"
      )

      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
      mockedInteractions.getUserBookmarks.mockResolvedValue({
        items: [],
        hasMore: true,
        nextCursor: "next-cursor",
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.pagination.limit).toBe(20)
      expect(data.meta.pagination.hasMore).toBe(true)
      expect(data.meta.pagination.nextCursor).toBe("next-cursor")
      expect(mockedInteractions.getUserBookmarks).toHaveBeenCalledWith("user-1", {
        cursor: "cursor-123",
        limit: 20,
      })
    })

    it("缺少userId参数应该返回400错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks?action=list")

      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(data.error.message).toContain("缺少 userId")
    })
  })

  describe("POST /api/bookmarks", () => {
    it("应该成功切换收藏状态", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ postId: "post-1" }),
        headers: { "Content-Type": "application/json" },
      })

      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
      mockedInteractions.toggleBookmark.mockResolvedValue({
        isBookmarked: true,
        count: 6,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        isBookmarked: true,
        count: 6,
      })
      // 传递 requestId（第3参为 userId，第4参为 requestId）
      expect(mockedInteractions.toggleBookmark).toHaveBeenCalledWith(
        "post-1",
        "user-1",
        "test-request-id"
      )
      expect(mockedAudit.auditLogger.logEventAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "BOOKMARK_TOGGLE",
          resource: "post:post-1",
          success: true,
          userId: "user-1",
          details: expect.objectContaining({ action: "bookmark", newCount: 6 }),
        })
      )
    })

    it("未登录用户应该返回401错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ postId: "post-1" }),
        headers: { "Content-Type": "application/json" },
      })

      mockedSession.assertPolicy.mockResolvedValue([
        null,
        new AuthError("请先登录", "UNAUTHORIZED", 401),
      ])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.UNAUTHORIZED)
    })

    it("文章不存在应该返回404错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ postId: "non-existent" }),
        headers: { "Content-Type": "application/json" },
      })

      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
      mockedInteractions.toggleBookmark.mockRejectedValue(
        new InteractionTargetNotFoundError("post", "non-existent")
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.NOT_FOUND)
      expect(data.error.message).toContain("目标不存在")
    })

    it("缺少postId参数应该返回400错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      })

      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(data.error.message).toContain("缺少 postId")
    })

    it("超过速率限制应该返回429错误", async () => {
      mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])

      // 启用限流，用户阈值 1
      const prev = {
        enabled: process.env.BOOKMARKS_RATE_LIMIT_ENABLED,
        window: process.env.BOOKMARKS_RATE_LIMIT_WINDOW_MS,
        perUser: process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_USER,
        perIP: process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_IP,
      }
      process.env.BOOKMARKS_RATE_LIMIT_ENABLED = "true"
      process.env.BOOKMARKS_RATE_LIMIT_WINDOW_MS = "60000"
      process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_USER = "1"
      process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_IP = "9999"

      // 第一次通过
      mockedInteractions.toggleBookmark.mockResolvedValue({ isBookmarked: true, count: 1 })
      const req1 = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ postId: "post-rl-1" }),
        headers: { "Content-Type": "application/json" },
      })
      const res1 = await POST(req1)
      expect(res1.status).toBe(200)

      // 第二次命中限流
      const req2 = new NextRequest("http://localhost:3000/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({ postId: "post-rl-1" }),
        headers: { "Content-Type": "application/json" },
      })
      const res2 = await POST(req2)
      const data2 = await res2.json()
      expect(res2.status).toBe(429)
      expect(data2.success).toBe(false)
      expect(data2.error.code).toBe("RATE_LIMIT_EXCEEDED")

      // 恢复环境
      process.env.BOOKMARKS_RATE_LIMIT_ENABLED = prev.enabled
      process.env.BOOKMARKS_RATE_LIMIT_WINDOW_MS = prev.window
      process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_USER = prev.perUser
      process.env.BOOKMARKS_RATE_LIMIT_TOGGLE_IP = prev.perIP
    })
  })

  describe("GET /api/bookmarks - 无效action", () => {
    it("无效的action参数应该返回400错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks?action=invalid")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(data.error.message).toContain("无效的 action")
    })

    it("缺少action参数应该返回400错误", async () => {
      const request = new NextRequest("http://localhost:3000/api/bookmarks")

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    })
  })
})
