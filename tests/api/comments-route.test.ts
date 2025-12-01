import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { AuthError } from "@/lib/error-handling/auth-error"
import { ErrorCode } from "@/lib/api/unified-response"
import * as commentLimits from "@/lib/rate-limit/comment-limits"
import { CommentServiceError, CommentErrorCode } from "@/lib/interactions/comments"

const hoistedMocks = vi.hoisted(() => ({
  mockGetOptionalViewer: vi.fn(),
  mockAssertPolicy: vi.fn(),
  mockGenerateRequestId: vi.fn(() => "req-test-id"),
}))

const POST_ID = "c123456789012345678901234"
const POST_ID_ALT = "c123456789012345678901235"
const ACTIVITY_ID = "c223456789012345678901234"
const ACTIVITY_ID_ALT = "c223456789012345678901235"
const COMMENT_ID = "c323456789012345678901234"
const COMMENT_ID_ALT = "c323456789012345678901235"
const USER_ID = "c423456789012345678901234"
const USER_ID_ALT = "c423456789012345678901235"
const ADMIN_ID = "c523456789012345678901234"
const BANNED_USER_ID = "c623456789012345678901234"
const NON_EXISTENT_ID = "c723456789012345678901234"

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session")
  return {
    ...actual,
    fetchAuthenticatedUser: actual.fetchAuthenticatedUser,
    getOptionalViewer: hoistedMocks.mockGetOptionalViewer,
    assertPolicy: hoistedMocks.mockAssertPolicy,
    generateRequestId: hoistedMocks.mockGenerateRequestId,
  }
})

vi.mock("@/lib/interactions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/interactions")>("@/lib/interactions")
  return {
    ...actual,
    createComment: vi.fn(),
    listComments: vi.fn(() =>
      Promise.resolve({
        comments: [],
        totalCount: 0,
        hasMore: false,
      })
    ),
    deleteComment: vi.fn(),
  }
})

