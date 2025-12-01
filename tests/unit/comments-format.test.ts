/**
 * formatComment 函数单元测试
 *
 * 验证软删除标记与可见性逻辑
 */

import { describe, it, expect } from "vitest"
import { formatComment, type PrismaCommentWithAuthor } from "@/lib/interactions/comments"

describe("formatComment", () => {
  const baseComment: PrismaCommentWithAuthor = {
    id: "comment-123",
    content: "这是一条测试评论",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    deletedAt: null,
    authorId: "user-123",
    postId: "post-123",
    activityId: null,
    parentId: null,
    author: {
      id: "user-123",
      name: "测试用户",
      email: "test@example.com",
      avatarUrl: "https://example.com/avatar.jpg",
      role: "USER",
    },
    _count: {
      replies: 0,
    },
  }

  describe("软删除评论", () => {
    it("应该保留原始 content", () => {
      const deletedComment: PrismaCommentWithAuthor = {
        ...baseComment,
        deletedAt: new Date("2025-01-02T00:00:00Z"),
      }

      const formatted = formatComment(deletedComment)

      expect(formatted.content).toBe(deletedComment.content)
    })

    it("应该设置 isDeleted 为 true", () => {
      const deletedComment: PrismaCommentWithAuthor = {
        ...baseComment,
        deletedAt: new Date("2025-01-02T00:00:00Z"),
      }

      const formatted = formatComment(deletedComment)

      expect(formatted.isDeleted).toBe(true)
    })

    it("应该保留其他字段不变", () => {
      const deletedComment: PrismaCommentWithAuthor = {
        ...baseComment,
        deletedAt: new Date("2025-01-02T00:00:00Z"),
      }

      const formatted = formatComment(deletedComment)

      expect(formatted.id).toBe(deletedComment.id)
      expect(formatted.authorId).toBe(deletedComment.authorId)
      expect(formatted.createdAt).toEqual(deletedComment.createdAt)
      expect(formatted.author).toEqual(deletedComment.author)
    })

    it("应该正确解析 targetType 和 targetId（Post）", () => {
      const deletedComment: PrismaCommentWithAuthor = {
        ...baseComment,
        postId: "post-123",
        activityId: null,
        deletedAt: new Date("2025-01-02T00:00:00Z"),
      }

      const formatted = formatComment(deletedComment)

      expect(formatted.targetType).toBe("post")
      expect(formatted.targetId).toBe("post-123")
    })

    it("应该正确解析 targetType 和 targetId（Activity）", () => {
      const deletedComment: PrismaCommentWithAuthor = {
        ...baseComment,
        postId: null,
        activityId: "activity-123",
        deletedAt: new Date("2025-01-02T00:00:00Z"),
      }

      const formatted = formatComment(deletedComment)

      expect(formatted.targetType).toBe("activity")
      expect(formatted.targetId).toBe("activity-123")
    })
  })

  describe("正常评论", () => {
    it("应该保持原始 content", () => {
      const activeComment: PrismaCommentWithAuthor = {
        ...baseComment,
        content: "这是原始评论内容",
        deletedAt: null,
      }

      const formatted = formatComment(activeComment)

      expect(formatted.content).toBe("这是原始评论内容")
    })

    it("应该设置 isDeleted 为 false", () => {
      const activeComment: PrismaCommentWithAuthor = {
        ...baseComment,
        deletedAt: null,
      }

      const formatted = formatComment(activeComment)

      expect(formatted.isDeleted).toBe(false)
    })

    it("应该正确处理空 author", () => {
      const commentWithoutAuthor: PrismaCommentWithAuthor = {
        ...baseComment,
        author: null,
      }

      const formatted = formatComment(commentWithoutAuthor)

      expect(formatted.author).toBeNull()
      expect(formatted.isDeleted).toBe(false)
    })

    it("应该正确处理 _count.replies", () => {
      const commentWithReplies: PrismaCommentWithAuthor = {
        ...baseComment,
        _count: {
          replies: 5,
        },
      }

      const formatted = formatComment(commentWithReplies)

      expect(formatted._count?.replies).toBe(5)
      expect(formatted.childrenCount).toBe(5)
    })

    it("应该处理缺失的 _count", () => {
      const commentWithoutCount: PrismaCommentWithAuthor = {
        ...baseComment,
        _count: null,
      }

      const formatted = formatComment(commentWithoutCount)

      expect(formatted._count?.replies).toBe(0)
      expect(formatted.childrenCount).toBe(0)
    })
  })

  describe("边界情况", () => {
    it("应该处理空字符串 content", () => {
      const emptyContentComment: PrismaCommentWithAuthor = {
        ...baseComment,
        content: "",
        deletedAt: null,
      }

      const formatted = formatComment(emptyContentComment)

      expect(formatted.content).toBe("")
      expect(formatted.isDeleted).toBe(false)
    })

    it("应该处理很长的 content", () => {
      const longContent = "a".repeat(10000)
      const longContentComment: PrismaCommentWithAuthor = {
        ...baseComment,
        content: longContent,
        deletedAt: null,
      }

      const formatted = formatComment(longContentComment)

      expect(formatted.content).toBe(longContent)
      expect(formatted.isDeleted).toBe(false)
    })

    it("软删除时应该保留原始 content 长度", () => {
      const longContent = "a".repeat(10000)
      const deletedLongComment: PrismaCommentWithAuthor = {
        ...baseComment,
        content: longContent,
        deletedAt: new Date("2025-01-02T00:00:00Z"),
      }

      const formatted = formatComment(deletedLongComment)

      expect(formatted.content).toBe(longContent)
      expect(formatted.content.length).toBe(longContent.length)
    })

    it("应该处理特殊字符 content", () => {
      const specialContent = "<script>alert('xss')</script>\n\t换行和制表符"
      const specialComment: PrismaCommentWithAuthor = {
        ...baseComment,
        content: specialContent,
        deletedAt: null,
      }

      const formatted = formatComment(specialComment)

      expect(formatted.content).toBe(specialContent)
    })
  })

  describe("返回值结构", () => {
    it("应该包含所有必需字段", () => {
      const formatted = formatComment(baseComment)

      expect(formatted).toHaveProperty("id")
      expect(formatted).toHaveProperty("content")
      expect(formatted).toHaveProperty("isDeleted")
      expect(formatted).toHaveProperty("targetType")
      expect(formatted).toHaveProperty("targetId")
      expect(formatted).toHaveProperty("author")
      expect(formatted).toHaveProperty("_count")
      expect(formatted).toHaveProperty("childrenCount")
    })

    it("应该将 replies 设置为 undefined", () => {
      const formatted = formatComment(baseComment)

      expect(formatted.replies).toBeUndefined()
    })

    it("_count.replies 应该等于 childrenCount", () => {
      const commentWithReplies: PrismaCommentWithAuthor = {
        ...baseComment,
        _count: {
          replies: 3,
        },
      }

      const formatted = formatComment(commentWithReplies)

      expect(formatted._count?.replies).toBe(formatted.childrenCount)
    })
  })
})
