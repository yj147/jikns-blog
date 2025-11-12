/**
 * 点赞服务层单元测试
 * 完整覆盖 likes 服务的所有公开方法
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  toggleLike,
  getLikeStatus,
  getLikeUsers,
  getBatchLikeStatus,
  getLikeCount,
  clearUserLikes,
} from "@/lib/interactions/likes"

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    like: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
    activity: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock logger
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe("Likes Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("toggleLike", () => {
    it("应该成功点赞一个未点赞的文章", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建点赞
      vi.mocked(prisma.like.create).mockResolvedValue({
        id: "like-1",
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 获取点赞数
      vi.mocked(prisma.like.count).mockResolvedValue(5)

      const result = await toggleLike("post", postId, userId)

      expect(result).toEqual({ isLiked: true, count: 5 })
      expect(prisma.like.create).toHaveBeenCalledWith({
        data: { authorId: userId, postId },
      })
      // Post 不应该调用冗余计数更新
      expect(prisma.activity.update).not.toHaveBeenCalled()
    })

    it("应该成功取消已点赞的动态", async () => {
      const activityId = "activity-1"
      const userId = "user-1"
      const likeId = "like-1"

      // Mock: 动态存在
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({
        id: activityId,
        likesCount: 10,
      } as any)

      // Mock: 用户已点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: likeId,
        authorId: userId,
        activityId,
        postId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 删除点赞
      vi.mocked(prisma.like.delete).mockResolvedValue({} as any)

      // Mock: 更新动态冗余计数
      vi.mocked(prisma.activity.update).mockResolvedValue({
        id: activityId,
        likesCount: 9,
      } as any)

      // Mock: 获取最新点赞数
      vi.mocked(prisma.activity.findUnique)
        .mockResolvedValueOnce({
          id: activityId,
          likesCount: 10,
        } as any)
        .mockResolvedValueOnce({
          id: activityId,
          likesCount: 9,
        } as any)

      const result = await toggleLike("activity", activityId, userId)

      expect(result).toEqual({ isLiked: false, count: 9 })
      expect(prisma.like.delete).toHaveBeenCalledWith({
        where: { id: likeId },
      })
      // Activity 应该调用冗余计数更新（decrement）
      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: activityId },
        data: { likesCount: { increment: -1 } },
      })
    })

    it("应该在目标不存在时抛出错误", async () => {
      const postId = "non-existent"
      const userId = "user-1"

      // Mock: 文章不存在
      vi.mocked(prisma.post.findUnique).mockResolvedValue(null)

      await expect(toggleLike("post", postId, userId)).rejects.toThrow("post not found")
      expect(prisma.like.create).not.toHaveBeenCalled()
    })

    it("应该处理并发删除的P2025错误（记录不存在）", async () => {
      const postId = "post-1"
      const userId = "user-1"
      const likeId = "like-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: postId } as any)

      // Mock: 用户已点赞（准备删除）
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: likeId,
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 删除时抛出P2025错误（记录已被其他请求删除）
      const notFoundError = new Error("Record to delete does not exist")
      ;(notFoundError as any).code = "P2025"
      vi.mocked(prisma.like.delete).mockRejectedValue(notFoundError)

      // Mock: 获取点赞数
      vi.mocked(prisma.like.count).mockResolvedValue(4)

      const result = await toggleLike("post", postId, userId)

      // 幂等处理：即使记录不存在也返回未点赞
      expect(result).toEqual({ isLiked: false, count: 4 })
      expect(prisma.like.delete).toHaveBeenCalledWith({
        where: { id: likeId },
      })
    })

    it("应该处理并发创建的唯一约束冲突（P2002）", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞（准备创建）
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建时抛出唯一约束冲突错误
      const uniqueError = new Error("Unique constraint failed")
      ;(uniqueError as any).code = "P2002"
      vi.mocked(prisma.like.create).mockRejectedValue(uniqueError)

      // Mock: 获取点赞数
      vi.mocked(prisma.like.count).mockResolvedValue(5)

      const result = await toggleLike("post", postId, userId)

      // 幂等处理：即使冲突也返回已点赞
      expect(result).toEqual({ isLiked: true, count: 5 })
      expect(prisma.like.create).toHaveBeenCalledWith({
        data: { authorId: userId, postId },
      })
    })
  })

  describe("getLikeStatus", () => {
    it("应该返回匿名用户的点赞状态（未点赞）", async () => {
      const postId = "post-1"

      // Mock: 获取点赞数
      vi.mocked(prisma.like.count).mockResolvedValue(10)

      const result = await getLikeStatus("post", postId)

      expect(result).toEqual({ isLiked: false, count: 10 })
      expect(prisma.like.findFirst).not.toHaveBeenCalled()
    })

    it("应该返回登录用户的实际点赞状态", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 获取点赞数
      vi.mocked(prisma.like.count).mockResolvedValue(10)

      // Mock: 用户已点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: "like-1",
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      const result = await getLikeStatus("post", postId, userId)

      expect(result).toEqual({ isLiked: true, count: 10 })
      expect(prisma.like.findFirst).toHaveBeenCalledWith({
        where: { authorId: userId, postId },
      })
    })

    it("应该正确获取动态的点赞数（使用冗余计数）", async () => {
      const activityId = "activity-1"

      // Mock: 从 Activity 表读取冗余计数
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({
        id: activityId,
        likesCount: 25,
      } as any)

      const result = await getLikeStatus("activity", activityId)

      expect(result).toEqual({ isLiked: false, count: 25 })
      expect(prisma.like.count).not.toHaveBeenCalled() // 不应该查询 Like 表
    })
  })

  describe("getLikeUsers", () => {
    it("应该返回点赞用户列表（带分页）", async () => {
      const postId = "post-1"
      const now = new Date()
      const mockLikes = [
        {
          id: "like-1",
          authorId: "user-1",
          postId,
          activityId: null,
          createdAt: new Date(now.getTime() - 2000), // 2秒前
          author: {
            id: "user-1",
            name: "User One",
            avatarUrl: "https://example.com/avatar1.jpg",
          },
        },
        {
          id: "like-2",
          authorId: "user-2",
          postId,
          activityId: null,
          createdAt: new Date(now.getTime() - 1000), // 1秒前
          author: {
            id: "user-2",
            name: "User Two",
            avatarUrl: "https://example.com/avatar2.jpg",
          },
        },
      ]

      // Mock: 返回 limit + 1 条记录以判断 hasMore
      vi.mocked(prisma.like.findMany).mockResolvedValue([
        ...mockLikes,
        {
          id: "like-3",
          authorId: "user-3",
          postId,
          activityId: null,
          createdAt: now,
          author: {
            id: "user-3",
            name: "User Three",
            avatarUrl: null,
          },
        },
      ] as any)

      const result = await getLikeUsers("post", postId, 2)

      expect(result.users).toHaveLength(2)
      expect(result.hasMore).toBe(true)
      // nextCursor 现在是简单的 ID
      expect(result.nextCursor).toBe("like-2")

      // 验证返回的用户结构（author 映射为 user）
      expect(result.users[0]).toHaveProperty("user")
      expect(result.users[0].user).toEqual({
        id: "user-1",
        name: "User One",
        avatarUrl: "https://example.com/avatar1.jpg",
      })
    })

    it("应该支持游标分页", async () => {
      const activityId = "activity-1"
      const now = new Date()
      const cursor = `${now.toISOString()}_like-10`

      vi.mocked(prisma.like.findMany).mockResolvedValue([
        {
          id: "like-11",
          authorId: "user-11",
          activityId,
          postId: null,
          createdAt: now,
          author: {
            id: "user-11",
            name: "User Eleven",
            avatarUrl: null,
          },
        },
      ] as any)

      const result = await getLikeUsers("activity", activityId, 10, "like-10")

      expect(prisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "like-10" },
          skip: 1,
          take: 11, // limit + 1
        })
      )
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeUndefined()
    })

    it("应该使用简单的 ID 游标格式", async () => {
      const postId = "post-1"
      const oldCursor = "like-old" // 简单 ID 格式

      vi.mocked(prisma.like.findMany).mockResolvedValue([])

      await getLikeUsers("post", postId, 10, oldCursor)

      // 应该使用简单 ID 游标
      expect(prisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: oldCursor },
          skip: 1,
        })
      )
    })

    it("应该正确处理相同 createdAt 的多个点赞（防止重复和跳项）", async () => {
      const postId = "post-1"
      const sameTime = new Date("2024-01-01T10:00:00Z")

      // 第一页：3个相同时间的点赞
      const firstPageLikes = [
        {
          id: "like-c",
          authorId: "user-c",
          postId,
          activityId: null,
          createdAt: sameTime,
          author: { id: "user-c", name: "User C", avatarUrl: null },
        },
        {
          id: "like-b",
          authorId: "user-b",
          postId,
          activityId: null,
          createdAt: sameTime,
          author: { id: "user-b", name: "User B", avatarUrl: null },
        },
        {
          id: "like-a",
          authorId: "user-a",
          postId,
          activityId: null,
          createdAt: sameTime,
          author: { id: "user-a", name: "User A", avatarUrl: null },
        },
      ]

      // 第一次查询
      vi.mocked(prisma.like.findMany).mockResolvedValueOnce(firstPageLikes as any)

      const page1 = await getLikeUsers("post", postId, 2)

      expect(page1.users).toHaveLength(2)
      expect(page1.users[0].id).toBe("like-c")
      expect(page1.users[1].id).toBe("like-b")
      expect(page1.hasMore).toBe(true)

      // 游标应该是最后一条记录的 id
      expect(page1.nextCursor).toBe("like-b")

      // 第二页：使用游标继续查询
      const secondPageLikes = [
        {
          id: "like-a",
          authorId: "user-a",
          postId,
          activityId: null,
          createdAt: sameTime,
          author: { id: "user-a", name: "User A", avatarUrl: null },
        },
      ]

      vi.mocked(prisma.like.findMany).mockResolvedValueOnce(secondPageLikes as any)

      const page2 = await getLikeUsers("post", postId, 2, page1.nextCursor)

      // 验证查询使用了正确的游标（简单 ID）
      expect(prisma.like.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          cursor: { id: "like-b" },
          skip: 1,
        })
      )

      expect(page2.users).toHaveLength(1)
      expect(page2.users[0].id).toBe("like-a")
      expect(page2.hasMore).toBe(false)
      expect(page2.nextCursor).toBeUndefined()

      // 确保没有重复或跳项
      const allUsers = [...page1.users, ...page2.users]
      const uniqueIds = new Set(allUsers.map((u) => u.id))
      expect(uniqueIds.size).toBe(3) // 应该有3个唯一的ID
      expect(uniqueIds.has("like-a")).toBe(true)
      expect(uniqueIds.has("like-b")).toBe(true)
      expect(uniqueIds.has("like-c")).toBe(true)
    })
  })

  describe("getBatchLikeStatus", () => {
    it("应该批量获取文章的点赞状态（使用 groupBy）", async () => {
      const postIds = ["post-1", "post-2", "post-3"]
      const userId = "user-1"

      // Mock: groupBy 聚合查询
      vi.mocked(prisma.like.groupBy).mockResolvedValue([
        { postId: "post-1", _count: { _all: 5 } },
        { postId: "post-3", _count: { _all: 2 } },
      ] as any)

      // Mock: 用户点赞状态
      vi.mocked(prisma.like.findMany).mockResolvedValue([
        { postId: "post-1", activityId: null },
      ] as any)

      const result = await getBatchLikeStatus("post", postIds, userId)

      expect(result.get("post-1")).toEqual({ isLiked: true, count: 5 })
      expect(result.get("post-2")).toEqual({ isLiked: false, count: 0 })
      expect(result.get("post-3")).toEqual({ isLiked: false, count: 2 })
    })

    it("应该批量获取动态的点赞状态（使用冗余计数）", async () => {
      const activityIds = ["activity-1", "activity-2"]

      // Mock: Activity 表的冗余计数
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "activity-1", likesCount: 10 },
        { id: "activity-2", likesCount: 5 },
      ] as any)

      const result = await getBatchLikeStatus("activity", activityIds)

      expect(result.get("activity-1")).toEqual({ isLiked: false, count: 10 })
      expect(result.get("activity-2")).toEqual({ isLiked: false, count: 5 })

      // 不应该查询 Like 表进行聚合
      expect(prisma.like.groupBy).not.toHaveBeenCalled()
    })

    it("应该正确标识用户已点赞的项目", async () => {
      const activityIds = ["activity-1", "activity-2"]
      const userId = "user-1"

      // Mock: Activity 冗余计数
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "activity-1", likesCount: 10 },
        { id: "activity-2", likesCount: 5 },
      ] as any)

      // Mock: 用户点赞了 activity-2
      vi.mocked(prisma.like.findMany).mockResolvedValue([
        { postId: null, activityId: "activity-2" },
      ] as any)

      const result = await getBatchLikeStatus("activity", activityIds, userId)

      expect(result.get("activity-1")).toEqual({ isLiked: false, count: 10 })
      expect(result.get("activity-2")).toEqual({ isLiked: true, count: 5 })
    })
  })

  describe("getLikeCount", () => {
    it("应该从 Activity 表读取冗余计数", async () => {
      const activityId = "activity-1"

      vi.mocked(prisma.activity.findUnique).mockResolvedValue({
        id: activityId,
        likesCount: 42,
      } as any)

      const count = await getLikeCount("activity", activityId)

      expect(count).toBe(42)
      expect(prisma.like.count).not.toHaveBeenCalled()
    })

    it("应该从 Like 表计算文章点赞数", async () => {
      const postId = "post-1"

      vi.mocked(prisma.like.count).mockResolvedValue(15)

      const count = await getLikeCount("post", postId)

      expect(count).toBe(15)
      expect(prisma.activity.findUnique).not.toHaveBeenCalled()
    })

    it("应该在目标不存在时返回 0", async () => {
      const activityId = "non-existent"

      vi.mocked(prisma.activity.findUnique).mockResolvedValue(null)

      const count = await getLikeCount("activity", activityId)

      expect(count).toBe(0)
    })
  })

  describe("clearUserLikes", () => {
    it("应该删除用户的所有点赞", async () => {
      const userId = "user-1"

      vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 5 } as any)

      await clearUserLikes(userId)

      expect(prisma.like.deleteMany).toHaveBeenCalledWith({
        where: { authorId: userId },
      })
    })

    it("应该在删除失败时抛出错误", async () => {
      const userId = "user-1"
      const error = new Error("Database error")

      vi.mocked(prisma.like.deleteMany).mockRejectedValue(error)

      await expect(clearUserLikes(userId)).rejects.toThrow("Database error")
    })
  })

  describe("错误处理", () => {
    it("toggleLike 应该正确处理并发创建导致的唯一约束冲突", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建点赞时遇到唯一约束冲突（P2002）
      const prismaError = new Error("Unique constraint failed")
      ;(prismaError as any).code = "P2002"
      vi.mocked(prisma.like.create).mockRejectedValue(prismaError)

      // Mock: 获取点赞数
      vi.mocked(prisma.like.count).mockResolvedValue(5)

      const result = await toggleLike("post", postId, userId)

      // 幂等处理：即使创建失败，也认为是已点赞
      expect(result).toEqual({ isLiked: true, count: 5 })
    })

    it("toggleLike 应该传递非唯一约束的其他错误", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findUnique).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建点赞时遇到其他错误
      const otherError = new Error("Database connection failed")
      vi.mocked(prisma.like.create).mockRejectedValue(otherError)

      await expect(toggleLike("post", postId, userId)).rejects.toThrow("Database connection failed")
    })
  })
})
