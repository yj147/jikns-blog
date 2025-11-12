/**
 * 搜索功能集成测试
 * Phase 11 / M5 / T5.1
 *
 * 测试覆盖：
 * 1. 端到端搜索流程（文章、动态、用户、标签）
 * 2. 搜索建议功能
 * 3. 参数验证
 * 4. 高级过滤器
 *
 * 注意：此测试使用 mock 数据，不依赖真实数据库
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { searchContent, getSearchSuggestions } from "@/lib/actions/search"
import * as searchRepo from "@/lib/repos/search"
import { getCurrentUser } from "@/lib/auth"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { getClientIPOrNullFromHeaders } from "@/lib/utils/client-ip"
import { headers } from "next/headers"

vi.mock("server-only", () => ({}))

// Mock 搜索仓储层
vi.mock("@/lib/repos/search", () => ({
  searchPosts: vi.fn(),
  searchPostSuggestions: vi.fn(),
  searchActivities: vi.fn(),
  searchUsers: vi.fn(),
  searchTags: vi.fn(),
}))

// Mock 认证
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

describe("搜索功能集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: true })
    vi.mocked(getClientIPOrNullFromHeaders).mockReturnValue("127.0.0.1")
    vi.mocked(headers).mockReturnValue(new Headers())
  })

  describe("端到端搜索流程", () => {
    it("应该能够搜索文章并返回正确结果", async () => {
      // Mock 文章搜索结果
      const mockPosts = [
        {
          id: "post-1",
          title: "Next.js 全文搜索实现",
          excerpt: "测试文章摘要",
          slug: "nextjs-search",
          publishedAt: new Date().toISOString(),
          author: {
            id: "user-1",
            name: "测试用户",
            avatarUrl: null,
          },
          tags: [],
          rank: 0.9,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "Next.js",
        type: "posts",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items.length).toBe(1)
        expect(result.data.posts.items[0].title).toContain("Next.js")
        expect(result.data.query).toBe("Next.js")
        expect(result.data.type).toBe("posts")
      }
    })

    it("应该能够搜索动态并返回正确结果", async () => {
      // Mock 动态搜索结果
      const mockActivities = [
        {
          id: "activity-1",
          content: "这是一条关于 React Hooks 的动态",
          createdAt: new Date().toISOString(),
          author: {
            id: "user-1",
            name: "测试用户",
            avatarUrl: null,
          },
          rank: 0.85,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult(mockActivities))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "React Hooks",
        type: "activities",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.activities.items.length).toBe(1)
        expect(result.data.activities.items[0].content).toContain("React Hooks")
      }
    })

    it("应该能够搜索用户并返回正确结果", async () => {
      // Mock 用户搜索结果
      const mockUsers = [
        {
          id: "user-1",
          name: "搜索测试用户",
          avatarUrl: null,
          bio: "测试用户简介",
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult(mockUsers))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "搜索测试用户",
        type: "users",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.users.items.length).toBe(1)
        expect(result.data.users.items[0].name).toContain("搜索测试用户")
      }
    })

    it("应该能够搜索标签并返回正确结果", async () => {
      // Mock 标签搜索结果
      const mockTags = [
        {
          id: "tag-1",
          name: "搜索测试标签",
          slug: "search-test-tag",
          description: "测试标签描述",
          postsCount: 5,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult(mockTags))

      const result = await searchContent({
        query: "搜索测试标签",
        type: "tags",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tags.items.length).toBe(1)
        expect(result.data.tags.items[0].name).toContain("搜索测试标签")
      }
    })

    it("应该能够搜索所有类型并返回综合结果", async () => {
      // Mock 所有类型的搜索结果
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult([
          {
            id: "post-1",
            title: "TypeScript 教程",
            excerpt: "摘要",
            slug: "typescript-tutorial",
            publishedAt: new Date().toISOString(),
            author: { id: "user-1", name: "作者", avatarUrl: null },
            tags: [],
            rank: 0.9,
          },
        ])
      )
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(
        createQueryResult([
          {
            id: "activity-1",
            content: "TypeScript 动态",
            createdAt: new Date().toISOString(),
            author: { id: "user-1", name: "作者", avatarUrl: null },
            rank: 0.8,
          },
        ])
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "TypeScript",
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.posts.items.length).toBe(1)
        expect(result.data.activities.items.length).toBe(1)
        expect(result.data.overallTotal).toBe(2)
      }
    })
  })

  describe("高级过滤器", () => {
    it("应该能够按作者过滤文章", async () => {
      const authorId = "user-1"
      const mockPosts = [
        {
          id: "post-1",
          title: "Next.js 教程",
          excerpt: "摘要",
          slug: "nextjs-tutorial",
          publishedAt: new Date().toISOString(),
          author: { id: authorId, name: "作者", avatarUrl: null },
          tags: [],
          rank: 0.9,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "Next.js",
        type: "posts",
        authorId,
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // 验证 searchPosts 被调用时传入了 authorId
        expect(searchRepo.searchPosts).toHaveBeenCalledWith(expect.objectContaining({ authorId }))
        // 所有返回的文章都应该是该作者的
        result.data.posts.items.forEach((post) => {
          expect(post.author.id).toBe(authorId)
        })
      }
    })

    it("应该能够按标签过滤文章", async () => {
      const tagIds = ["tag-1"]
      const mockPosts = [
        {
          id: "post-1",
          title: "Next.js 教程",
          excerpt: "摘要",
          slug: "nextjs-tutorial",
          publishedAt: new Date().toISOString(),
          author: { id: "user-1", name: "作者", avatarUrl: null },
          tags: [{ id: "tag-1", name: "Next.js", slug: "nextjs" }],
          rank: 0.9,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "Next.js",
        type: "posts",
        tagIds,
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // 验证 searchPosts 被调用时传入了 tagIds
        expect(searchRepo.searchPosts).toHaveBeenCalledWith(expect.objectContaining({ tagIds }))
      }
    })

    it("应该能够按发布日期过滤文章", async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const mockPosts = [
        {
          id: "post-1",
          title: "Next.js 教程",
          excerpt: "摘要",
          slug: "nextjs-tutorial",
          publishedAt: new Date().toISOString(),
          author: { id: "user-1", name: "作者", avatarUrl: null },
          tags: [],
          rank: 0.9,
        },
      ]

      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(mockPosts))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "Next.js",
        type: "posts",
        publishedFrom: yesterday,
        publishedTo: tomorrow,
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // 验证 searchPosts 被调用时传入了日期范围
        expect(searchRepo.searchPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            publishedFrom: yesterday,
            publishedTo: tomorrow,
          })
        )
      }
    })
  })

  describe("权限与限流", () => {
    it("管理员查询草稿时应保留 onlyPublished=false", async () => {
      const draftPosts = [
        {
          id: "post-draft",
          title: "Draft Post",
          excerpt: "草稿摘要",
          slug: "draft-post",
          publishedAt: null,
          author: { id: "admin-1", name: "管理员", avatarUrl: null },
          tags: [],
          rank: 0.5,
          published: false,
        },
      ]

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
        status: "ACTIVE",
      } as any)
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(createQueryResult(draftPosts))
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "draft",
        type: "posts",
        page: 1,
        limit: 20,
        onlyPublished: false,
      })

      expect(result.success).toBe(true)
      expect(searchRepo.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          onlyPublished: false,
        })
      )
      if (result.success) {
        expect(result.data.posts.items[0].published).toBe(false)
      }
    })

    it("触发限流时返回 retryAfter", async () => {
      vi.mocked(checkSearchRateLimit).mockResolvedValue({ allowed: false, retryAfter: 42 })

      const result = await searchContent({
        query: "限流测试",
        type: "all",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
        expect(result.error?.details).toEqual(expect.objectContaining({ retryAfter: 42 }))
      }
    })
  })

  describe("搜索建议功能", () => {
    it("应该返回相关的搜索建议", async () => {
      // Mock 搜索建议结果
      vi.mocked(searchRepo.searchTags).mockResolvedValue(
        createQueryResult([
          {
            id: "tag-1",
            name: "Next.js",
            slug: "nextjs",
            description: "Next.js 框架",
            postsCount: 10,
          },
        ])
      )
      vi.mocked(searchRepo.searchPostSuggestions).mockResolvedValue(
        createQueryResult([
          {
            id: "post-1",
            title: "Next.js 教程",
            excerpt: "摘要",
            slug: "nextjs-tutorial",
            author: { id: "user-1", name: "作者", avatarUrl: null },
          },
        ])
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))

      const result = await getSearchSuggestions({
        query: "Next",
        limit: 5,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data.suggestions)).toBe(true)
        expect(result.data.suggestions.length).toBeLessThanOrEqual(5)

        // 验证建议包含正确的类型
        result.data.suggestions.forEach((suggestion) => {
          expect(["tag", "post", "user"]).toContain(suggestion.type)
          expect(suggestion.text).toBeDefined()
          expect(suggestion.id).toBeDefined()
        })
      }
    })

    it("应该限制建议数量", async () => {
      // Mock 多个建议结果
      vi.mocked(searchRepo.searchTags).mockResolvedValue(
        createQueryResult([
          { id: "tag-1", name: "Tag 1", slug: "tag-1", description: "", postsCount: 5 },
          { id: "tag-2", name: "Tag 2", slug: "tag-2", description: "", postsCount: 3 },
        ])
      )
      vi.mocked(searchRepo.searchPostSuggestions).mockResolvedValue(
        createQueryResult([
          {
            id: "post-1",
            title: "Post 1",
            excerpt: "",
            slug: "post-1",
            author: { id: "user-1", name: "作者", avatarUrl: null },
          },
          {
            id: "post-2",
            title: "Post 2",
            excerpt: "",
            slug: "post-2",
            author: { id: "user-1", name: "作者", avatarUrl: null },
          },
        ])
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))

      const result = await getSearchSuggestions({
        query: "test",
        limit: 3,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.suggestions.length).toBeLessThanOrEqual(3)
      }
    })
  })

  describe("分页功能", () => {
    it("应该正确处理分页参数", async () => {
      // Mock 少量结果
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult([
          {
            id: "post-1",
            title: "Post 1",
            excerpt: "",
            slug: "post-1",
            publishedAt: new Date().toISOString(),
            author: { id: "user-1", name: "作者", avatarUrl: null },
            tags: [],
            rank: 0.9,
          },
        ])
      )
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "test",
        type: "posts", // 使用 posts 而不是 all，避免 limit 被分割
        page: 1,
        limit: 5,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // 验证 searchPosts 被调用时传入了正确的 limit 和 offset
        expect(searchRepo.searchPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 5,
            offset: 0,
          })
        )
      }
    })
  })

  describe("参数验证", () => {
    it("应该拒绝空查询", async () => {
      const result = await searchContent({
        query: "",
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
      }
    })

    it("应该拒绝过长的查询", async () => {
      const result = await searchContent({
        query: "a".repeat(101),
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
      }
    })

    it("应该拒绝无效的 limit 参数", async () => {
      const result = await searchContent({
        query: "test",
        type: "all",
        page: 1,
        limit: 100, // 超过最大值 50
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
      }
    })
  })

  describe("Tab='全部' 分页行为", () => {
    it("应该支持 type='all' 时的分页", async () => {
      // Mock 多个桶都有结果
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult(
          [
            {
              id: "post-1",
              title: "Post 1",
              excerpt: "",
              slug: "post-1",
              publishedAt: new Date().toISOString(),
              author: { id: "user-1", name: "作者", avatarUrl: null },
              tags: [],
              rank: 0.9,
            },
          ],
          50 // total
        )
      )
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(
        createQueryResult(
          [
            {
              id: "activity-1",
              content: "Activity 1",
              createdAt: new Date().toISOString(),
              author: { id: "user-1", name: "作者", avatarUrl: null, role: "USER" },
              rank: 0.8,
            },
          ],
          30 // total
        )
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "test",
        type: "all",
        page: 2, // 第 2 页
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // 验证返回了综合结果
        expect(result.data.overallTotal).toBe(80) // 50 + 30
        expect(result.data.type).toBe("all")

        // 验证分页参数正确传递
        expect(result.data.posts.page).toBe(2)
        expect(result.data.activities.page).toBe(2)
      }
    })

    it("应该正确计算 type='all' 时的 hasMore", async () => {
      // Mock 结果：posts 有更多，activities 没有更多
      vi.mocked(searchRepo.searchPosts).mockResolvedValue(
        createQueryResult(
          [
            {
              id: "post-1",
              title: "Post 1",
              excerpt: "",
              slug: "post-1",
              publishedAt: new Date().toISOString(),
              author: { id: "user-1", name: "作者", avatarUrl: null },
              tags: [],
              rank: 0.9,
            },
          ],
          50 // total，当前 offset=0, limit=20，所以 hasMore=true
        )
      )
      vi.mocked(searchRepo.searchActivities).mockResolvedValue(
        createQueryResult(
          [
            {
              id: "activity-1",
              content: "Activity 1",
              createdAt: new Date().toISOString(),
              author: { id: "user-1", name: "作者", avatarUrl: null, role: "USER" },
              rank: 0.8,
            },
          ],
          1 // total，当前 offset=0, limit=20，所以 hasMore=false
        )
      )
      vi.mocked(searchRepo.searchUsers).mockResolvedValue(createQueryResult([]))
      vi.mocked(searchRepo.searchTags).mockResolvedValue(createQueryResult([]))

      const result = await searchContent({
        query: "test",
        type: "all",
        page: 1,
        limit: 20,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // posts 有更多结果
        expect(result.data.posts.hasMore).toBe(true)
        // activities 没有更多结果
        expect(result.data.activities.hasMore).toBe(false)
      }
    })
  })
})
