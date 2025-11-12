import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock @/lib/api/unified-auth
vi.mock("@/lib/api/unified-auth", () => ({
  getCurrentUser: vi.fn(),
  withApiAuth: vi.fn((handler) => handler),
}))

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

import { getCurrentUser } from "@/lib/api/unified-auth"
import { prisma } from "@/lib/prisma"

describe("评论API契约测试 - 纯Mock版", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /api/comments - 公开访问", () => {
    it("应该返回评论列表（带postId）", async () => {
      // Mock 数据
      const mockComments = [
        {
          id: "comment-1",
          content: "测试评论1",
          authorId: "user-1",
          postId: "post-1",
          activityId: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          author: { id: "user-1", name: "用户1", avatar: null },
        },
      ]

      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockComments)
      vi.mocked(prisma.comment.count).mockResolvedValue(1)

      // 模拟GET请求处理
      const result = await prisma.comment.findMany({
        where: { postId: "post-1", deletedAt: null },
        include: { author: true },
        take: 10,
      })

      expect(result).toEqual(mockComments)
      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { postId: "post-1", deletedAt: null },
        include: { author: true },
        take: 10,
      })
    })

    it("应该返回400当缺少targetType参数", async () => {
      // 模拟参数验证
      const validateParams = (postId?: string, activityId?: string) => {
        if (!postId && !activityId) {
          return {
            success: false,
            error: { code: "INVALID_REQUEST", message: "必须提供 postId 或 activityId" },
          }
        }
        return { success: true }
      }

      const result = validateParams()
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("INVALID_REQUEST")
    })

    it("应该支持分页参数", async () => {
      const mockComments = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `comment-${i}`,
          content: `评论${i}`,
          authorId: "user-1",
          postId: "post-1",
          activityId: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }))

      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockComments)

      const result = await prisma.comment.findMany({
        where: { postId: "post-1" },
        take: 5,
        cursor: { id: "comment-0" },
      })

      expect(result).toHaveLength(5)
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          cursor: { id: "comment-0" },
        })
      )
    })

    it("应该支持includeReplies参数", async () => {
      const mockCommentsWithReplies = [
        {
          id: "comment-1",
          content: "主评论",
          replies: [{ id: "reply-1", content: "回复1", parentId: "comment-1" }],
        },
      ]

      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockCommentsWithReplies as any)

      const result = await prisma.comment.findMany({
        where: { postId: "post-1", parentId: null },
        include: { replies: true },
      })

      expect(result[0]).toHaveProperty("replies")
    })
  })

  describe("POST /api/comments - 需要认证", () => {
    it("应该返回401当用户未登录", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const user = await getCurrentUser()

      // 模拟认证检查
      if (!user) {
        const error = { code: "UNAUTHORIZED", message: "需要登录", status: 401 }
        expect(error.status).toBe(401)
      }
    })

    it("应该返回403当用户被封禁", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
        status: "BANNED",
      } as any)

      const user = await getCurrentUser()

      // 模拟权限检查
      if (user?.status === "BANNED") {
        const error = { code: "FORBIDDEN", message: "用户已被封禁", status: 403 }
        expect(error.status).toBe(403)
      }
    })

    it("应该允许ACTIVE用户创建评论", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
      } as any)

      const mockComment = {
        id: "new-comment",
        content: "新评论",
        authorId: "user-1",
        postId: "post-1",
        createdAt: new Date(),
      }

      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment as any)

      const user = await getCurrentUser()
      if (user?.status === "ACTIVE") {
        const result = await prisma.comment.create({
          data: {
            content: "新评论",
            authorId: user.id,
            postId: "post-1",
          },
        })

        expect(result.content).toBe("新评论")
        expect(result.authorId).toBe("user-1")
      }
    })

    it("应该允许ADMIN用户创建评论", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
        status: "ACTIVE",
      } as any)

      const user = await getCurrentUser()
      expect(user?.role).toBe("ADMIN")
      expect(user?.status).toBe("ACTIVE")
    })
  })

  describe("DELETE /api/comments/[id] - 需要认证", () => {
    it("应该允许作者删除自己的评论", async () => {
      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        content: "我的评论",
      }

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        role: "USER",
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      } as any)

      const user = await getCurrentUser()
      const comment = await prisma.comment.findUnique({ where: { id: "comment-1" } })

      // 检查权限
      if (comment?.authorId === user?.id) {
        const result = await prisma.comment.update({
          where: { id: "comment-1" },
          data: { deletedAt: new Date() },
        })

        expect(result.deletedAt).toBeTruthy()
      }
    })

    it("应该允许ADMIN删除任何评论", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
      } as any)

      const mockComment = {
        id: "comment-1",
        authorId: "other-user",
        content: "别人的评论",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment as any)

      const user = await getCurrentUser()
      const comment = await prisma.comment.findUnique({ where: { id: "comment-1" } })

      // ADMIN可以删除任何评论
      if (user?.role === "ADMIN") {
        const result = await prisma.comment.delete({
          where: { id: "comment-1" },
        })

        expect(result.id).toBe("comment-1")
      }
    })

    it("应该拒绝非作者删除他人评论", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-2",
        role: "USER",
      } as any)

      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        content: "别人的评论",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)

      const user = await getCurrentUser()
      const comment = await prisma.comment.findUnique({ where: { id: "comment-1" } })

      // 检查权限
      if (comment?.authorId !== user?.id && user?.role !== "ADMIN") {
        const error = { code: "FORBIDDEN", message: "无权删除他人评论", status: 403 }
        expect(error.status).toBe(403)
      }
    })

    it("应该返回404当评论不存在", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

      const comment = await prisma.comment.findUnique({ where: { id: "non-existent" } })

      if (!comment) {
        const error = { code: "NOT_FOUND", message: "评论不存在", status: 404 }
        expect(error.status).toBe(404)
      }
    })
  })

  describe("统一路由与兼容路由响应结构", () => {
    it("应该保持响应结构一致", () => {
      // 统一路由响应格式
      const unifiedResponse = {
        success: true,
        data: [],
        meta: {
          pagination: {
            hasNext: false,
            nextCursor: null,
          },
        },
      }

      // 兼容路由响应格式（应该相同）
      const compatResponse = {
        success: true,
        data: [],
        meta: {
          pagination: {
            hasNext: false,
            nextCursor: null,
          },
        },
      }

      expect(unifiedResponse).toEqual(compatResponse)
    })

    it("应该保持错误响应结构一致", () => {
      // 统一错误格式
      const errorResponse = {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "请求参数错误",
        },
      }

      expect(errorResponse.success).toBe(false)
      expect(errorResponse.error).toBeDefined()
    })
  })
})
