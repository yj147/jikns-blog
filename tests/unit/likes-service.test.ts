/**
 * 点赞服务层单元测试
 * 完整覆盖 likes 服务的所有公开方法
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { InteractionTargetNotFoundError } from "@/lib/interactions/errors"
import {
  toggleLike,
  getLikeStatus,
  getLikeUsers,
  getBatchLikeStatus,
  getLikeCount,
  clearUserLikes,
  ensureLiked,
  ensureUnliked,
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
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    activity: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => {
      // Mock transaction: 直接执行回调并传入 prisma 对象
      const mockPrisma = {
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
        post: { findFirst: vi.fn(), findUnique: vi.fn() },
        activity: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
      }
      return await fn(mockPrisma)
    }),
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
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 直接创建点赞（已去除事务包裹）
      vi.mocked(prisma.like.create).mockResolvedValue({
        id: "like-1",
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 获取点赞数（post 类型在事务外查询）
      vi.mocked(prisma.like.count).mockResolvedValue(5)

      const result = await toggleLike("post", postId, userId)

      expect(result).toEqual({ isLiked: true, count: 5 })
      expect(prisma.like.create).toHaveBeenCalledWith({
        data: { authorId: userId, postId },
      })
      // 触发器会自动维护计数，无需应用层验证
    })

    it("应该成功取消已点赞的动态", async () => {
      const activityId = "activity-1"
      const userId = "user-1"
      const likeId = "like-1"

      // Mock: 当前动态 likesCount（删除后查询得到 9）
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({
        id: activityId,
        likesCount: 9,
      } as any)

      // Mock: 用户已点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: likeId,
        authorId: userId,
        activityId,
        postId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 直接删除点赞（已去除事务包裹）
      vi.mocked(prisma.like.delete).mockResolvedValue({} as any)

      const result = await toggleLike("activity", activityId, userId)

      expect(result).toEqual({ isLiked: false, count: 9 })
      expect(prisma.like.delete).toHaveBeenCalledWith({
        where: { id: likeId },
      })
      // 触发器会自动维护计数，无需应用层验证
    })

    it("应该在目标不存在时抛出错误", async () => {
      const postId = "non-existent"
      const userId = "user-1"

      // Mock: 用户未点赞，需要创建
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 文章不存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue(null)

      await expect(toggleLike("post", postId, userId)).rejects.toBeInstanceOf(
        InteractionTargetNotFoundError
      )
      expect(prisma.like.create).not.toHaveBeenCalled()
    })

    it("应该处理并发删除的P2025错误（记录不存在）", async () => {
      const postId = "post-1"
      const userId = "user-1"
      const likeId = "like-1"

      // Mock: 用户已点赞（准备删除）
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: likeId,
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      // Mock: delete 抛出 P2025 错误（并发删除场景）
      const notFoundError = new Prisma.PrismaClientKnownRequestError(
        "Record to delete does not exist",
        { code: "P2025", clientVersion: "5.0.0" }
      )
      vi.mocked(prisma.like.delete).mockRejectedValue(notFoundError)

      // Mock: 获取点赞数（并发错误后查询）
      vi.mocked(prisma.like.count).mockResolvedValue(4)

      const result = await toggleLike("post", postId, userId)

      // 幂等处理：即使记录不存在也返回未点赞
      expect(result).toEqual({ isLiked: false, count: 4 })
    })

    it("应该在目标于创建过程中被删除时抛出 InteractionTargetNotFoundError", async () => {
      const postId = "post-concurrent"
      const userId = "user-1"

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 文章存在（验证通过）
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 创建时抛出 P2003（外键约束失败）
      const foreignKeyError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "5.0.0" }
      )
      vi.mocked(prisma.like.create).mockRejectedValue(foreignKeyError)

      await expect(toggleLike("post", postId, userId)).rejects.toBeInstanceOf(
        InteractionTargetNotFoundError
      )
    })

    it("应该允许在文章已下线时取消点赞", async () => {
      const postId = "post-gone"
      const userId = "user-1"
      const likeId = "like-legacy"

      // Mock: 用户已点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: likeId,
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 直接删除点赞（已去除事务包裹）
      vi.mocked(prisma.like.delete).mockResolvedValue({} as any)

      // Mock: 当前点赞计数（查询 likes 表）
      vi.mocked(prisma.like.count).mockResolvedValue(0)

      const result = await toggleLike("post", postId, userId)

      expect(result).toEqual({ isLiked: false, count: 0 })
      expect(prisma.like.delete).toHaveBeenCalledWith({ where: { id: likeId } })
      expect(prisma.post.findFirst).not.toHaveBeenCalled()
    })

    it("应该处理并发创建的唯一约束冲突（P2002）", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞（准备创建）
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建时抛出唯一约束冲突错误（直接 mock prisma.like.create）
      const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
      vi.mocked(prisma.like.create).mockRejectedValue(uniqueError)

      // Mock: 获取点赞数（并发错误后查询）
      vi.mocked(prisma.like.count).mockResolvedValue(5)

      const result = await toggleLike("post", postId, userId)

      // 幂等处理：即使冲突也返回已点赞
      expect(result).toEqual({ isLiked: true, count: 5 })
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

      // Mock: 返回 limit + 1 条记录以判断 hasMore（按 createdAt desc 排序）
      vi.mocked(prisma.like.findMany).mockResolvedValue([
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
        {
          id: "like-2",
          authorId: "user-2",
          postId,
          activityId: null,
          createdAt: new Date(now.getTime() - 1000),
          author: {
            id: "user-2",
            name: "User Two",
            avatarUrl: "https://example.com/avatar2.jpg",
          },
        },
        {
          id: "like-1",
          authorId: "user-1",
          postId,
          activityId: null,
          createdAt: new Date(now.getTime() - 2000),
          author: {
            id: "user-1",
            name: "User One",
            avatarUrl: "https://example.com/avatar1.jpg",
          },
        },
      ] as any)

      const result = await getLikeUsers("post", postId, 2)

      expect(result.users).toEqual([
        { id: "user-3", name: "User Three", avatarUrl: null },
        { id: "user-2", name: "User Two", avatarUrl: "https://example.com/avatar2.jpg" },
      ])
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe("like-2")

      // 确认没有额外字段泄露
      expect(Object.keys(result.users[0]).sort()).toEqual(["avatarUrl", "id", "name"])
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
      expect(page1.users[0].id).toBe("user-c")
      expect(page1.users[1].id).toBe("user-b")
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
      expect(page2.users[0].id).toBe("user-a")
      expect(page2.hasMore).toBe(false)
      expect(page2.nextCursor).toBeUndefined()

      // 确保没有重复或跳项
      const allUsers = [...page1.users, ...page2.users]
      const uniqueIds = new Set(allUsers.map((u) => u.id))
      expect(uniqueIds.size).toBe(3) // 应该有3个唯一的用户ID
      expect(uniqueIds.has("user-a")).toBe(true)
      expect(uniqueIds.has("user-b")).toBe(true)
      expect(uniqueIds.has("user-c")).toBe(true)
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
    it("应该删除用户的所有点赞并更新 activity 计数", async () => {
      const userId = "user-1"
      const activityId1 = "activity-1"
      const activityId2 = "activity-2"

      // Mock: 查询用户的 activity 点赞
      vi.mocked(prisma.like.findMany).mockResolvedValue([
        { activityId: activityId1 },
        { activityId: activityId1 },
        { activityId: activityId2 },
      ] as any)

      // Mock: 直接删除（无事务）
      vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 3 })

      await clearUserLikes(userId)

      // 验证查询 activity 点赞
      expect(prisma.like.findMany).toHaveBeenCalledWith({
        where: {
          authorId: userId,
          activityId: { not: null },
        },
        select: { activityId: true },
      })

      // 验证删除所有点赞
      expect(prisma.like.deleteMany).toHaveBeenCalledWith({
        where: { authorId: userId },
      })

      // 触发器会自动维护计数，无需应用层验证
    })

    it("应该正确处理没有 activity 点赞的情况", async () => {
      const userId = "user-1"

      // Mock: 用户只有 post 点赞，没有 activity 点赞
      vi.mocked(prisma.like.findMany).mockResolvedValue([])

      // Mock: 直接删除（无事务）
      vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 2 })

      await clearUserLikes(userId)

      // 验证删除点赞
      expect(prisma.like.deleteMany).toHaveBeenCalled()

      // 触发器会自动维护计数，无需应用层验证
    })

    it("应该在删除失败时抛出错误", async () => {
      const userId = "user-1"
      const error = new Error("Database error")

      vi.mocked(prisma.like.findMany).mockRejectedValue(error)

      await expect(clearUserLikes(userId)).rejects.toThrow("Database error")
    })
  })

  describe("错误处理", () => {
    it("toggleLike 应该正确处理并发创建导致的唯一约束冲突", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建时抛出唯一约束冲突（P2002）
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
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
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 创建时抛出其他错误
      const otherError = new Error("Database connection failed")
      vi.mocked(prisma.like.create).mockRejectedValue(otherError)

      await expect(toggleLike("post", postId, userId)).rejects.toThrow("Database connection failed")
    })
  })

  describe("toggleLike 并发测试", () => {
    it("多次并发调用 toggleLike（点赞）应保证最终状态一致", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 用户未点赞（准备创建）
      vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

      // Mock: 第一次创建成功，后续抛出 P2002（模拟并发冲突）
      let createCount = 0
      vi.mocked(prisma.like.create).mockImplementation(async () => {
        createCount++
        if (createCount === 1) {
          return {
            id: "like-1",
            authorId: userId,
            postId,
            activityId: null,
            createdAt: new Date(),
          } as any
        } else {
          const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "5.0.0",
          })
          throw error
        }
      })

      // Mock: 最终计数
      vi.mocked(prisma.like.count).mockResolvedValue(1)

      // 并发调用 3 次 toggleLike（从未点赞到点赞）
      const results = await Promise.all([
        toggleLike("post", postId, userId),
        toggleLike("post", postId, userId),
        toggleLike("post", postId, userId),
      ])

      // 所有结果都应该是已点赞，计数为 1（幂等性）
      results.forEach((result) => {
        expect(result.isLiked).toBe(true)
        expect(result.count).toBe(1)
      })
    })

    it("多次并发调用 toggleLike（取消点赞）应保证最终状态一致", async () => {
      const postId = "post-1"
      const userId = "user-1"
      const likeId = "like-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 用户已点赞（准备删除）
      vi.mocked(prisma.like.findFirst).mockResolvedValue({
        id: likeId,
        authorId: userId,
        postId,
        activityId: null,
        createdAt: new Date(),
      } as any)

      // Mock: 第一次删除成功，后续抛出 P2025（模拟并发删除）
      let deleteCount = 0
      vi.mocked(prisma.like.delete).mockImplementation(async () => {
        deleteCount++
        if (deleteCount === 1) {
          return {
            id: likeId,
            authorId: userId,
            postId,
            activityId: null,
            createdAt: new Date(),
          } as any
        } else {
          const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
            code: "P2025",
            clientVersion: "5.0.0",
          })
          throw error
        }
      })

      // Mock: 最终计数
      vi.mocked(prisma.like.count).mockResolvedValue(0)

      // 并发调用 3 次 toggleLike（从已点赞到取消点赞）
      const results = await Promise.all([
        toggleLike("post", postId, userId),
        toggleLike("post", postId, userId),
        toggleLike("post", postId, userId),
      ])

      // 所有结果都应该是未点赞，计数为 0（幂等性）
      results.forEach((result) => {
        expect(result.isLiked).toBe(false)
        expect(result.count).toBe(0)
      })
    })
  })

  describe("ensureLiked 并发测试", () => {
    it("多次并发调用 ensureLiked 应保证最终状态为已点赞", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: 文章存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue({ id: postId } as any)

      // Mock: 第一次创建成功，后续抛出 P2002（直接 mock prisma.like.create）
      let createCount = 0
      vi.mocked(prisma.like.create).mockImplementation(async () => {
        createCount++
        if (createCount === 1) {
          return {
            id: "like-1",
            authorId: userId,
            postId,
            activityId: null,
            createdAt: new Date(),
          } as any
        } else {
          const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "5.0.0",
          })
          throw error
        }
      })

      // Mock: 最终计数
      vi.mocked(prisma.like.count).mockResolvedValue(1)

      // 并发调用 3 次
      const results = await Promise.all([
        ensureLiked("post", postId, userId),
        ensureLiked("post", postId, userId),
        ensureLiked("post", postId, userId),
      ])

      // 所有结果都应该是已点赞
      results.forEach((result) => {
        expect(result.isLiked).toBe(true)
        expect(result.count).toBe(1)
      })
    })

    it("ensureLiked 应该在目标不存在时抛出错误", async () => {
      const postId = "non-existent"
      const userId = "user-1"

      // Mock: 文章不存在
      vi.mocked(prisma.post.findFirst).mockResolvedValue(null)

      await expect(ensureLiked("post", postId, userId)).rejects.toBeInstanceOf(
        InteractionTargetNotFoundError
      )
    })
  })

  describe("ensureUnliked 并发测试", () => {
    it("多次并发调用 ensureUnliked 应保证最终状态为未点赞", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: deleteMany 天然幂等
      vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.like.count).mockResolvedValue(0)

      // 并发调用 3 次
      const results = await Promise.all([
        ensureUnliked("post", postId, userId),
        ensureUnliked("post", postId, userId),
        ensureUnliked("post", postId, userId),
      ])

      // 所有结果都应该是未点赞
      results.forEach((result) => {
        expect(result.isLiked).toBe(false)
        expect(result.count).toBe(0)
      })

      // deleteMany 应该被调用 3 次（每次请求都执行）
      expect(prisma.like.deleteMany).toHaveBeenCalledTimes(3)
    })

    it("ensureUnliked 应该在没有点赞记录时也返回成功", async () => {
      const postId = "post-1"
      const userId = "user-1"

      // Mock: deleteMany 返回 0（没有记录被删除）
      vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.like.count).mockResolvedValue(0)

      const result = await ensureUnliked("post", postId, userId)

      expect(result).toEqual({ isLiked: false, count: 0 })
    })
  })
})
