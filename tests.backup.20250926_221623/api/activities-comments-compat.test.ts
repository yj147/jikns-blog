/**
 * 兼容层一致性测试
 * 验证 /api/comments 与 /api/activities/[id]/comments 的行为一致性
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET as getComments } from "@/app/api/comments/route"
import { POST as createComment } from "@/app/api/comments/route"
import { DELETE as deleteComment } from "@/app/api/comments/[id]/route"
import { GET as getActivityComments } from "@/app/api/activities/[id]/comments/route"
import { POST as createActivityComment } from "@/app/api/activities/[id]/comments/route"
import { DELETE as deleteActivityComment } from "@/app/api/activities/[id]/comments/[commentId]/route"
import { getCurrentUser } from "@/lib/api/unified-auth"

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

vi.mock("@/lib/interactions", () => ({
  createComment: vi.fn(),
  listComments: vi.fn(),
  deleteComment: vi.fn(),
}))

vi.mock("@/lib/rate-limit/comment-limits", () => ({
  checkCommentRate: vi.fn(() => Promise.resolve({ allowed: true })),
  extractClientIP: vi.fn(() => "127.0.0.1"),
}))

describe("API Compatibility Tests", () => {
  const mockUser = {
    id: "user123",
    email: "test@example.com",
    role: "USER",
    status: "ACTIVE",
  }

  const mockComment = {
    id: "comment1",
    content: "Test comment",
    authorId: mockUser.id,
    targetType: "activity",
    targetId: "activity1",
    createdAt: new Date(),
    updatedAt: new Date(),
    parentId: null,
    deletedAt: null,
    author: {
      id: mockUser.id,
      name: "Test User",
      avatarUrl: null,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET endpoints compatibility", () => {
    it("should return same structure for listing comments", async () => {
      const { listComments } = await import("@/lib/interactions")
      const mockResult = {
        comments: [mockComment],
        hasMore: false,
        nextCursor: null,
      }

      vi.mocked(listComments).mockResolvedValue(mockResult)

      // Test /api/comments
      const directRequest = new NextRequest(
        "http://localhost/api/comments?targetType=activity&targetId=activity1",
        { method: "GET" }
      )
      const directResponse = await getComments(directRequest)
      const directData = await directResponse.json()

      // Test /api/activities/[id]/comments
      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments",
        { method: "GET" }
      )
      const activityResponse = await getActivityComments(activityRequest, {
        params: { id: "activity1" },
      })
      const activityData = await activityResponse.json()

      // 验证响应结构一致
      expect(directResponse.status).toBe(activityResponse.status)
      expect(directData.success).toBe(activityData.success)
      expect(directData.data).toEqual(activityData.data)

      // 验证都调用了相同的底层服务
      expect(listComments).toHaveBeenCalledTimes(2)
      expect(listComments).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "activity",
          targetId: "activity1",
        })
      )
    })

    it("should handle pagination consistently", async () => {
      const { listComments } = await import("@/lib/interactions")
      const mockResult = {
        comments: [mockComment],
        hasMore: true,
        nextCursor: "cursor123",
      }

      vi.mocked(listComments).mockResolvedValue(mockResult)

      // Test with pagination params
      const directRequest = new NextRequest(
        "http://localhost/api/comments?targetType=activity&targetId=activity1&cursor=prev123&limit=10",
        { method: "GET" }
      )
      const directResponse = await getComments(directRequest)
      const directData = await directResponse.json()

      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments?cursor=prev123&limit=10",
        { method: "GET" }
      )
      const activityResponse = await getActivityComments(activityRequest, {
        params: { id: "activity1" },
      })
      const activityData = await activityResponse.json()

      // 验证分页数据一致
      expect(directData.data).toEqual(activityData.data)
      expect(directData.meta.pagination).toEqual(activityData.meta.pagination)
      expect(directData.meta.pagination.hasMore).toBe(true)
      expect(directData.meta.pagination.nextCursor).toBe("cursor123")
    })
  })

  describe("POST endpoints compatibility", () => {
    it("should create comments with same structure", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      const { createComment: mockCreateComment } = await import("@/lib/interactions")
      vi.mocked(mockCreateComment).mockResolvedValue(mockComment)

      // Test /api/comments
      const directRequest = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "activity",
          targetId: "activity1",
          content: "Test comment",
        }),
      })
      const directResponse = await createComment(directRequest)
      const directData = await directResponse.json()

      // Test /api/activities/[id]/comments
      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "Test comment",
          }),
        }
      )
      const activityResponse = await createActivityComment(activityRequest, {
        params: { id: "activity1" },
      })
      const activityData = await activityResponse.json()

      // 验证响应一致
      expect(directResponse.status).toBe(activityResponse.status)
      expect(directData.success).toBe(activityData.success)
      expect(directData.data).toMatchObject({
        id: mockComment.id,
        content: mockComment.content,
        authorId: mockComment.authorId,
      })
      expect(activityData.data).toMatchObject({
        id: mockComment.id,
        content: mockComment.content,
        authorId: mockComment.authorId,
      })
    })

    it("should handle authentication errors consistently", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      // Test /api/comments
      const directRequest = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "activity",
          targetId: "activity1",
          content: "Test comment",
        }),
      })
      const directResponse = await createComment(directRequest)
      const directData = await directResponse.json()

      // Test /api/activities/[id]/comments
      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "Test comment",
          }),
        }
      )
      const activityResponse = await createActivityComment(activityRequest, {
        params: { id: "activity1" },
      })
      const activityData = await activityResponse.json()

      // 验证认证错误一致
      expect(directResponse.status).toBe(401)
      expect(activityResponse.status).toBe(401)
      expect(directData.error.code).toBe("UNAUTHORIZED")
      expect(activityData.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("DELETE endpoints compatibility", () => {
    it("should delete comments consistently", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      const { deleteComment: mockDeleteComment } = await import("@/lib/interactions")
      vi.mocked(mockDeleteComment).mockResolvedValue(undefined)

      // Test /api/comments/[id]
      const directRequest = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })
      const directResponse = await deleteComment(directRequest, { params: { id: "comment1" } })
      const directData = await directResponse.json()

      // Test /api/activities/[id]/comments/[commentId]
      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments/comment1",
        { method: "DELETE" }
      )
      const activityResponse = await deleteActivityComment(activityRequest, {
        params: { id: "activity1", commentId: "comment1" },
      })
      const activityData = await activityResponse.json()

      // 验证删除响应一致
      expect(directResponse.status).toBe(activityResponse.status)
      expect(directData.success).toBe(activityData.success)
      expect(directData.data.deleted).toBe(true)
      expect(activityData.data.deleted).toBe(true)
    })

    it("should handle rate limiting consistently", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser)

      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(checkCommentRate).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      })
      vi.mocked(checkCommentRate).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      })

      // Test /api/comments/[id]
      const directRequest = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })
      const directResponse = await deleteComment(directRequest, { params: { id: "comment1" } })
      const directData = await directResponse.json()

      // Test /api/activities/[id]/comments/[commentId]
      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments/comment1",
        { method: "DELETE" }
      )
      const activityResponse = await deleteActivityComment(activityRequest, {
        params: { id: "activity1", commentId: "comment1" },
      })
      const activityData = await activityResponse.json()

      // 验证限流响应一致
      expect(directResponse.status).toBe(429)
      expect(activityResponse.status).toBe(429)
      expect(directData.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(activityData.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(directData.error.details.retryAfter).toBe(60)
      expect(activityData.error.details.retryAfter).toBe(60)
    })
  })

  describe("Middleware behavior", () => {
    it("should allow GET requests without authentication", async () => {
      const { listComments } = await import("@/lib/interactions")
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        hasMore: false,
        nextCursor: null,
      })

      // 不设置用户，验证 GET 请求不需要认证
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      // Test both endpoints
      const directRequest = new NextRequest(
        "http://localhost/api/comments?targetType=activity&targetId=activity1",
        { method: "GET" }
      )
      const directResponse = await getComments(directRequest)

      const activityRequest = new NextRequest(
        "http://localhost/api/activities/activity1/comments",
        { method: "GET" }
      )
      const activityResponse = await getActivityComments(activityRequest, {
        params: { id: "activity1" },
      })

      // 验证都允许未认证的 GET 请求
      expect(directResponse.status).toBe(200)
      expect(activityResponse.status).toBe(200)
    })

    it("should require authentication for write operations", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      // Test POST
      const postRequest = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "activity",
          targetId: "activity1",
          content: "Test",
        }),
      })
      const postResponse = await createComment(postRequest)

      // Test DELETE
      const deleteRequest = new NextRequest("http://localhost/api/comments/comment1", {
        method: "DELETE",
      })
      const deleteResponse = await deleteComment(deleteRequest, { params: { id: "comment1" } })

      // 验证都需要认证
      expect(postResponse.status).toBe(401)
      expect(deleteResponse.status).toBe(401)
    })
  })
})
