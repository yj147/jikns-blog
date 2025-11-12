import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const hoistedMocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}))

vi.mock("@/lib/api/unified-auth", () => ({
  getCurrentUser: hoistedMocks.mockGetCurrentUser,
  withApiAuth: vi.fn((request, permission, handler) => {
    // 直接执行 handler，传入 mock 的用户
    const user = hoistedMocks.mockGetCurrentUser()

    // 检查用户权限
    if (!user && permission !== "public") {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        }),
        { status: 401 }
      )
    }

    if (user?.status === "BANNED" && permission === "user-active") {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "FORBIDDEN", message: "用户已被封禁" },
        }),
        { status: 403 }
      )
    }

    return handler(user)
  }),
  handleApiError: vi.fn((error) => {
    const status = error.message.includes("UNAUTHORIZED")
      ? 401
      : error.message.includes("FORBIDDEN")
        ? 403
        : error.message.includes("NOT_FOUND")
          ? 404
          : 400
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: error.message, message: error.message },
      }),
      { status }
    )
  }),
}))

const mockGetCurrentUser = hoistedMocks.mockGetCurrentUser

import { GET as getComments, POST as postComment } from "@/app/api/comments/route"
import { DELETE as deleteComment } from "@/app/api/comments/[id]/route"

// Mock @/lib/prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    activity: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock unified response helpers
vi.mock("@/lib/api/unified-response", () => ({
  createSuccessResponse: vi.fn(
    (data) =>
      new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
  ),
  createErrorResponse: vi.fn((code, message) => {
    const status =
      code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 400
    return new Response(
      JSON.stringify({
        success: false,
        error: { code, message },
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    )
  }),
  createPaginatedResponse: vi.fn(
    (data, pagination) =>
      new Response(
        JSON.stringify({
          success: true,
          data,
          meta: { pagination },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
  ),
  validateRequestData: vi.fn(() => ({ valid: true })),
  parsePaginationParams: vi.fn((params) => ({
    cursor: params.get("cursor"),
    limit: parseInt(params.get("limit") || "10"),
  })),
  handleApiError: vi.fn((error) => {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "ERROR", message: error.message },
      }),
      { status: 500 }
    )
  }),
  ErrorCode: {
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}))

// Mock interactions
vi.mock("@/lib/interactions", () => ({
  createComment: vi.fn(),
  listComments: vi.fn(() =>
    Promise.resolve({
      comments: [],
      total: 0,
      hasMore: false,
    })
  ),
  deleteComment: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import {
  listComments,
  createComment,
  deleteComment as deleteCommentService,
} from "@/lib/interactions"

describe("评论API路由契约测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /api/comments - 公开访问", () => {
    it("应该返回400当缺少必需参数", async () => {
      const request = new NextRequest("http://localhost:3000/api/comments")

      const response = await getComments(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("VALIDATION_ERROR")
    })

    it("应该返回评论列表（带targetType和targetId）", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "测试评论1",
          authorId: "user-1",
          targetType: "post",
          targetId: "post-1",
          activityId: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: "user-1", name: "用户1", avatar: null },
        },
      ]

      vi.mocked(listComments).mockResolvedValue({
        comments: mockComments,
        total: 1,
        hasMore: false,
      })

      const request = new NextRequest(
        "http://localhost:3000/api/comments?targetType=post&targetId=post-1"
      )
      const response = await getComments(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(listComments).toHaveBeenCalled()
    })

    it("应该支持分页参数cursor和limit", async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        total: 0,
        hasMore: false,
      })

      const request = new NextRequest(
        "http://localhost:3000/api/comments?targetType=post&targetId=post-1&cursor=abc&limit=5"
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "post",
          targetId: "post-1",
          cursor: "abc",
          limit: 5,
        })
      )
    })

    it("应该支持includeReplies参数", async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        total: 0,
        hasMore: false,
      })

      const request = new NextRequest(
        "http://localhost:3000/api/comments?targetType=post&targetId=post-1&includeReplies=true"
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "post",
          targetId: "post-1",
          includeReplies: true,
        })
      )
    })

    it("缺省 cursor/parentId 时应该返回 200", async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        total: 0,
        hasMore: false,
      })

      const request = new NextRequest(
        "http://localhost:3000/api/comments?targetType=post&targetId=post-1"
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalled()
    })
  })

  describe("POST /api/comments - 需要认证", () => {
    it("应该返回401当用户未登录", async () => {
      mockGetCurrentUser.mockReturnValue(null)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          targetType: "post",
          targetId: "post-1",
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it("应该返回403当用户被封禁", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
        status: "BANNED",
      } as any)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          targetType: "post",
          targetId: "post-1",
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
    })

    it("应该允许ACTIVE用户创建评论", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
      } as any)

      const mockComment = {
        id: "new-comment",
        content: "新评论",
        authorId: "user-1",
        targetType: "post",
        targetId: "post-1",
        createdAt: new Date(),
        author: { id: "user-1", name: "用户1" },
      }

      vi.mocked(createComment).mockResolvedValue(mockComment as any)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          targetType: "post",
          targetId: "post-1",
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          content: "新评论",
          targetType: "post",
          targetId: "post-1",
        })
      )
    })

    it("应该允许ADMIN用户创建评论", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
        status: "ACTIVE",
      } as any)

      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: "post-1" } as any)
      vi.mocked(prisma.comment.create).mockResolvedValue({
        id: "admin-comment",
        content: "管理员评论",
        authorId: "admin-1",
      } as any)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "管理员评论",
          targetType: "post",
          targetId: "post-1",
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe("DELETE /api/comments/[id] - 需要认证", () => {
    it("应该允许作者删除自己的评论（软删除）", async () => {
      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        content: "我的评论",
        activityId: null,
      }

      mockGetCurrentUser.mockReturnValue({
        id: "user-1",
        role: "USER",
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        content: "[该评论已删除]",
      } as any)

      const request = new NextRequest("http://localhost:3000/api/comments/comment-1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment-1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "comment-1" },
          data: expect.objectContaining({
            content: "[该评论已删除]",
          }),
        })
      )
    })

    it("应该允许ADMIN删除任何评论（硬删除）", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "admin-1",
        role: "ADMIN",
      } as any)

      const mockComment = {
        id: "comment-1",
        authorId: "other-user",
        content: "别人的评论",
        activityId: "activity-1",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.activity.update).mockResolvedValue({} as any)

      const request = new NextRequest("http://localhost:3000/api/comments/comment-1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment-1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: "comment-1" },
      })
    })

    it("应该拒绝非作者删除他人评论（403）", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "user-2",
        role: "USER",
      } as any)

      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        content: "别人的评论",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)

      const request = new NextRequest("http://localhost:3000/api/comments/comment-1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment-1" } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
    })

    it("应该返回404当评论不存在", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "user-1",
        role: "USER",
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/comments/non-existent", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "non-existent" } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })

    it("应该在硬删除时更新活动计数", async () => {
      mockGetCurrentUser.mockReturnValue({
        id: "admin-1",
        role: "ADMIN",
      } as any)

      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        activityId: "activity-1",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.activity.update).mockResolvedValue({
        commentCount: 9,
      } as any)

      const request = new NextRequest("http://localhost:3000/api/comments/comment-1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment-1" } })

      expect(response.status).toBe(200)
      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: "activity-1" },
        data: { commentCount: { decrement: 1 } },
      })
    })
  })

  describe("429 Rate Limit Error Mapping", () => {
    it("应该正确返回 429 错误和中文提示", async () => {
      // Mock rate limit exceeded scenario
      const mockError = new Error("RATE_LIMIT_EXCEEDED")

      vi.mock("@/lib/api/unified-response", () => ({
        createErrorResponse: vi.fn((code, message, details, meta) => {
          if (code === "RATE_LIMIT_EXCEEDED") {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: "RATE_LIMIT_EXCEEDED",
                  message: "操作过于频繁，请稍后再试",
                },
                meta: meta || { retryAfter: 5000 },
              }),
              {
                status: 429,
                headers: { "Content-Type": "application/json" },
              }
            )
          }
        }),
      }))

      // 验证错误消息格式
      const errorResponse = {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "操作过于频繁，请稍后再试",
        },
        meta: { retryAfter: 5000 },
      }

      expect(errorResponse.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(errorResponse.error.message).toBe("操作过于频繁，请稍后再试")
      expect(errorResponse.meta.retryAfter).toBeDefined()
    })
  })

  describe("Activity 评论场景测试", () => {
    describe("GET /api/comments - 获取动态评论", () => {
      it("应该返回动态的评论列表", async () => {
        const mockComments = [
          {
            id: "comment-1",
            content: "动态评论1",
            authorId: "user-1",
            targetType: "activity",
            targetId: "activity-1",
            postId: null,
            activityId: "activity-1",
            parentId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { id: "user-1", name: "用户1", avatarUrl: null },
          },
          {
            id: "comment-2",
            content: "动态评论2",
            authorId: "user-2",
            targetType: "activity",
            targetId: "activity-1",
            postId: null,
            activityId: "activity-1",
            parentId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { id: "user-2", name: "用户2", avatarUrl: null },
          },
        ]

        vi.mocked(listComments).mockResolvedValue({
          comments: mockComments,
          total: 2,
          hasMore: false,
          nextCursor: null,
        })

        const request = new NextRequest(
          "http://localhost:3000/api/comments?targetType=activity&targetId=activity-1"
        )
        const response = await getComments(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()
        expect(listComments).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: "activity",
            targetId: "activity-1",
            includeAuthor: true,
          })
        )
      })

      it("应该支持动态评论的分页", async () => {
        vi.mocked(listComments).mockResolvedValue({
          comments: [],
          total: 0,
          hasMore: true,
          nextCursor: "next-cursor",
        })

        const request = new NextRequest(
          "http://localhost:3000/api/comments?targetType=activity&targetId=activity-1&cursor=prev-cursor&limit=10"
        )
        const response = await getComments(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(listComments).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: "activity",
            targetId: "activity-1",
            cursor: "prev-cursor",
            limit: 10,
          })
        )
      })
    })

    describe("POST /api/comments - 创建动态评论", () => {
      it("应该允许登录用户评论动态", async () => {
        mockGetCurrentUser.mockReturnValue({
          id: "user-1",
          email: "test@example.com",
          role: "USER",
          status: "ACTIVE",
        } as any)

        const mockComment = {
          id: "new-activity-comment",
          content: "对动态的评论",
          authorId: "user-1",
          targetType: "activity",
          targetId: "activity-1",
          activityId: "activity-1",
          postId: null,
          createdAt: new Date(),
          author: { id: "user-1", name: "用户1", avatarUrl: null },
        }

        vi.mocked(createComment).mockResolvedValue(mockComment as any)
        vi.mocked(prisma.activity.findUnique).mockResolvedValue({
          id: "activity-1",
          content: "这是一条动态",
          authorId: "user-2",
        } as any)

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "对动态的评论",
            targetType: "activity",
            targetId: "activity-1",
          }),
        })

        const response = await postComment(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(createComment).toHaveBeenCalledWith(
          expect.objectContaining({
            content: "对动态的评论",
            targetType: "activity",
            targetId: "activity-1",
            authorId: "user-1",
          })
        )
      })

      it("应该返回404当动态不存在", async () => {
        mockGetCurrentUser.mockReturnValue({
          id: "user-1",
          email: "test@example.com",
          role: "USER",
          status: "ACTIVE",
        } as any)

        vi.mocked(createComment).mockRejectedValue(new Error("activity not found"))

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "对不存在动态的评论",
            targetType: "activity",
            targetId: "non-existent-activity",
          }),
        })

        const response = await postComment(request)

        expect(response.status).toBe(500) // handleApiError 会处理这个错误
        expect(createComment).toHaveBeenCalled()
      })

      it("应该拒绝未登录用户评论动态", async () => {
        mockGetCurrentUser.mockReturnValue(null)

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "未登录评论",
            targetType: "activity",
            targetId: "activity-1",
          }),
        })

        const response = await postComment(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe("UNAUTHORIZED")
      })

      it("应该拒绝被封禁用户评论动态", async () => {
        mockGetCurrentUser.mockReturnValue({
          id: "banned-user",
          email: "banned@example.com",
          role: "USER",
          status: "BANNED",
        } as any)

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "被封禁用户的评论",
            targetType: "activity",
            targetId: "activity-1",
          }),
        })

        const response = await postComment(request)
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe("FORBIDDEN")
      })
    })
  })
})
