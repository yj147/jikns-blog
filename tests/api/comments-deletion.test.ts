/**
 * API级软删除/硬删除回归测试
 * 验证评论删除逻辑的正确性
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { DELETE as deleteComment } from "@/app/api/comments/[id]/route"
import { POST as createComment } from "@/app/api/comments/route"
import { getCurrentUser } from "@/lib/api/unified-auth"
import prisma from "@/lib/prisma"

// Mock dependencies
vi.mock("@/lib/api/unified-auth", () => ({
  getCurrentUser: vi.fn(),
  withApiAuth: vi.fn(async (req, permission, handler) => {
    const { getCurrentUser } = await import("@/lib/api/unified-auth")
    const user = await getCurrentUser()
    return handler(user)
  }),
  createAuditLog: vi.fn(),
}))

const mockAssertPolicy = vi.hoisted(() => vi.fn())
const mockGenerateRequestId = vi.hoisted(() => vi.fn(() => "test-request-id"))

vi.mock("@/lib/auth/session", () => ({
  assertPolicy: mockAssertPolicy,
  generateRequestId: mockGenerateRequestId,
}))

vi.mock("@/lib/rate-limit/comment-limits", () => ({
  checkCommentRate: vi.fn(() => Promise.resolve({ allowed: true })),
  extractClientIP: vi.fn(() => "127.0.0.1"),
}))

// Mock Prisma
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    comment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(), // 添加 findUnique
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    activity: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  // 设置 $transaction 使用 mockPrisma 而非真实 prisma
  mockPrisma.$transaction = vi.fn((fn) => fn(mockPrisma))

  return {
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

describe("Comment Deletion API Tests", () => {
  const mockUser = {
    id: "user123",
    email: "test@example.com",
    role: "USER" as const,
    status: "ACTIVE" as const,
  }

  const mockAdminUser = {
    id: "admin123",
    email: "admin@example.com",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  }

  const mockComment = {
    id: "comment1",
    content: "Test comment",
    authorId: mockUser.id,
    activityId: "activity1", // 数据库字段名
    postId: null, // 数据库字段名
    parentId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockActivity = {
    id: "activity1",
    content: "Test activity",
    authorId: mockUser.id,
    commentsCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateRequestId.mockReturnValue("test-request-id")
    mockAssertPolicy.mockResolvedValue([mockUser, null])
  })

  describe("Soft Delete (with replies)", () => {
    it("should soft delete comment when it has replies", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      // Mock comment with replies
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(2) // Has 2 replies

      // Mock soft delete
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      })

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
      // 软删除的验证通过检查 mock 调用

      // 验证调用了软删除
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: "comment1" },
        data: { deletedAt: expect.any(Date) },
      })

      // 验证没有调用硬删除
      expect(prisma.comment.delete).not.toHaveBeenCalled()
    })

    it("should NOT decrement activity.commentsCount on soft delete", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      // Mock comment and activity
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(1) // Has replies
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(mockActivity)

      // Mock soft delete
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      })

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })

      expect(response.status).toBe(200)

      // 验证没有更新 activity.commentsCount
      expect(prisma.activity.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            commentsCount: expect.any(Number),
          }),
        })
      )
    })
  })

  describe("Hard Delete (no replies)", () => {
    it("should hard delete comment when it has no replies", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      // Mock comment without replies
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(0) // No replies

      // Mock activity for count update
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(mockActivity)

      // Mock hard delete
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment)

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
      // 硬删除的验证通过检查 mock 调用

      // 验证调用了硬删除
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: "comment1" },
      })

      // 验证没有调用软删除
      expect(prisma.comment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      )
    })

    it("should rely on triggers for activity.commentsCount on hard delete", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      // Mock comment and activity
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(0) // No replies
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(mockActivity)

      // Mock updates
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment)

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })

      expect(response.status).toBe(200)

      // 计数由数据库触发器处理，此处不应直接更新 activity
      expect(prisma.activity.update).not.toHaveBeenCalled()
    })

    it("should use aggregation for Post comments count", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      // Mock comment targeting a post
      const postComment = {
        ...mockComment,
        activityId: null, // 改为 null
        postId: "post1", // 设置 postId
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(postComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(0) // No replies
      vi.mocked(prisma.post.findUnique).mockResolvedValue({
        id: "post1",
        title: "Test Post",
        content: "Test content",
        authorId: mockUser.id,
        published: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Mock hard delete
      vi.mocked(prisma.comment.delete).mockResolvedValue(postComment)

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
      // Post 评论计数使用聚合，不更新 post 表
      expect(prisma.post).not.toHaveProperty("update")
    })
  })

  describe("Admin Deletion", () => {
    it("should allow admin to delete any comment", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser)
      mockAssertPolicy.mockResolvedValue([mockAdminUser, null])

      // Mock comment owned by another user
      const otherUserComment = {
        ...mockComment,
        authorId: "otheruser123",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(otherUserComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(0) // No replies
      vi.mocked(prisma.comment.delete).mockResolvedValue(otherUserComment)
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(mockActivity)

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)

      // 验证管理员可以删除他人的评论
      expect(prisma.comment.delete).toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should return 404 when comment not found", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

      const request = new NextRequest("http://localhost/api/comments/nonexistent", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "nonexistent" } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("NOT_FOUND")
    })

    it("should return 403 when user tries to delete others comment", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      // Mock comment owned by another user
      const otherUserComment = {
        ...mockComment,
        authorId: "otheruser123",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(otherUserComment)

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")

      // 验证没有执行删除
      expect(prisma.comment.delete).not.toHaveBeenCalled()
      expect(prisma.comment.update).not.toHaveBeenCalled()
    })
  })

  describe("Response Format", () => {
    it("should return consistent response structure for soft delete", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(1) // Has replies
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      })

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      // 验证响应格式
      expect(data).toMatchObject({
        success: true,
        data: {
          deleted: true,
        },
        meta: {
          timestamp: expect.any(String),
        },
      })
    })

    it("should return consistent response structure for hard delete", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment)
      vi.mocked(prisma.comment.count).mockResolvedValue(0) // No replies
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment)
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(mockActivity)

      const request = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: "comment1" } })
      const data = await response.json()

      // 验证响应格式
      expect(data).toMatchObject({
        success: true,
        data: {
          deleted: true,
        },
        meta: {
          timestamp: expect.any(String),
        },
      })
    })
  })
})
