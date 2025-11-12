/**
 * 搜索功能单元测试
 * Phase 11 / M2 / T2.4
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
vi.mock("server-only", () => ({}))

import {
  searchContent,
  getSearchSuggestions,
  searchAuthorCandidates,
  SEARCH_BUCKET_LIMITS_FOR_ALL,
} from "@/lib/actions/search"
import * as searchRepo from "@/lib/repos/search"
import { getCurrentUser } from "@/lib/auth"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { getClientIPOrNullFromHeaders } from "@/lib/utils/client-ip"

vi.mock("server-only", () => ({}))

// Mock 搜索仓储层
vi.mock("@/lib/repos/search", () => ({
  searchPosts: vi.fn(),
  searchPostSuggestions: vi.fn(),
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

describe("搜索功能测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: true })
    vi.mocked(getClientIPOrNullFromHeaders).mockReturnValue("127.0.0.1")
  })

  describe("searchContent - 统一搜索", () => {
    it("应该成功搜索所有类型的内容", async () => {
      // 准备 Mock 数据
      const mockPosts = [
        {
          id: "post1",
          slug: "test-post",
          title: "Test Post",
          excerpt: "Test excerpt",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 10,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "Test User", avatarUrl: null },
          tags: [],
        },
      ]

      const mockActivities = [
        {
          id: "activity1",
          content: "Test activity",
          imageUrls: [],
          isPinned: false,
          likesCount: 5,
          commentsCount: 2,
          viewsCount: 20,
          createdAt: new Date(),
          rank: 0.8,
          author: { id: "user1", name: "Test User", avatarUrl: null, role: "USER" },
        },
      ]

      const mockUsers = [
        {
          id: "user1",
          name: "Test User",
          avatarUrl: null,
          bio: "Test bio",
          role: "USER",
          similarity: 0.7,
        },
      ]

      const mockTags = [
        {
          id: "tag1",
          name: "Test Tag",
          slug: "test-tag",
          description: null,
          color: null,
          postsCount: 5,
        },
      ]

      // 设置 Mock 返回值
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult(mockActivities))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult(mockUsers))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult(mockTags))

      // 执行搜索
      const result = await searchContent({
        query: "test",
        type: "all",
        page: 1,
        limit: 20,
      })

      // 验证结果
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.posts.items).toHaveLength(1)
      expect(result.data?.activities.items).toHaveLength(1)
      expect(result.data?.users.items).toHaveLength(1)
      expect(result.data?.tags.items).toHaveLength(1)
      expect(result.data?.overallTotal).toBe(4)
      expect(result.data?.query).toBe("test")
      expect(result.data?.type).toBe("all")
    })

    it("应该只搜索文章", async () => {
      const mockPosts = [
        {
          id: "post1",
          slug: "test-post",
          title: "Test Post",
          excerpt: "Test excerpt",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 10,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "Test User", avatarUrl: null },
          tags: [],
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      expect(result.data?.posts.items).toHaveLength(1)
      expect(result.data?.activities.items).toHaveLength(0)
      expect(result.data?.users.items).toHaveLength(0)
      expect(result.data?.tags.items).toHaveLength(0)

      // 验证只调用了 searchPosts
      expect(searchRepo.searchPosts).toHaveBeenCalledTimes(1)
      expect(searchRepo.searchActivities).not.toHaveBeenCalled()
      expect(searchRepo.searchUsers).not.toHaveBeenCalled()
      expect(searchRepo.searchTags).not.toHaveBeenCalled()
    })

    it("应该支持文章的高级过滤", async () => {
      const mockPosts = [
        {
          id: "post1",
          slug: "test-post",
          title: "Test Post",
          excerpt: "Test excerpt",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 10,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "Test User", avatarUrl: null },
          tags: [],
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))

      const publishedFrom = new Date("2024-01-01")
      const publishedTo = new Date("2024-12-31")

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
        authorId: "user1",
        tagIds: ["tag1", "tag2"],
        publishedFrom,
        publishedTo,
        onlyPublished: true,
      })

      expect(result.success).toBe(true)

      // 验证调用参数
      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          limit: 20,
          offset: 0,
          authorId: "user1",
          tagIds: ["tag1", "tag2"],
          publishedFrom,
          publishedTo,
          onlyPublished: true,
          sort: "relevance",
        })
      )
    })

    it("管理员可以搜索草稿", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        status: "ACTIVE",
      } as any)

      await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
        onlyPublished: false,
      })

      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          onlyPublished: false,
          sort: "relevance",
        })
      )
    })

    it("普通用户强制 onlyPublished=true", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        role: "USER",
        status: "ACTIVE",
      } as any)

      await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 20,
        onlyPublished: false,
      })

      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          onlyPublished: true,
          sort: "relevance",
        })
      )
    })

    it("触发速率限制时返回错误", async () => {
      vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: false, retryAfter: 15 })

      const result = await searchContent({
        query: "test",
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("RATE_LIMIT_EXCEEDED")
    })

    it("应该正确处理分页", async () => {
      const mockPosts = [
        {
          id: "post1",
          slug: "test-post",
          title: "Test Post",
          excerpt: "Test excerpt",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 10,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "Test User", avatarUrl: null },
          tags: [],
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))

      // 第 2 页，每页 10 条
      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 2,
        limit: 10,
      })

      expect(result.success).toBe(true)

      // 验证 offset 计算正确
      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test",
          limit: 10,
          offset: 10, // (page - 1) * limit = (2 - 1) * 10 = 10
          onlyPublished: true,
          sort: "relevance",
        })
      )
    })

    it("应该返回 hasMore 信息", async () => {
      const mockPosts = [
        {
          id: "post1",
          slug: "test-post",
          title: "Test Post",
          excerpt: "Test excerpt",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 10,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "Test User", avatarUrl: null },
          tags: [],
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts, 30))
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
      expect(result.data?.posts.hasMore).toBe(true)
    })

    it('type="all" 时应应用实体特定的分页参数', async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      await searchContent({
        query: "test",
        type: "all",
        page: 2,
        limit: 20,
      })

      const expectedLimits = {
        posts: SEARCH_BUCKET_LIMITS_FOR_ALL.posts,
        activities: SEARCH_BUCKET_LIMITS_FOR_ALL.activities,
        users: SEARCH_BUCKET_LIMITS_FOR_ALL.users,
        tags: SEARCH_BUCKET_LIMITS_FOR_ALL.tags,
      }

      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: expectedLimits.posts,
          offset: expectedLimits.posts,
        })
      )
      expect(searchRepo.searchActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: expectedLimits.activities,
          offset: expectedLimits.activities,
        })
      )
      expect(searchRepo.searchUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: expectedLimits.users,
          offset: expectedLimits.users,
        })
      )
      expect(searchRepo.searchTags).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: expectedLimits.tags,
          offset: expectedLimits.tags,
        })
      )
    })

    it("应该拒绝空查询", async () => {
      const result = await searchContent({
        query: "",
        type: "all",
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("VALIDATION_ERROR")
    })

    it("应该拒绝过长的查询", async () => {
      const result = await searchContent({
        query: "a".repeat(101), // 超过 100 个字符
        type: "all",
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("VALIDATION_ERROR")
    })

    it("应该限制每页最大数量为 50", async () => {
      const mockPosts = [
        {
          id: "post1",
          slug: "test-post",
          title: "Test Post",
          excerpt: "Test excerpt",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 10,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "Test User", avatarUrl: null },
          tags: [],
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))

      const result = await searchContent({
        query: "test",
        type: "posts",
        page: 1,
        limit: 100, // 超过最大值 50
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("VALIDATION_ERROR")
    })

    it("排序选项应传递给文章搜索", async () => {
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))

      await searchContent({
        query: "latest",
        type: "posts",
        page: 1,
        limit: 10,
        sort: "latest",
      })

      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: "latest",
        })
      )
    })

    it("排序选项应传递给动态搜索", async () => {
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))

      await searchContent({
        query: "latest",
        type: "activities",
        page: 1,
        limit: 10,
        sort: "latest",
      })

      expect(searchRepo.searchActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: "latest",
        })
      )
    })
  })

  describe("getSearchSuggestions - 搜索建议", () => {
    it("应该返回混合类型的搜索建议", async () => {
      const mockTags = [
        {
          id: "tag1",
          name: "React",
          slug: "react",
          description: null,
          color: "#61DAFB",
          postsCount: 10,
        },
        {
          id: "tag2",
          name: "Redux",
          slug: "redux",
          description: null,
          color: "#764ABC",
          postsCount: 5,
        },
      ]

      const mockPosts = [
        {
          id: "post1",
          slug: "react-hooks",
          title: "React Hooks 完全指南",
          excerpt: "深入理解 React Hooks",
          coverImage: null,
          published: true,
          publishedAt: new Date(),
          viewCount: 100,
          createdAt: new Date(),
          rank: 0.9,
          author: { id: "user1", name: "张三", avatarUrl: null },
          tags: [],
        },
      ]

      const mockUsers = [
        {
          id: "user1",
          name: "React 开发者",
          avatarUrl: null,
          bio: "专注于 React 生态系统",
          role: "USER",
          similarity: 0.8,
        },
      ]

      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult(mockTags))
      vi.mocked(searchRepo.searchPostSuggestions).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult(mockUsers))

      const result = await getSearchSuggestions({
        query: "React",
        limit: 5,
      })

      expect(result.success).toBe(true)
      expect(result.data?.suggestions).toBeDefined()
      expect(result.data?.suggestions.length).toBeGreaterThan(0)

      // 验证建议包含不同类型
      const suggestions = result.data!.suggestions
      const types = suggestions.map((s) => s.type)
      expect(types).toContain("tag")
      expect(types).toContain("post")
      expect(types).toContain("user")

      // 验证标签建议格式
      const tagSuggestion = suggestions.find((s) => s.type === "tag")
      expect(tagSuggestion).toBeDefined()
      expect(tagSuggestion?.text).toBe("React")
      expect(tagSuggestion?.subtitle).toContain("10 篇文章")
      expect(tagSuggestion?.href).toBe("/blog?tag=react")
      expect(tagSuggestion?.metadata?.slug).toBe("react")

      // 验证文章建议格式
      const postSuggestion = suggestions.find((s) => s.type === "post")
      expect(postSuggestion).toBeDefined()
      expect(postSuggestion?.text).toBe("React Hooks 完全指南")
      expect(postSuggestion?.href).toBe("/blog/react-hooks")
      expect(postSuggestion?.subtitle).toBe("张三")

      // 验证用户建议格式
      const userSuggestion = suggestions.find((s) => s.type === "user")
      expect(userSuggestion).toBeDefined()
      expect(userSuggestion?.text).toBe("React 开发者")
      expect(userSuggestion?.href).toBe("/profile/user1")
      expect(userSuggestion?.subtitle).toBe("专注于 React 生态系统")
      expect(userSuggestion?.metadata?.email).toBeUndefined()

      expect(checkSearchRateLimit).toHaveBeenCalledWith({
        userId: undefined,
        ip: "127.0.0.1",
      })
    })

    it("应该限制每种类型的建议数量", async () => {
      const mockTags = Array.from({ length: 5 }, (_, i) => ({
        id: `tag${i}`,
        name: `Tag ${i}`,
        slug: `tag-${i}`,
        description: null,
        color: null,
        postsCount: 10 - i,
      }))

      const mockPosts = Array.from({ length: 5 }, (_, i) => ({
        id: `post${i}`,
        slug: `post-${i}`,
        title: `Post ${i}`,
        excerpt: null,
        coverImage: null,
        published: true,
        publishedAt: new Date(),
        viewCount: 10,
        createdAt: new Date(),
        rank: 0.9 - i * 0.1,
        author: { id: "user1", name: "Test User", avatarUrl: null },
        tags: [],
      }))

      const mockUsers = Array.from({ length: 5 }, (_, i) => ({
        id: `user${i}`,
        name: `User ${i}`,
        avatarUrl: null,
        bio: null,
        role: "USER",
        similarity: 0.9 - i * 0.1,
      }))

      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult(mockTags))
      vi.mocked(searchRepo.searchPostSuggestions).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult(mockUsers))

      const result = await getSearchSuggestions({
        query: "test",
        limit: 5,
      })

      expect(result.success).toBe(true)

      // 验证调用参数限制了每种类型的数量
      expect(searchRepo.searchTags).toHaveBeenCalledWith({ query: "test", limit: 2 })
      expect(searchRepo.searchPostSuggestions).toHaveBeenCalledWith({
        query: "test",
        limit: 2,
        onlyPublished: true,
      })
      expect(searchRepo.searchUsers).toHaveBeenCalledWith({ query: "test", limit: 1 })

      // 验证总建议数量不超过限制
      expect(result.data?.suggestions.length).toBeLessThanOrEqual(5)
    })

    it("应该在查询长度不足时返回空结果而且不会消耗限流或数据库", async () => {
      const rateLimitSpy = vi.mocked(checkSearchRateLimit)
      rateLimitSpy.mockClear()

      const result = await getSearchSuggestions({
        query: "r",
        limit: 5,
      })

      expect(result.success).toBe(true)
      expect(result.data?.suggestions).toHaveLength(0)
      expect(searchRepo.searchTags).not.toHaveBeenCalled()
      expect(searchRepo.searchPostSuggestions).not.toHaveBeenCalled()
      expect(searchRepo.searchUsers).not.toHaveBeenCalled()
      expect(rateLimitSpy).not.toHaveBeenCalled()
    })

    it("应该在达到速率限制时返回错误", async () => {
      vi.mocked(checkSearchRateLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 10,
      })

      const result = await getSearchSuggestions({
        query: "test",
        limit: 5,
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(result.error?.details?.retryAfter).toBe(10)
    })

    it("应该拒绝空查询", async () => {
      const result = await getSearchSuggestions({
        query: "",
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("VALIDATION_ERROR")
    })

    it("应该拒绝过长的查询", async () => {
      const result = await getSearchSuggestions({
        query: "a".repeat(51), // 超过 50 个字符
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("VALIDATION_ERROR")
    })

    it("应该限制建议数量最大为 10", async () => {
      const result = await getSearchSuggestions({
        query: "test",
        limit: 20, // 超过最大值 10
      })

      expect(result.success).toBe(false)
      expect(result.error?.type).toBe("VALIDATION_ERROR")
    })

    it("应该处理没有结果的情况", async () => {
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchPostSuggestions).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))

      const result = await getSearchSuggestions({
        query: "nonexistent",
        limit: 5,
      })

      expect(result.success).toBe(true)
      expect(result.data?.suggestions).toHaveLength(0)
    })
  })

  describe("searchAuthorCandidates", () => {
    it("应该返回去敏后的作者列表", async () => {
      const mockUsers = [
        {
          id: "user-1",
          name: null,
          avatarUrl: null,
          bio: null,
          role: "USER",
          similarity: 0.92,
        },
      ]

      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult(mockUsers))

      const result = await searchAuthorCandidates({ query: "linus", limit: 3 })

      expect(result.success).toBe(true)
      expect(searchRepo.searchUsers).toHaveBeenCalledWith({ query: "linus", limit: 3, offset: 0 })
      const author = result.data?.authors[0]
      expect(author?.name).toBe("未命名作者")
      expect(author).not.toHaveProperty("email")
    })

    it("应该在触发速率限制时返回错误", async () => {
      vi.mocked(checkSearchRateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 5 })

      const result = await searchAuthorCandidates({ query: "linus" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(result.error?.details?.retryAfter).toBe(5)
    })
  })
})
