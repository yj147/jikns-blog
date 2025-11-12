import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/comments/route"
import { DELETE } from "@/app/api/comments/[id]/route"

// Mock getCurrentUser and withApiAuth
vi.mock("@/lib/api/unified-auth", () => ({
  getCurrentUser: vi.fn(),
  withApiAuth: vi.fn((request, scope, handler) => {
    // 模拟 withApiAuth 的行为
    const getCurrentUser = vi.mocked(require("@/lib/api/unified-auth").getCurrentUser)
    const user = getCurrentUser()

    // 检查用户状态
    if (!user && (scope === "user-active" || scope === "admin")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "UNAUTHORIZED", message: "用户未认证" },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      )
    }

    if (user?.status === "BANNED" && scope === "user-active") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "FORBIDDEN", message: "用户已被封禁" },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      )
    }

    if (scope === "admin" && user?.role !== "ADMIN") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "FORBIDDEN", message: "需要管理员权限" },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      )
    }

    // 调用实际的处理函数
    return handler(user)
  }),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    activity: {
      update: vi.fn(),
    },
  },
}))

import { getCurrentUser } from "@/lib/api/unified-auth"
import prisma from "@/lib/prisma"

describe("Comments API - Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("GET /api/comments", () => {
    it("应该允许公开访问评论列表", async () => {
      const mockComments = [
        {
          id: "1",
          content: "测试评论1",
          userId: "user1",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          deletedAt: null,
          parentId: null,
          postId: "post1",
          activityId: null,
          user: {
            id: "user1",
            name: "用户1",
            email: "user1@test.com",
            image: null,
          },
          _count: { likes: 5 },
        },
      ]

      ;(prisma.comment.findMany as any).mockResolvedValue(mockComments)
      ;(prisma.comment.count as any).mockResolvedValue(1)
      ;(getCurrentUser as any).mockResolvedValue(null) // 未登录用户

      const request = new NextRequest("http://localhost:3000/api/comments?postId=post1")
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.meta?.pagination).toBeDefined()
    })

    it("应该支持分页参数 cursor 和 limit", async () => {
      ;(prisma.comment.findMany as any).mockResolvedValue([])
      ;(prisma.comment.count as any).mockResolvedValue(0)
      ;(getCurrentUser as any).mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost:3000/api/comments?postId=post1&cursor=cursor123&limit=20"
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21, // limit + 1 for hasNext detection
          cursor: { id: "cursor123" },
          skip: 1,
        })
      )
    })

    it("应该支持 includeReplies 参数", async () => {
      const mockCommentsWithReplies = [
        {
          id: "1",
          content: "主评论",
          parentId: null,
          replies: [
            {
              id: "2",
              content: "回复评论",
              parentId: "1",
            },
          ],
        },
      ]

      ;(prisma.comment.findMany as any).mockResolvedValue(mockCommentsWithReplies)
      ;(prisma.comment.count as any).mockResolvedValue(2)
      ;(getCurrentUser as any).mockResolvedValue(null)

      const request = new NextRequest(
        "http://localhost:3000/api/comments?postId=post1&includeReplies=true"
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            replies: expect.any(Object),
          }),
        })
      )
    })
  })

  describe("POST /api/comments", () => {
    it("应该拒绝未登录用户创建评论 (401)", async () => {
      ;(getCurrentUser as any).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          postId: "post1",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("应该拒绝 BANNED 用户创建评论 (403)", async () => {
      ;(getCurrentUser as any).mockResolvedValue({
        id: "user1",
        status: "BANNED",
      })

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          postId: "post1",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")
    })

    it("应该允许 ACTIVE 用户创建评论 (200)", async () => {
      const mockUser = {
        id: "user1",
        status: "ACTIVE",
        name: "活跃用户",
        email: "active@test.com",
      }

      const mockCreatedComment = {
        id: "new-comment-1",
        content: "新评论内容",
        userId: "user1",
        postId: "post1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        parentId: null,
        activityId: null,
        user: mockUser,
        _count: { likes: 0 },
      }

      ;(getCurrentUser as any).mockResolvedValue(mockUser)
      ;(prisma.comment.create as any).mockResolvedValue(mockCreatedComment)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论内容",
          postId: "post1",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toBe("新评论内容")
      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: "新评论内容",
            userId: "user1",
            postId: "post1",
          }),
        })
      )
    })

    it("应该允许 ADMIN 用户创建评论 (200)", async () => {
      const mockAdmin = {
        id: "admin1",
        status: "ACTIVE",
        role: "ADMIN",
        name: "管理员",
        email: "admin@test.com",
      }

      const mockCreatedComment = {
        id: "admin-comment-1",
        content: "管理员评论",
        userId: "admin1",
        postId: "post1",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        parentId: null,
        activityId: null,
        user: mockAdmin,
        _count: { likes: 0 },
      }

      ;(getCurrentUser as any).mockResolvedValue(mockAdmin)
      ;(prisma.comment.create as any).mockResolvedValue(mockCreatedComment)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "管理员评论",
          postId: "post1",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toBe("管理员评论")
    })
  })

  describe("DELETE /api/comments/[id]", () => {
    it("应该允许作者删除自己的评论", async () => {
      const mockUser = {
        id: "user1",
        status: "ACTIVE",
        role: "USER",
      }

      const mockComment = {
        id: "comment1",
        userId: "user1",
        content: "待删除评论",
        deletedAt: null,
        activityId: "activity1",
      }

      ;(getCurrentUser as any).mockResolvedValue(mockUser)
      ;(prisma.comment.findUnique as any).mockResolvedValue(mockComment)
      ;(prisma.comment.update as any).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      })

      const request = new NextRequest("http://localhost:3000/api/comments/comment1")
      const response = await DELETE(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: "comment1" },
        data: { deletedAt: expect.any(Date) },
      })
      // 软删除不应该更新活动计数
      expect(prisma.activity.update).not.toHaveBeenCalled()
    })

    it("应该允许 ADMIN 删除任何评论", async () => {
      const mockAdmin = {
        id: "admin1",
        status: "ACTIVE",
        role: "ADMIN",
      }

      const mockComment = {
        id: "comment1",
        userId: "other-user",
        content: "其他用户的评论",
        deletedAt: null,
      }

      ;(getCurrentUser as any).mockResolvedValue(mockAdmin)
      ;(prisma.comment.findUnique as any).mockResolvedValue(mockComment)
      ;(prisma.comment.update as any).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      })

      const request = new NextRequest("http://localhost:3000/api/comments/comment1")
      const response = await DELETE(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it("应该拒绝非作者删除他人评论 (403)", async () => {
      const mockUser = {
        id: "user1",
        status: "ACTIVE",
        role: "USER",
      }

      const mockComment = {
        id: "comment1",
        userId: "other-user",
        content: "其他用户的评论",
        deletedAt: null,
      }

      ;(getCurrentUser as any).mockResolvedValue(mockUser)
      ;(prisma.comment.findUnique as any).mockResolvedValue(mockComment)

      const request = new NextRequest("http://localhost:3000/api/comments/comment1")
      const response = await DELETE(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")
      expect(prisma.comment.update).not.toHaveBeenCalled()
    })

    it("应该返回 404 当评论不存在", async () => {
      const mockUser = {
        id: "user1",
        status: "ACTIVE",
      }

      ;(getCurrentUser as any).mockResolvedValue(mockUser)
      ;(prisma.comment.findUnique as any).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/comments/non-existent")
      const response = await DELETE(request, { params: { id: "non-existent" } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("NOT_FOUND")
    })

    it("应该在硬删除时更新活动计数", async () => {
      const mockAdmin = {
        id: "admin1",
        status: "ACTIVE",
        role: "ADMIN",
      }

      const mockComment = {
        id: "comment1",
        userId: "user1",
        deletedAt: new Date("2024-01-01"), // 已软删除
        activityId: "activity1",
      }

      ;(getCurrentUser as any).mockResolvedValue(mockAdmin)
      ;(prisma.comment.findUnique as any).mockResolvedValue(mockComment)
      ;(prisma.comment.delete as any).mockResolvedValue(mockComment)

      const request = new NextRequest("http://localhost:3000/api/comments/comment1?hard=true")
      const response = await DELETE(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: "comment1" },
      })
      // 硬删除应该更新活动计数
      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: "activity1" },
        data: {
          commentCount: { decrement: 1 },
        },
      })
    })
  })
})
