/**
 * 收藏服务层单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { toggleBookmark, getBookmarkStatus, getUserBookmarks } from "@/lib/interactions/bookmarks"
import { Prisma } from "@/lib/generated/prisma"

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: vi.fn(),
    },
    bookmark: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"

describe("Bookmarks Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("toggleBookmark", () => {
    const postId = "post-123"
    const userId = "user-456"

    it("应该创建收藏并返回 isBookmarked: true", async () => {
      // Mock 文章存在且已发布
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce({
        id: postId,
        published: true,
      } as any)

      // Mock 收藏不存在
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce(null)

      // Mock 创建收藏
      vi.mocked(prisma.bookmark.create).mockResolvedValueOnce({
        id: "bookmark-1",
        userId,
        postId,
        createdAt: new Date(),
      } as any)

      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(5)

      const result = await toggleBookmark(postId, userId)

      expect(result).toEqual({
        isBookmarked: true,
        count: 5,
      })

      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: {
          id: postId,
          published: true,
        },
      })

      expect(prisma.bookmark.create).toHaveBeenCalledWith({
        data: {
          userId,
          postId,
        },
      })
    })

    it("应该删除收藏并返回 isBookmarked: false", async () => {
      // Mock 收藏存在
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce({
        id: "bookmark-1",
        userId,
        postId,
        createdAt: new Date(),
      } as any)

      // Mock 删除收藏
      vi.mocked(prisma.bookmark.delete).mockResolvedValueOnce({} as any)

      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(4)

      const result = await toggleBookmark(postId, userId)

      expect(result).toEqual({
        isBookmarked: false,
        count: 4,
      })

      // 删除时不应该验证文章状态
      expect(prisma.post.findFirst).not.toHaveBeenCalled()

      expect(prisma.bookmark.delete).toHaveBeenCalledWith({
        where: {
          id: "bookmark-1",
        },
      })
    })

    it("应该在文章不存在时抛出错误", async () => {
      // Mock 文章不存在
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null)

      await expect(toggleBookmark(postId, userId)).rejects.toThrow("post not found")
    })

    it("应该在文章未发布时抛出错误", async () => {
      // Mock 文章未发布
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null)

      await expect(toggleBookmark(postId, userId)).rejects.toThrow("post not found")
    })

    it("应该处理并发创建的唯一约束冲突", async () => {
      // Mock 收藏不存在（准备创建）
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce(null)

      // Mock 文章存在且已发布（创建时才需要验证）
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce({
        id: postId,
        published: true,
      } as any)

      // Mock 创建收藏时抛出唯一约束错误
      const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
      vi.mocked(prisma.bookmark.create).mockRejectedValueOnce(uniqueError)

      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(5)

      const result = await toggleBookmark(postId, userId)

      // 幂等处理：即使冲突也返回已收藏
      expect(result).toEqual({
        isBookmarked: true,
        count: 5,
      })
    })

    it("应该允许删除已下线文章的收藏（孤儿记录清理）", async () => {
      // Mock 收藏存在（文章已下线但收藏记录还在）
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce({
        id: "bookmark-1",
        userId,
        postId,
        createdAt: new Date(),
      } as any)

      // Mock 删除收藏成功
      vi.mocked(prisma.bookmark.delete).mockResolvedValueOnce({} as any)

      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(0)

      const result = await toggleBookmark(postId, userId)

      expect(result).toEqual({
        isBookmarked: false,
        count: 0,
      })

      // 删除时不应该验证文章状态
      expect(prisma.post.findFirst).not.toHaveBeenCalled()

      expect(prisma.bookmark.delete).toHaveBeenCalledWith({
        where: {
          id: "bookmark-1",
        },
      })
    })

    it("应该处理并发删除的P2025错误（记录不存在）", async () => {
      // Mock 收藏存在（准备删除）
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce({
        id: "bookmark-1",
        userId,
        postId,
        createdAt: new Date(),
      } as any)

      // Mock 删除时抛出P2025错误（记录已被其他请求删除）
      const notFoundError = new Prisma.PrismaClientKnownRequestError(
        "Record to delete does not exist",
        {
          code: "P2025",
          clientVersion: "5.0.0",
        }
      )
      vi.mocked(prisma.bookmark.delete).mockRejectedValueOnce(notFoundError)

      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(0)

      const result = await toggleBookmark(postId, userId)

      // 幂等处理：即使记录不存在也返回未收藏
      expect(result).toEqual({
        isBookmarked: false,
        count: 0,
      })

      // 删除时不应该验证文章状态
      expect(prisma.post.findFirst).not.toHaveBeenCalled()
    })
  })

  describe("getBookmarkStatus", () => {
    const postId = "post-123"
    const userId = "user-456"

    it("匿名用户应该返回 isBookmarked: false 和正确的 count", async () => {
      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(10)

      const result = await getBookmarkStatus(postId)

      expect(result).toEqual({
        isBookmarked: false,
        count: 10,
      })

      expect(prisma.bookmark.findUnique).not.toHaveBeenCalled()
    })

    it("登录用户应该返回正确的 isBookmarked 和 count", async () => {
      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(10)

      // Mock 用户已收藏
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce({
        id: "bookmark-1",
        userId,
        postId,
        createdAt: new Date(),
      } as any)

      const result = await getBookmarkStatus(postId, userId)

      expect(result).toEqual({
        isBookmarked: true,
        count: 10,
      })

      expect(prisma.bookmark.findUnique).toHaveBeenCalledWith({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      })
    })

    it("登录用户未收藏时应该返回 isBookmarked: false", async () => {
      // Mock 收藏计数
      vi.mocked(prisma.bookmark.count).mockResolvedValueOnce(10)

      // Mock 用户未收藏
      vi.mocked(prisma.bookmark.findUnique).mockResolvedValueOnce(null)

      const result = await getBookmarkStatus(postId, userId)

      expect(result).toEqual({
        isBookmarked: false,
        count: 10,
      })
    })
  })

  describe("getUserBookmarks", () => {
    const userId = "user-456"

    it("应该仅返回已发布的文章", async () => {
      const mockBookmarks = [
        {
          id: "bookmark-1",
          userId,
          postId: "post-1",
          createdAt: new Date("2024-01-01"),
          post: {
            id: "post-1",
            slug: "test-post-1",
            title: "Test Post 1",
            coverImage: "image1.jpg",
            author: {
              id: "author-1",
              name: "Author 1",
              avatarUrl: "avatar1.jpg",
            },
          },
        },
      ]

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: "bookmark-1",
        post: {
          id: "post-1",
          slug: "test-post-1",
          title: "Test Post 1",
        },
      })

      expect(prisma.bookmark.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          post: {
            is: {
              published: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 11,
        include: {
          post: {
            select: {
              id: true,
              slug: true,
              title: true,
              coverImage: true,
              author: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      })
    })

    it("应该将 limit 小于 1 的值裁剪为 1", async () => {
      const mockBookmarks = [
        {
          id: "bookmark-1",
          userId,
          postId: "post-1",
          createdAt: new Date("2024-01-01"),
          post: {
            id: "post-1",
            slug: "test-post-1",
            title: "Test Post 1",
            coverImage: null,
            author: {
              id: "author-1",
              name: "Author",
              avatarUrl: null,
            },
          },
        },
      ]

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId, { limit: 0 })

      // 验证 limit 被裁剪为 1，所以 take 是 2 (limit + 1)
      expect(prisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2, // 1 + 1
        })
      )
      expect(result.items).toHaveLength(1)
    })

    it("应该将 limit 大于 100 的值裁剪为 100", async () => {
      const mockBookmarks = []
      // 创建 50 个收藏记录用于测试，使用有效的日期
      for (let i = 0; i < 50; i++) {
        const day = (i % 28) + 1 // 保证日期在1-28之间，避免月份边界问题
        mockBookmarks.push({
          id: `bookmark-${i}`,
          userId,
          postId: `post-${i}`,
          createdAt: new Date(`2024-01-${String(day).padStart(2, "0")}`),
          post: {
            id: `post-${i}`,
            slug: `test-post-${i}`,
            title: `Test Post ${i}`,
            coverImage: null,
            author: {
              id: "author-1",
              name: "Author",
              avatarUrl: null,
            },
          },
        })
      }

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId, { limit: 200 })

      // 验证 limit 被裁剪为 100，所以 take 是 101 (limit + 1)
      expect(prisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 101, // 100 + 1
        })
      )
      expect(result.items).toHaveLength(50) // 实际返回的数量受 mock 数据限制
    })

    it("应该将负数 limit 裁剪为 1", async () => {
      const mockBookmarks = [
        {
          id: "bookmark-1",
          userId,
          postId: "post-1",
          createdAt: new Date("2024-01-01"),
          post: {
            id: "post-1",
            slug: "test-post-1",
            title: "Test Post 1",
            coverImage: null,
            author: {
              id: "author-1",
              name: "Author",
              avatarUrl: null,
            },
          },
        },
      ]

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId, { limit: -10 })

      // 验证 limit 被裁剪为 1
      expect(prisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2, // 1 + 1
        })
      )
      expect(result.items).toHaveLength(1)
    })

    it("应该正确处理分页", async () => {
      const mockBookmarks = []
      // 创建11个收藏记录（limit默认10，多1个用于判断hasMore）
      for (let i = 0; i < 11; i++) {
        mockBookmarks.push({
          id: `bookmark-${i}`,
          userId,
          postId: `post-${i}`,
          createdAt: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
          post: {
            id: `post-${i}`,
            slug: `test-post-${i}`,
            title: `Test Post ${i}`,
            coverImage: null,
            author: {
              id: "author-1",
              name: "Author",
              avatarUrl: null,
            },
          },
        })
      }

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId, { limit: 10 })

      expect(result.items).toHaveLength(10)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe("bookmark-9")
    })

    it("应该支持游标分页", async () => {
      const mockBookmarks = [
        {
          id: "bookmark-5",
          userId,
          postId: "post-5",
          createdAt: new Date("2024-01-05"),
          post: {
            id: "post-5",
            slug: "test-post-5",
            title: "Test Post 5",
            coverImage: null,
            author: {
              id: "author-1",
              name: "Author",
              avatarUrl: null,
            },
          },
        },
      ]

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId, {
        cursor: "bookmark-4",
        limit: 5,
      })

      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeUndefined()

      expect(prisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: {
            id: "bookmark-4",
          },
          skip: 1,
        })
      )
    })

    it("应该在有游标时正确处理分页", async () => {
      const cursor = "bookmark-10"
      const mockBookmarks = []
      // 创建 6 个收藏记录（limit 5 + 1）
      for (let i = 11; i < 17; i++) {
        mockBookmarks.push({
          id: `bookmark-${i}`,
          userId,
          postId: `post-${i}`,
          createdAt: new Date(`2024-01-${String(i).padStart(2, "0")}`),
          post: {
            id: `post-${i}`,
            slug: `test-post-${i}`,
            title: `Test Post ${i}`,
            coverImage: null,
            author: {
              id: "author-1",
              name: "Author",
              avatarUrl: null,
            },
          },
        })
      }

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId, {
        cursor,
        limit: 5,
      })

      expect(result.items).toHaveLength(5)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe("bookmark-15")

      expect(prisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: cursor },
          skip: 1,
          take: 6, // limit + 1
        })
      )
    })

    it("应该包含所有必需的字段且无 N+1 问题", async () => {
      const mockBookmarks = [
        {
          id: "bookmark-1",
          userId,
          postId: "post-1",
          createdAt: new Date("2024-01-01"),
          post: {
            id: "post-1",
            slug: "test-post-1",
            title: "Test Post 1",
            coverImage: "image1.jpg",
            author: {
              id: "author-1",
              name: "Author 1",
              avatarUrl: "avatar1.jpg",
            },
          },
        },
      ]

      vi.mocked(prisma.bookmark.findMany).mockResolvedValueOnce(mockBookmarks as any)

      const result = await getUserBookmarks(userId)

      // 验证返回的数据结构完整
      expect(result.items[0]).toEqual({
        id: "bookmark-1",
        createdAt: new Date("2024-01-01").toISOString(),
        post: {
          id: "post-1",
          slug: "test-post-1",
          title: "Test Post 1",
          coverImage: "image1.jpg",
          author: {
            id: "author-1",
            name: "Author 1",
            avatarUrl: "avatar1.jpg",
          },
        },
      })

      // 验证只调用了一次查询（无 N+1）
      expect(prisma.bookmark.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            post: {
              select: {
                id: true,
                slug: true,
                title: true,
                coverImage: true,
                author: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        })
      )
    })
  })
})
