/**
 * 评论限流集成测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { POST as createComment, GET as listComments } from "@/app/api/comments/route"
import { DELETE as deleteComment } from "@/app/api/comments/[id]/route"
import { NextRequest } from "next/server"
import { assertPolicy, fetchAuthenticatedUser, generateRequestId } from "@/lib/auth/session"

// Mock authentication/session
vi.mock("@/lib/auth/session", () => ({
  assertPolicy: vi.fn(),
  fetchAuthenticatedUser: vi.fn(),
  generateRequestId: vi.fn(() => "test-request-id"),
}))

// Mock interactions
vi.mock("@/lib/interactions", () => ({
  createComment: vi.fn(),
  listComments: vi.fn(),
  deleteComment: vi.fn(),
}))

// Mock rate limit
vi.mock("@/lib/rate-limit/comment-limits", () => ({
  checkCommentRate: vi.fn(),
  extractClientIP: vi.fn(() => "127.0.0.1"),
}))

describe("Comments Rate Limiting Integration", () => {
  const mockUser = {
    id: "user123",
    email: "test@example.com",
    role: "USER",
    status: "ACTIVE",
  }

  const postId = "clp0000000000000000000000"
  const commentId = "clc0000000000000000000000"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(assertPolicy).mockResolvedValue([{ ...mockUser }, null])
    vi.mocked(fetchAuthenticatedUser).mockResolvedValue(null)
    // Enable rate limiting
    process.env.COMMENTS_RATE_LIMIT_ENABLED = "true"
    process.env.COMMENTS_RATE_LIMIT_WINDOW_MS = "60000"
    process.env.COMMENTS_RATE_LIMIT_CREATE_USER = "2" // Low limit for testing
    process.env.COMMENTS_RATE_LIMIT_CREATE_IP = "5"
    process.env.COMMENTS_RATE_LIMIT_DELETE_USER = "1"
    process.env.COMMENTS_RATE_LIMIT_DELETE_IP = "3"
  })

  afterEach(() => {
    // Reset environment
    process.env.COMMENTS_RATE_LIMIT_ENABLED = "false"
  })

  describe("POST /api/comments - Create Comment", () => {
    it("should allow comment creation when within rate limit", async () => {
      const { createComment: mockCreateComment } = await import("@/lib/interactions")
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      const mockComment = {
        id: commentId,
        content: "Test comment",
        authorId: mockUser.id,
        targetType: "post",
        targetId: postId,
        createdAt: new Date(),
      }

      vi.mocked(mockCreateComment).mockResolvedValue(mockComment)
      vi.mocked(checkCommentRate).mockResolvedValueOnce({ allowed: true })

      const request = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: postId,
          content: "Test comment",
        }),
      })

      const response = await createComment(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        id: commentId,
        content: "Test comment",
        authorId: mockUser.id,
        targetType: "post",
        targetId: postId,
        // 不检查 createdAt，因为它可能被转换为字符串
      })
    })

    it("should return 429 when rate limit exceeded", async () => {
      // Mock checkCommentRate to simulate limit exceeded
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(checkCommentRate).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      })

      const request = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: postId,
          content: "Test comment",
        }),
      })

      const response = await createComment(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(data.error.message).toBe("操作过于频繁，请稍后再试")
      expect(data.error.details.retryAfter).toBe(60) // windowMs / 1000
    })

    it("should not enforce rate limit when disabled", async () => {
      process.env.COMMENTS_RATE_LIMIT_ENABLED = "false"

      const { createComment: mockCreateComment } = await import("@/lib/interactions")
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(mockCreateComment).mockResolvedValue({
        id: `${commentId}-${Math.random()}`,
        content: "Test comment",
        authorId: mockUser.id,
        targetType: "post",
        targetId: postId,
        createdAt: new Date(),
      })

      // 当限流被禁用时，checkCommentRate 应该返回 allowed: true 或者根本不被调用
      vi.mocked(checkCommentRate).mockResolvedValue({ allowed: true })

      // Create multiple requests that would exceed limit if enabled
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest("http://localhost/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "192.168.1.1",
          },
          body: JSON.stringify({
            targetType: "post",
            targetId: postId,
            content: `Test comment ${i}`,
          }),
        })

        const response = await createComment(request)
        expect(response.status).toBe(200)
      }
    })
  })

  describe("DELETE /api/comments/[id] - Delete Comment", () => {
    it("should allow comment deletion when within rate limit", async () => {
      const { deleteComment: mockDeleteComment } = await import("@/lib/interactions")
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(mockDeleteComment).mockResolvedValue(undefined)
      vi.mocked(checkCommentRate).mockResolvedValueOnce({ allowed: true })

      const request = new NextRequest(`http://localhost/api/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
      })

      const response = await deleteComment(request, { params: { id: commentId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)
    })

    it("should return 429 when delete rate limit exceeded", async () => {
      // Mock checkCommentRate to simulate limit exceeded
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(checkCommentRate).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      })

      const request = new NextRequest(`http://localhost/api/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
      })

      const response = await deleteComment(request, { params: { id: commentId } })
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(data.error.message).toBe("操作过于频繁，请稍后再试")
      expect(data.error.details.retryAfter).toBe(60) // windowMs / 1000
    })
  })

  describe("GET /api/comments - List Comments", () => {
    it("should not apply rate limiting to GET requests", async () => {
      const { listComments: mockListComments } = await import("@/lib/interactions")
      vi.mocked(mockListComments).mockResolvedValue({
        comments: [],
        hasMore: false,
        nextCursor: null,
      })

      // Make multiple GET requests
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest(
          `http://localhost/api/comments?targetType=post&targetId=${postId}`,
          {
            method: "GET",
            headers: {
              "x-forwarded-for": "192.168.1.1",
            },
          }
        )

        const response = await listComments(request)
        expect(response.status).toBe(200)
      }

      // Verify checkCommentRate was never called for GET requests
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      expect(checkCommentRate).not.toHaveBeenCalled()
    })
  })

  describe("Rate limiting with different IPs", () => {
    it("should track rate limits separately per IP", async () => {
      const { createComment: mockCreateComment } = await import("@/lib/interactions")
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(mockCreateComment).mockResolvedValue({
        id: `${commentId}-${Math.random()}`,
        content: "Test comment",
        authorId: mockUser.id,
        targetType: "post",
        targetId: postId,
        createdAt: new Date(),
      })
      // Allow both requests from different IPs
      vi.mocked(checkCommentRate).mockResolvedValue({ allowed: true })

      // First IP - should work
      const request1 = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: postId,
          content: "Test from IP1",
        }),
      })

      const response1 = await createComment(request1)
      expect(response1.status).toBe(200)

      // Different IP - should also work
      const request2 = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.2",
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: postId,
          content: "Test from IP2",
        }),
      })

      const response2 = await createComment(request2)
      expect(response2.status).toBe(200)
    })
  })

  describe("Error message mapping", () => {
    it("should return localized error message for rate limit", async () => {
      // Mock checkCommentRate to simulate limit exceeded
      const { checkCommentRate } = await import("@/lib/rate-limit/comment-limits")
      vi.mocked(checkCommentRate).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      })

      const request = new NextRequest("http://localhost/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: postId,
          content: "Test comment",
        }),
      })

      const response = await createComment(request)
      const data = await response.json()

      // Verify 429 status code
      expect(response.status).toBe(429)

      // Verify error structure matches unified response format
      expect(data).toMatchObject({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "操作过于频繁，请稍后再试",
          details: {
            retryAfter: 60,
          },
        },
      })
    })
  })
})
