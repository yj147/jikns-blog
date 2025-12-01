/**
 * 评论服务单元测试
 * 覆盖 createComment/listComments/deleteComment 的正常与异常分支
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createComment,
  listComments,
  deleteComment,
  getCommentCount,
  CommentServiceError,
  CommentErrorCode,
  type CreateCommentData,
  type CommentQueryOptions,
} from "@/lib/interactions/comments"
import { prisma } from "@/lib/prisma"
import { cleanXSS } from "@/lib/security/xss-cleaner"
import { logger } from "@/lib/utils/logger"

// Mock 依赖
vi.mock("@/lib/prisma", () => {
  const comment = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  }

  const post = {
    findUnique: vi.fn(),
    update: vi.fn(),
  }

  const activity = {
    findUnique: vi.fn(),
    update: vi.fn(),
  }

  const prismaMock = {
    comment,
    post,
    activity,
    $transaction: vi.fn(async (fn: any) => fn({ comment, post, activity })),
  }

  return {
    prisma: prismaMock,
    default: prismaMock,
  }
})

vi.mock("@/lib/security/xss-cleaner", () => ({
  cleanXSS: vi.fn((content: string) => content + "_cleaned"),
}))

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe("评论服务测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createComment", () => {
    const baseCreateData: CreateCommentData = {
      targetType: "post",
      targetId: "post-1",
      content: "Test comment",
      authorId: "user-1",
    }

    it("应该成功创建文章评论", async () => {
      const mockPost = { id: "post-1" }
      const mockComment = {
        id: "comment-1",
        content: "Test comment_cleaned",
        authorId: "user-1",
        postId: "post-1",
        parentId: null,
        deletedAt: null,
        author: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          avatarUrl: "avatar.jpg",
          role: "USER",
        },
      }

      vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost as any)
      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment as any)

      const result = await createComment(baseCreateData)

      // 验证 XSS 清理
      expect(cleanXSS).toHaveBeenCalledWith("Test comment")

      // 验证目标存在性检查
      expect(prisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: "post-1" },
        select: { id: true },
      })

      // 验证评论创建
      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          content: "Test comment_cleaned",
          authorId: "user-1",
          parentId: undefined,
          postId: "post-1",
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
              role: true,
            },
          },
        },
      })

      // 验证日志记录
      expect(logger.info).toHaveBeenCalledWith("评论创建成功", {
        commentId: "comment-1",
        targetType: "post",
        targetId: "post-1",
        authorId: "user-1",
      })

      expect(result).toMatchObject({
        id: "comment-1",
        isDeleted: false,
        targetType: "post",
        targetId: "post-1",
        authorId: "user-1",
        content: "Test comment_cleaned",
        _count: { replies: 0 },
        author: {
          email: "test@example.com",
        },
      })
    })

    it("应该成功创建动态评论并更新计数", async () => {
      const mockActivity = { id: "activity-1", commentsCount: 5 }
      const mockComment = {
        id: "comment-2",
        content: "Activity comment_cleaned",
        authorId: "user-2",
        activityId: "activity-1",
        parentId: null,
        deletedAt: null,
        author: {
          id: "user-2",
          name: "User 2",
          email: "user2@example.com",
          avatarUrl: null,
          role: "USER",
        },
      }

      vi.mocked(prisma.activity.findUnique).mockResolvedValue(mockActivity as any)
      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment as any)

      const result = await createComment({
        targetType: "activity",
        targetId: "activity-1",
        content: "Activity comment",
        authorId: "user-2",
      })

      expect(result).toMatchObject({
        id: "comment-2",
        isDeleted: false,
        targetType: "activity",
        targetId: "activity-1",
        author: { email: "user2@example.com" },
      })
    })

    it("应该成功创建回复评论", async () => {
      const mockPost = { id: "post-1" }
      const mockParentComment = {
        id: "parent-comment",
        postId: "post-1",
        activityId: null,
        deletedAt: null,
      }
      const mockReply = {
        id: "reply-1",
        content: "Reply_cleaned",
        authorId: "user-3",
        postId: "post-1",
        parentId: "parent-comment",
        deletedAt: null,
        author: {
          id: "user-3",
          name: "User 3",
          avatarUrl: null,
          email: "user3@example.com",
          role: "USER",
        },
      }

      vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost as any)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockParentComment as any)
      vi.mocked(prisma.comment.create).mockResolvedValue(mockReply as any)

      const result = await createComment({
        ...baseCreateData,
        content: "Reply",
        authorId: "user-3",
        parentId: "parent-comment",
      })

      // 验证父评论存在性检查
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: "parent-comment" },
        select: {
          id: true,
          postId: true,
          activityId: true,
          deletedAt: true,
        },
      })

      expect(result.parentId).toBe("parent-comment")
    })

    it("应该阻止回复已被软删除的父评论", async () => {
      const mockPost = { id: "post-1" }
      const deletedParent = {
        id: "parent-comment",
        postId: "post-1",
        activityId: null,
        deletedAt: new Date(),
      }

      vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost as any)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(deletedParent as any)

      await expect(
        createComment({
          ...baseCreateData,
          content: "Reply",
          authorId: "user-3",
          parentId: "parent-comment",
        })
      ).rejects.toMatchObject({
        code: CommentErrorCode.PARENT_DELETED,
        status: 409,
      } as Partial<CommentServiceError>)
    })

    it("应该在目标不存在时抛出错误", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(null)

      await expect(createComment(baseCreateData)).rejects.toMatchObject({
        code: CommentErrorCode.TARGET_NOT_FOUND,
        status: 404,
      } as Partial<CommentServiceError>)

      expect(logger.warn).toHaveBeenCalled()
    })

    it("应该在父评论不存在时抛出错误", async () => {
      const mockPost = { id: "post-1" }

      vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost as any)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

      await expect(
        createComment({
          ...baseCreateData,
          parentId: "non-existent-parent",
        })
      ).rejects.toMatchObject({
        code: CommentErrorCode.PARENT_NOT_FOUND,
        status: 404,
      } as Partial<CommentServiceError>)
    })

    it("应该在父评论不属于同一目标时抛出错误", async () => {
      const mockPost = { id: "post-1" }
      const mockParentComment = {
        id: "parent-comment",
        postId: "post-2", // 不同的文章
        activityId: null,
      }

      vi.mocked(prisma.post.findUnique).mockResolvedValue(mockPost as any)
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockParentComment as any)

      await expect(
        createComment({
          ...baseCreateData,
          parentId: "parent-comment",
        })
      ).rejects.toMatchObject({
        code: CommentErrorCode.PARENT_MISMATCH,
        status: 400,
      } as Partial<CommentServiceError>)
    })
  })

  describe("listComments", () => {
    const baseQueryOptions: CommentQueryOptions = {
      targetType: "post",
      targetId: "post-1",
      limit: 10,
    }

    beforeEach(() => {
      vi.mocked(prisma.comment.count).mockResolvedValue(0)
      vi.mocked(prisma.comment.groupBy).mockResolvedValue([] as any)
    })

    it("应该获取文章的顶级评论列表", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "First comment",
          authorId: "user-1",
          postId: "post-1",
          parentId: null,
          createdAt: new Date("2024-01-02"),
          author: {
            id: "user-1",
            name: "User 1",
            email: "user1@example.com",
            avatarUrl: "avatar1.jpg",
            role: "USER",
          },
        },
        {
          id: "comment-2",
          content: "Second comment",
          authorId: "user-2",
          postId: "post-1",
          parentId: null,
          createdAt: new Date("2024-01-01"),
          author: {
            id: "user-2",
            name: "User 2",
            email: "user2@example.com",
            avatarUrl: null,
            role: "USER",
          },
        },
      ]

      vi.mocked(prisma.comment.count)
        .mockResolvedValueOnce(mockComments.length)
        .mockResolvedValueOnce(0)
      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockComments as any)

      const result = await listComments(baseQueryOptions)

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          postId: "post-1",
          parentId: null,
          deletedAt: null,
        },
        take: 11,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              replies: {
                where: { deletedAt: null },
              },
            },
          },
        },
      })

      expect(prisma.comment.count).toHaveBeenNthCalledWith(1, {
        where: {
          postId: "post-1",
          deletedAt: null,
          parentId: null,
        },
      })
      expect(prisma.comment.count).toHaveBeenNthCalledWith(2, {
        where: {
          postId: "post-1",
          deletedAt: null,
          parentId: { not: null },
          parent: {
            postId: "post-1",
            deletedAt: null,
          },
        },
      })

      expect(result.comments).toHaveLength(2)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeUndefined()
      expect(result.comments[0].isDeleted).toBe(false)
      expect(result.comments[0].author?.email).toBe("user1@example.com")
      expect(result.comments[0]).toMatchObject({ targetType: "post", targetId: "post-1" })
      expect(result.totalCount).toBe(2)
    })

    it("应该支持游标分页", async () => {
      const mockComments = Array.from({ length: 11 }, (_, i) => ({
        id: `comment-${i}`,
        content: `Comment ${i}`,
        authorId: "user-1",
        postId: "post-1",
        parentId: null,
        createdAt: new Date(2024, 0, 11 - i),
      }))

      vi.mocked(prisma.comment.count)
        .mockResolvedValueOnce(mockComments.length)
        .mockResolvedValueOnce(0)
      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockComments as any)

      const result = await listComments({
        ...baseQueryOptions,
        cursor: "comment-0",
        includeAuthor: false,
      })

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          postId: "post-1",
          parentId: null,
          deletedAt: null,
        },
        take: 11,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        cursor: { id: "comment-0" },
        skip: 1,
        include: {
          _count: {
            select: {
              replies: {
                where: { deletedAt: null },
              },
            },
          },
        },
      })

      const callArgs = vi.mocked(prisma.comment.findMany).mock.calls[0]?.[0]
      expect(callArgs?.include?.author).toBeUndefined()

      expect(result.comments).toHaveLength(10)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe("comment-9")
      expect(result.comments.every((item) => item.author === null)).toBe(true)
      expect(result.totalCount).toBe(11)
    })

    it("应该包含回复（includeReplies=true）", async () => {
      const mockTopComments = [
        {
          id: "comment-1",
          content: "Top comment",
          authorId: "user-1",
          postId: "post-1",
          parentId: null,
          author: {
            id: "user-1",
            name: "User 1",
            email: "user1@example.com",
            avatarUrl: null,
            role: "USER",
          },
        },
      ]

      const mockReplies = [
        {
          id: "reply-1",
          content: "Reply 1",
          authorId: "user-2",
          postId: "post-1",
          parentId: "comment-1",
          author: {
            id: "user-2",
            name: "User 2",
            email: "user2@example.com",
            avatarUrl: null,
            role: "USER",
          },
        },
        {
          id: "reply-2",
          content: "Reply 2",
          authorId: "user-3",
          postId: "post-1",
          parentId: "comment-1",
          author: {
            id: "user-3",
            name: "User 3",
            email: "user3@example.com",
            avatarUrl: null,
            role: "USER",
          },
        },
      ]

      vi.mocked(prisma.comment.count)
        .mockResolvedValueOnce(mockTopComments.length)
        .mockResolvedValueOnce(mockReplies.length)
      vi.mocked(prisma.comment.findMany)
        .mockResolvedValueOnce(mockTopComments as any)
        .mockResolvedValueOnce(mockReplies as any)

      const result = await listComments({
        ...baseQueryOptions,
        includeReplies: true,
      })

      // 验证获取顶级评论
      expect(prisma.comment.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          postId: "post-1",
          parentId: null,
          deletedAt: null,
        },
        take: 11,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              replies: {
                where: { deletedAt: null },
              },
            },
          },
        },
      })

      // 验证获取回复
      expect(prisma.comment.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          parentId: { in: ["comment-1"] },
          deletedAt: null,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              replies: {
                where: { deletedAt: null },
              },
            },
          },
        },
      })

      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].replies).toHaveLength(2)
      expect(result.comments[0].replies?.[0].isDeleted).toBe(false)
      expect(result.totalCount).toBe(3)
    })

    it("应该过滤掉软删除的评论", async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([])

      await listComments(baseQueryOptions)

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId: baseQueryOptions.targetId,
            parentId: null,
            deletedAt: null,
          }),
        })
      )
    })

    it("应该处理动态评论查询", async () => {
      vi.mocked(prisma.comment.findMany).mockResolvedValue([])

      await listComments({
        targetType: "activity",
        targetId: "activity-1",
        limit: 20,
      })

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          activityId: "activity-1",
          parentId: null,
          deletedAt: null,
        },
        take: 21,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: {
              replies: {
                where: { deletedAt: null },
              },
            },
          },
        },
      })
    })

    it("应该处理查询错误", async () => {
      const error = new Error("Database error")
      vi.mocked(prisma.comment.findMany).mockRejectedValue(error)

      await expect(listComments(baseQueryOptions)).rejects.toThrow("Database error")
      expect(logger.error).toHaveBeenCalledWith("获取评论列表失败", error)
    })
  })

  describe("deleteComment", () => {
    it("应该硬删除没有回复的评论（作者删除）", async () => {
      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        postId: "post-1",
        activityId: null,
        content: "To be deleted",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.count).mockResolvedValue(0) // 没有回复
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment as any)

      await deleteComment("comment-1", "user-1", false)

      // 验证权限检查通过（作者本人）
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: "comment-1" },
        select: {
          id: true,
          authorId: true,
          postId: true,
          activityId: true,
        },
      })

      // 验证检查回复数量
      expect(prisma.comment.count).toHaveBeenCalledWith({
        where: { parentId: "comment-1" },
      })

      // 验证硬删除
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: "comment-1" },
      })

      // 验证日志
      expect(logger.info).toHaveBeenCalledWith("评论删除成功", {
        commentId: "comment-1",
        userId: "user-1",
        isAdmin: false,
        softDelete: false,
      })
    })

    it("应该软删除有回复的评论", async () => {
      const mockComment = {
        id: "comment-2",
        authorId: "user-2",
        postId: "post-1",
        activityId: null,
        content: "Has replies",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.count).mockResolvedValue(3) // 有3个回复
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        deletedAt: new Date(),
      } as any)

      await deleteComment("comment-2", "user-2", false)

      // 验证软删除（只设置 deletedAt，不修改 content）
      // 根据软删除可见性策略，content 在 formatComment 中动态替换为占位符
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: "comment-2" },
        data: {
          deletedAt: expect.any(Date),
        },
      })

      // 验证没有调用硬删除
      expect(prisma.comment.delete).not.toHaveBeenCalled()

      // 验证日志
      expect(logger.info).toHaveBeenCalledWith("评论删除成功", {
        commentId: "comment-2",
        userId: "user-2",
        isAdmin: false,
        softDelete: true,
      })
    })

    it("应该允许管理员删除他人评论", async () => {
      const mockComment = {
        id: "comment-3",
        authorId: "user-other",
        activityId: "activity-1",
        postId: null,
        content: "Other user comment",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.count).mockResolvedValue(0)
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment as any)
      await deleteComment("comment-3", "admin-user", true)

      // 验证删除成功（管理员权限）
      expect(prisma.comment.delete).toHaveBeenCalled()
      expect(prisma.activity.update).not.toHaveBeenCalled()
    })

    it("应该拒绝非作者非管理员的删除请求", async () => {
      const mockComment = {
        id: "comment-4",
        authorId: "user-owner",
        postId: "post-1",
        activityId: null,
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)

      await expect(deleteComment("comment-4", "user-other", false)).rejects.toMatchObject({
        code: CommentErrorCode.UNAUTHORIZED,
        status: 403,
      } as Partial<CommentServiceError>)

      expect(prisma.comment.delete).not.toHaveBeenCalled()
      expect(prisma.comment.update).not.toHaveBeenCalled()
    })

    it("应该在评论不存在时抛出错误", async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

      await expect(deleteComment("non-existent", "user-1", false)).rejects.toMatchObject({
        code: CommentErrorCode.COMMENT_NOT_FOUND,
        status: 404,
      } as Partial<CommentServiceError>)

      expect(logger.warn).toHaveBeenCalledWith("删除评论失败", {
        code: CommentErrorCode.COMMENT_NOT_FOUND,
        status: 404,
        context: { commentId: "non-existent" },
      })
    })
  })

  describe("getCommentCount", () => {
    it("应该返回文章的评论数量（包含软删除）", async () => {
      vi.mocked(prisma.comment.count).mockResolvedValue(42)

      const count = await getCommentCount("post", "post-1")

      expect(prisma.comment.count).toHaveBeenCalledWith({
        where: {
          postId: "post-1",
          // 注意：不过滤 deletedAt，计数包含软删除评论
        },
      })

      expect(count).toBe(42)
    })

    it("应该返回动态的评论数量（包含软删除）", async () => {
      vi.mocked(prisma.comment.count).mockResolvedValue(15)

      const count = await getCommentCount("activity", "activity-1")

      expect(prisma.comment.count).toHaveBeenCalledWith({
        where: {
          activityId: "activity-1",
          // 注意：不过滤 deletedAt，计数包含软删除评论
        },
      })

      expect(count).toBe(15)
    })
  })
})