vi.mock("@/lib/audit-log", () => ({
  auditLogger: {
    logEvent: vi.fn().mockResolvedValue(undefined),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

import { GET as getComments, POST as postComment } from "@/app/api/comments/route"
import { DELETE as deleteComment } from "@/app/api/comments/[id]/route"

const { mockGetOptionalViewer, mockAssertPolicy, mockGenerateRequestId } = hoistedMocks

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

import { prisma } from "@/lib/prisma"
import {
  listComments,
  createComment,
  deleteComment as deleteCommentService,
} from "@/lib/interactions"

describe("评论API路由契约测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetOptionalViewer.mockResolvedValue(null)
    mockAssertPolicy.mockResolvedValue([
      {
        id: USER_ID,
        email: "active@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "Active User",
        avatarUrl: null,
      } as any,
      null,
    ])
    mockGenerateRequestId.mockImplementation(() => "req-test-id")
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
          id: COMMENT_ID,
          content: "测试评论1",
          authorId: USER_ID,
          targetType: "post",
          targetId: POST_ID,
          activityId: null,
          postId: POST_ID,
          parentId: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: USER_ID,
            name: "用户1",
            email: "user1@example.com",
            avatarUrl: null,
            role: "USER",
          },
          childrenCount: 0,
          _count: { replies: 0 },
        },
      ]

      vi.mocked(listComments).mockResolvedValue({
        comments: mockComments,
        totalCount: 1,
        hasMore: false,
      })

      const request = new NextRequest(
        `http://localhost:3000/api/comments?targetType=post&targetId=${POST_ID}`
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
        totalCount: 0,
        hasMore: false,
      })

      const request = new NextRequest(
        `http://localhost:3000/api/comments?targetType=post&targetId=${POST_ID}&cursor=abc&limit=5`
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "post",
          targetId: POST_ID,
          cursor: "abc",
          limit: 5,
        })
      )
    })

    it("应该支持includeReplies参数", async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        totalCount: 0,
        hasMore: false,
      })

      const request = new NextRequest(
        `http://localhost:3000/api/comments?targetType=post&targetId=${POST_ID}&includeReplies=true`
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "post",
          targetId: POST_ID,
          includeReplies: true,
        })
      )
    })

    it("应该透传 parentId 参数", async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        totalCount: 0,
        hasMore: false,
        nextCursor: null,
      })

      const request = new NextRequest(
        `http://localhost:3000/api/comments?targetType=post&targetId=${POST_ID}&parentId=${COMMENT_ID}`
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "post",
          targetId: POST_ID,
          parentId: COMMENT_ID,
        })
      )
    })

    it("缺省 cursor/parentId 时应该返回 200", async () => {
      vi.mocked(listComments).mockResolvedValue({
        comments: [],
        totalCount: 0,
        hasMore: false,
      })

      const request = new NextRequest(
        `http://localhost:3000/api/comments?targetType=post&targetId=${POST_ID}`
      )
      const response = await getComments(request)

      expect(response.status).toBe(200)
      expect(listComments).toHaveBeenCalled()
    })
  })

  describe("POST /api/comments - 需要认证", () => {
    it("应该返回401当用户未登录", async () => {
      mockAssertPolicy.mockResolvedValue([
        null,
        new AuthError("请先登录", "UNAUTHORIZED", 401, { requestId: "req-unauth" }),
      ])

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          targetType: "post",
          targetId: POST_ID,
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("应该返回403当用户被封禁", async () => {
      mockAssertPolicy.mockResolvedValue([
        null,
        new AuthError("账号状态异常", "ACCOUNT_BANNED", 403, {
          requestId: "req-banned",
          userId: USER_ID,
        }),
      ])

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          targetType: "post",
          targetId: POST_ID,
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")
    })

    it("应该允许ACTIVE用户创建评论", async () => {
      const activeUser = {
        id: USER_ID,
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "用户1",
        avatarUrl: null,
      } as any

      mockAssertPolicy.mockResolvedValue([activeUser, null])

      const mockComment = {
        id: COMMENT_ID,
        content: "新评论",
        authorId: USER_ID,
        targetType: "post",
        targetId: POST_ID,
        postId: POST_ID,
        activityId: null,
        parentId: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: {
          id: USER_ID,
          name: "用户1",
          email: "test@example.com",
          avatarUrl: null,
          role: "USER",
        },
        _count: { replies: 0 },
        childrenCount: 0,
      }

      vi.mocked(createComment).mockResolvedValue(mockComment as any)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          targetType: "post",
          targetId: POST_ID,
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: USER_ID,
          content: "新评论",
          targetType: "post",
          targetId: POST_ID,
        })
      )
    })

    it("应该允许ADMIN用户创建评论", async () => {
      const adminUser = {
        id: ADMIN_ID,
        email: "admin@example.com",
        role: "ADMIN",
        status: "ACTIVE",
        name: "管理员",
        avatarUrl: null,
      } as any

      mockAssertPolicy.mockResolvedValue([adminUser, null])

      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: POST_ID } as any)
      vi.mocked(createComment).mockResolvedValue({
        id: COMMENT_ID_ALT,
        content: "管理员评论",
        authorId: ADMIN_ID,
        targetType: "post",
        targetId: POST_ID,
        postId: POST_ID,
        activityId: null,
        parentId: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: {
          id: ADMIN_ID,
          name: "管理员",
          email: "admin@example.com",
          avatarUrl: null,
          role: "ADMIN",
        },
        _count: { replies: 0 },
        childrenCount: 0,
      } as any)

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "管理员评论",
          targetType: "post",
          targetId: POST_ID,
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it("达到限流时应该返回429并包含retryAfter", async () => {
      const activeUser = {
        id: USER_ID,
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "用户1",
        avatarUrl: null,
      } as any

      mockAssertPolicy.mockResolvedValue([activeUser, null])

      const rateSpy = vi
        .spyOn(commentLimits, "checkCommentRate")
        .mockResolvedValue({ allowed: false, retryAfter: 42 })

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "受限评论",
          targetType: "post",
          targetId: POST_ID,
        }),
      })

      const response = await postComment(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(data.error.details.retryAfter).toBe(42)
      expect(rateSpy).toHaveBeenCalled()

      rateSpy.mockRestore()
    })
  })

  describe("DELETE /api/comments/[id] - 需要认证", () => {
    it("应该允许作者删除自己的评论（软删除）", async () => {
      vi.mocked(deleteCommentService).mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: COMMENT_ID } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(deleteCommentService).toHaveBeenCalledWith(COMMENT_ID, USER_ID, false)
    })

    it("应该允许ADMIN删除任何评论（硬删除）", async () => {
      const adminUser = {
        id: ADMIN_ID,
        email: "admin@example.com",
        role: "ADMIN" as const,
        status: "ACTIVE" as const,
        name: "管理员",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValueOnce([adminUser as any, null])

      vi.mocked(deleteCommentService).mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: COMMENT_ID } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(deleteCommentService).toHaveBeenCalledWith(COMMENT_ID, ADMIN_ID, true)
    })

    it("应该拒绝非作者删除他人评论（403）", async () => {
      const otherUser = {
        id: USER_ID_ALT,
        email: "other@example.com",
        role: "USER" as const,
        status: "ACTIVE" as const,
        name: "Other",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValueOnce([otherUser as any, null])
      vi.mocked(deleteCommentService).mockRejectedValue(
        new CommentServiceError(
          CommentErrorCode.UNAUTHORIZED,
          "Unauthorized to delete this comment",
          403,
          { commentId: COMMENT_ID, userId: USER_ID_ALT }
        )
      )

      const request = new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: COMMENT_ID } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")
      expect(data.error.details.commentErrorCode).toBe(CommentErrorCode.UNAUTHORIZED)
    })

    it("应该返回404当评论不存在", async () => {
      vi.mocked(deleteCommentService).mockRejectedValue(
        new CommentServiceError(CommentErrorCode.COMMENT_NOT_FOUND, "Comment not found", 404, {
          commentId: NON_EXISTENT_ID,
        })
      )

      const request = new NextRequest(`http://localhost:3000/api/comments/${NON_EXISTENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: NON_EXISTENT_ID } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("NOT_FOUND")
      expect(data.error.details.commentErrorCode).toBe(CommentErrorCode.COMMENT_NOT_FOUND)
    })

    it("应该在硬删除时更新活动计数", async () => {
      const adminUser = {
        id: ADMIN_ID,
        email: "admin@example.com",
        role: "ADMIN" as const,
        status: "ACTIVE" as const,
        name: "管理员",
        avatarUrl: null,
      }

      mockAssertPolicy.mockResolvedValueOnce([adminUser as any, null])

      vi.mocked(deleteCommentService).mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: COMMENT_ID } })

      expect(response.status).toBe(200)
      expect(deleteCommentService).toHaveBeenCalledWith(COMMENT_ID, ADMIN_ID, true)
    })

    it("应在认证失败时返回401", async () => {
      mockAssertPolicy.mockResolvedValueOnce([
        null,
        new AuthError("请先登录", "UNAUTHORIZED", 401, { requestId: "req-unauth" }),
      ])

      const request = new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: COMMENT_ID } })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED)
      expect(deleteCommentService).not.toHaveBeenCalled()
    })

    it("应在达到删除限流时返回429", async () => {
      vi.spyOn(commentLimits, "checkCommentRate").mockResolvedValueOnce({
        allowed: false,
        retryAfter: 30,
      })

      const request = new NextRequest(`http://localhost:3000/api/comments/${COMMENT_ID}`, {
        method: "DELETE",
      })

      const response = await deleteComment(request, { params: { id: COMMENT_ID } })
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
      expect(body.error.details.retryAfter).toBe(30)
      expect(deleteCommentService).not.toHaveBeenCalled()
    })
  })

  describe("Activity 评论场景测试", () => {
    describe("GET /api/comments - 获取动态评论", () => {
      it("应该返回动态的评论列表", async () => {
        const mockComments = [
          {
            id: COMMENT_ID,
            content: "动态评论1",
            authorId: USER_ID,
            targetType: "activity",
            targetId: ACTIVITY_ID,
            postId: null,
            activityId: ACTIVITY_ID,
            parentId: null,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: {
              id: USER_ID,
              name: "用户1",
              email: "user1@example.com",
              avatarUrl: null,
              role: "USER",
            },
            childrenCount: 0,
            _count: { replies: 0 },
          },
          {
            id: COMMENT_ID_ALT,
            content: "动态评论2",
            authorId: USER_ID_ALT,
            targetType: "activity",
            targetId: ACTIVITY_ID,
            postId: null,
            activityId: ACTIVITY_ID,
            parentId: null,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: {
              id: USER_ID_ALT,
              name: "用户2",
              email: "user2@example.com",
              avatarUrl: null,
              role: "USER",
            },
            childrenCount: 1,
            _count: { replies: 1 },
          },
        ]

        vi.mocked(listComments).mockResolvedValue({
          comments: mockComments,
          totalCount: 2,
          hasMore: false,
          nextCursor: null,
        })

        const request = new NextRequest(
          `http://localhost:3000/api/comments?targetType=activity&targetId=${ACTIVITY_ID}`
        )
        const response = await getComments(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()
        expect(listComments).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: "activity",
            targetId: ACTIVITY_ID,
            includeAuthor: true,
          })
        )
      })

      it("应该支持动态评论的分页", async () => {
        vi.mocked(listComments).mockResolvedValue({
          comments: [],
          totalCount: 0,
          hasMore: true,
          nextCursor: "next-cursor",
        })

        const request = new NextRequest(
          `http://localhost:3000/api/comments?targetType=activity&targetId=${ACTIVITY_ID}&cursor=prev-cursor&limit=10`
        )
        const response = await getComments(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(listComments).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: "activity",
            targetId: ACTIVITY_ID,
            cursor: "prev-cursor",
            limit: 10,
          })
        )
      })
    })

    describe("POST /api/comments - 创建动态评论", () => {
      it("应该允许登录用户评论动态", async () => {
        const activeUser = {
          id: USER_ID,
          email: "test@example.com",
          role: "USER",
          status: "ACTIVE",
          name: "用户1",
          avatarUrl: null,
        } as any

        mockAssertPolicy.mockResolvedValue([activeUser, null])

        const mockComment = {
          id: COMMENT_ID,
          content: "对动态的评论",
          authorId: USER_ID,
          targetType: "activity",
          targetId: ACTIVITY_ID,
          activityId: ACTIVITY_ID,
          postId: null,
          parentId: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: USER_ID,
            name: "用户1",
            email: "test@example.com",
            avatarUrl: null,
            role: "USER",
          },
          _count: { replies: 0 },
          childrenCount: 0,
        }

        vi.mocked(createComment).mockResolvedValue(mockComment as any)
        vi.mocked(prisma.activity.findUnique).mockResolvedValue({
          id: ACTIVITY_ID,
          content: "这是一条动态",
          authorId: USER_ID_ALT,
        } as any)

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "对动态的评论",
            targetType: "activity",
            targetId: ACTIVITY_ID,
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
            targetId: ACTIVITY_ID,
            authorId: USER_ID,
          })
        )
      })

      it("应该返回404当动态不存在", async () => {
        const activeUser = {
          id: USER_ID,
          email: "test@example.com",
          role: "USER",
          status: "ACTIVE",
          name: "用户1",
          avatarUrl: null,
        } as any

        mockAssertPolicy.mockResolvedValue([activeUser, null])

        vi.mocked(createComment).mockRejectedValue(
          new CommentServiceError(CommentErrorCode.TARGET_NOT_FOUND, "activity not found", 404, {
            targetType: "activity",
            targetId: NON_EXISTENT_ID,
          })
        )

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "对不存在动态的评论",
            targetType: "activity",
            targetId: NON_EXISTENT_ID,
          }),
        })

        const response = await postComment(request)

        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe(ErrorCode.TARGET_NOT_FOUND)
        expect(data.error.details.commentErrorCode).toBe(CommentErrorCode.TARGET_NOT_FOUND)
        expect(createComment).toHaveBeenCalled()
      })

      it("应该拒绝未登录用户评论动态", async () => {
        mockAssertPolicy.mockResolvedValue([
          null,
          new AuthError("请先登录", "UNAUTHORIZED", 401, { requestId: "req-no-login" }),
        ])

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "未登录评论",
            targetType: "activity",
            targetId: ACTIVITY_ID,
          }),
        })

        const response = await postComment(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe("UNAUTHORIZED")
      })

      it("应该拒绝被封禁用户评论动态", async () => {
        mockAssertPolicy.mockResolvedValue([
          null,
          new AuthError("账号状态异常", "ACCOUNT_BANNED", 403, {
            requestId: "req-banned",
            userId: BANNED_USER_ID,
          }),
        ])

        const request = new NextRequest("http://localhost:3000/api/comments", {
          method: "POST",
          body: JSON.stringify({
            content: "被封禁用户的评论",
            targetType: "activity",
            targetId: ACTIVITY_ID,
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
