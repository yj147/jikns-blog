/**
 * 搜索分页行为测试
 * 验证 type="all" 和单一类型的分页逻辑
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { searchContent } from "@/lib/actions/search"
import * as searchRepo from "@/lib/repos/search"
import { getCurrentUser } from "@/lib/auth"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { getClientIPOrNullFromHeaders } from "@/lib/utils/client-ip"

vi.mock("server-only", () => ({}))

// Mock 搜索仓储层
vi.mock("@/lib/repos/search", () => ({
  searchPosts: vi.fn(),
  searchActivities: vi.fn(),
  searchUsers: vi.fn(),
  searchTags: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/rate-limit/search-limits", () => ({
  checkSearchRateLimit: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}))

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIPOrNullFromHeaders: vi.fn(),
}))

const createQueryResult = <T>(items: T[], total = items.length) => ({
  items,
  total,
})

describe("搜索分页行为测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: true })
    vi.mocked(getClientIPOrNullFromHeaders).mockReturnValue("127.0.0.1")
  })

  describe("type='all' 的分页行为", () => {
    it("应该返回所有类型的结果", async () => {
      const mockPosts = [
        {
          id: "post-1",
          title: "Test Post",
          excerpt: "Test excerpt",
          slug: "test-post",
          publishedAt: new Date().toISOString(),
          author: { id: "user-1", name: "Test User", avatarUrl: null },
          tags: [],
          rank: 0.9,
        },
      ]

      const mockActivities = [
        {
          id: "activity-1",
          content: "Test activity",
          createdAt: new Date().toISOString(),
          author: { id: "user-1", name: "Test User", avatarUrl: null },
          rank: 0.8,
        },
      ]

      const mockUsers = [
        {
          id: "user-1",
          name: "Test User",
          avatarUrl: null,
          bio: "Test bio",
          role: "USER",
          similarity: 0.88,
        },
      ]

      const mockTags = [
        {
          id: "tag-1",
          name: "Test Tag",
          slug: "test-tag",
          color: "#000000",
          postsCount: 10,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts, 100))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(
        createQueryResult(mockActivities, 50)
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult(mockUsers, 30))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult(mockTags, 20))

      const result = await searchContent({
        query: "test",
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items).toHaveLength(1)
        expect(result.data.activities.items).toHaveLength(1)
        expect(result.data.users.items).toHaveLength(1)
        expect(result.data.tags.items).toHaveLength(1)
        expect(result.data.overallTotal).toBe(200) // 100 + 50 + 30 + 20
      }
    })

    it("overallTotal 应该是所有类型的 total 之和", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([], 100))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([], 50))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([], 30))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([], 20))

      const result = await searchContent({
        query: "test",
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.overallTotal).toBe(200)
      }
    })

    it("每个桶应该有独立的 hasMore 标志", async () => {
      // posts: 100 条，第 1 页 20 条，hasMore = true
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult(Array(20).fill({ id: "post" }), 100)
      )
      // activities: 15 条，第 1 页 15 条，hasMore = false
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(
        createQueryResult(Array(15).fill({ id: "activity" }), 15)
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([], 0))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([], 0))

      const result = await searchContent({
        query: "test",
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.hasMore).toBe(true) // 100 > 20
        expect(result.data.activities.hasMore).toBe(false) // 15 <= 15
      }
    })
  })

  describe("单一类型的分页行为", () => {
    it("type='posts' 时应该只搜索文章", async () => {
      const mockPosts = [
        {
          id: "post-1",
          title: "Test Post",
          excerpt: "Test excerpt",
          slug: "test-post",
          publishedAt: new Date().toISOString(),
          author: { id: "user-1", name: "Test User", avatarUrl: null },
          tags: [],
          rank: 0.9,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts, 100))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items).toHaveLength(1)
        expect(result.data.posts.total).toBe(100)
        expect(result.data.posts.hasMore).toBe(true)
        expect(result.data.activities.items).toHaveLength(0)
        expect(result.data.users.items).toHaveLength(0)
        expect(result.data.tags.items).toHaveLength(0)
      }

      // 验证只调用了 searchPosts
      expect(searchRepo.searchPosts).toHaveBeenCalledTimes(1)
      expect(searchRepo.searchActivities).not.toHaveBeenCalled()
      expect(searchRepo.searchUsers).not.toHaveBeenCalled()
      expect(searchRepo.searchTags).not.toHaveBeenCalled()
    })

    it("单一类型的 hasMore 应该基于该类型的 total", async () => {
      // 第 1 页：20 条，total = 100，hasMore = true
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult(Array(20).fill({ id: "post" }), 100)
      )

      const result1 = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
      })

      expect(result1.success).toBe(true)
      if (result1.success) {
        expect(result1.data.posts.hasMore).toBe(true) // 100 > 0 + 20
      }

      // 第 5 页：20 条，total = 100，hasMore = false
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult(Array(20).fill({ id: "post" }), 100)
      )

      const result2 = await searchContent({
        query: "test",
        type: "posts",
        page: 5,
        limit: 20,
      })

      expect(result2.success).toBe(true)
      if (result2.success) {
        expect(result2.data.posts.hasMore).toBe(false) // 100 <= 80 + 20
      }
    })

    it("单一类型的分页应该正确计算 offset", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([], 100))

      await searchContent({
        query: "test",
        type: "posts",
        page: 3,
        limit: 20,
      })

      // 验证 offset = (page - 1) * limit = (3 - 1) * 20 = 40
      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 40,
          limit: 20,
        })
      )
    })
  })

  describe("分页边界情况", () => {
    it("应该正确处理第 1 页", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([], 100))

      await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
      })

      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 0,
          limit: 20,
        })
      )
    })

    it("应该正确处理最后一页（部分结果）", async () => {
      // 第 5 页：只有 10 条，total = 90
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult(Array(10).fill({ id: "post" }), 90)
      )

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 5,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items).toHaveLength(10)
        expect(result.data.posts.hasMore).toBe(false) // 90 <= 80 + 10
      }
    })

    it("应该正确处理空结果", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([], 0))

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items).toHaveLength(0)
        expect(result.data.posts.total).toBe(0)
        expect(result.data.posts.hasMore).toBe(false)
      }
    })

    it("应该正确处理超出范围的页码", async () => {
      // 第 10 页，但只有 50 条数据（共 3 页）
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([], 50))

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 10,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items).toHaveLength(0)
        expect(result.data.posts.hasMore).toBe(false)
      }
    })
  })

  describe("limit 参数验证", () => {
    it("应该限制 limit 最大为 50", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 100, // 超过最大值
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
      }
    })

    it("应该拒绝负数 limit", async () => {
      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: -1,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
      }
    })

    it("应该拒绝 0 作为 limit", async () => {
      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 0,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
      }
    })
  })
})
