/**
 * 标签 Server Actions 单元测试
 * Phase 10 - M1 阶段
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getTags,
  getTag,
  getPopularTags,
  searchTags,
  getTagCandidates,
  promoteTagCandidate,
  createTag,
  updateTag,
  deleteTag,
  mergeTags,
} from "@/lib/actions/tags"
import { withTagSearchRateLimit } from "@/lib/actions/tags/queries"
import { createSuccessResponse } from "@/lib/actions/tags/response-helpers"
import * as permissions from "@/lib/permissions"
import { AuthError } from "@/lib/error-handling/auth-error"

const prisma = vi.hoisted(() => {
  const client = {
    tag: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    postTag: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      groupBy: vi.fn(),
    },
    activityTag: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      groupBy: vi.fn(),
    },
    activityTagCandidate: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(client as any)
      }
      return Promise.all(arg)
    }),
  }
  return client
})

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma,
}))

// Mock permissions
vi.mock("@/lib/permissions", () => ({
  requireAdmin: vi.fn(),
}))

// Mock logger
const rateLimitMocks = vi.hoisted(() => ({
  enforce: vi.fn(),
}))

const auditLogMocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
}))

const authSessionMocks = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
}))

vi.mock("@/lib/rate-limit/tag-limits", () => ({
  enforceTagRateLimitForUser: (...args: Parameters<typeof rateLimitMocks.enforce>) =>
    rateLimitMocks.enforce(...args),
  enforceTagRateLimitForHeaders: (...args: Parameters<typeof rateLimitMocks.enforce>) =>
    rateLimitMocks.enforce(...args),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: {
    logEvent: (...args: Parameters<typeof auditLogMocks.logEvent>) =>
      auditLogMocks.logEvent(...args),
  },
  AuditEventType: {
    ADMIN_ACTION: "ADMIN_ACTION",
  },
}))

vi.mock("@/lib/server-context", () => ({
  getServerContext: () => ({
    requestId: "req-test",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  }),
}))

vi.mock("@/lib/auth/session", () => ({
  getOptionalViewer: (...args: Parameters<typeof authSessionMocks.getOptionalViewer>) =>
    authSessionMocks.getOptionalViewer(...args),
}))

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  authLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock Next.js cache - 使用 vi.hoisted() 提升变量
const cacheMocks = vi.hoisted(() => {
  const tagCacheStore = new Map<string, any>()
  const revalidatePathMock = vi.fn()
  const revalidateTagMock = vi.fn()

  return {
    tagCacheStore,
    revalidatePathMock,
    revalidateTagMock,
  }
})

vi.mock("next/cache", () => {
  const unstable_cache = (fn: any, keys?: unknown, _options?: unknown) => {
    return async (...args: any[]) => {
      const cacheKey = JSON.stringify({ keys, args })
      if (cacheMocks.tagCacheStore.has(cacheKey)) {
        return cacheMocks.tagCacheStore.get(cacheKey)
      }
      const result = await fn(...args)
      cacheMocks.tagCacheStore.set(cacheKey, result)
      return result
    }
  }

  return {
    revalidatePath: cacheMocks.revalidatePathMock,
    revalidateTag: cacheMocks.revalidateTagMock,
    unstable_cache,
  }
})

// Mock cache-helpers to use the same mocks
vi.mock("@/lib/actions/tags/cache-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/actions/tags/cache-helpers")>(
    "@/lib/actions/tags/cache-helpers"
  )
  return {
    ...actual,
    revalidateTagCaches: vi.fn(() => {
      cacheMocks.revalidatePathMock("/admin/tags")
      cacheMocks.revalidatePathMock("/tags")
      cacheMocks.revalidateTagMock("tags:list")
      cacheMocks.revalidateTagMock("tags:detail")
    }),
    revalidateTagDetail: vi.fn((slug: string) => {
      cacheMocks.revalidatePathMock(`/tags/${slug}`)
    }),
  }
})

// Mock Next.js headers
vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}))

describe("标签查询 API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.enforce.mockResolvedValue({ allowed: true })
    cacheMocks.tagCacheStore.clear()
    auditLogMocks.logEvent.mockResolvedValue(undefined)
    authSessionMocks.getOptionalViewer.mockResolvedValue(null)
  })

  describe("getTags", () => {
    it("应该返回标签列表（默认参数）", async () => {
      const mockTags = [
        {
          id: "tag1",
          name: "JavaScript",
          slug: "javascript",
          description: "JS 相关",
          color: "#f7df1e",
          postsCount: 10,
          activitiesCount: 0,
          createdAt: new Date(),
        },
        {
          id: "tag2",
          name: "TypeScript",
          slug: "typescript",
          description: "TS 相关",
          color: "#3178c6",
          postsCount: 5,
          activitiesCount: 0,
          createdAt: new Date(),
        },
      ]

      vi.mocked(prisma.tag.count).mockResolvedValue(2)
      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags)

      const result = await getTags()

      expect(result.success).toBe(true)
      expect(result.data?.tags).toHaveLength(2)
      expect(result.data?.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      })
    })

    it("在 skipRateLimit 时不触发限流检查", async () => {
      const mockTags = [
        {
          id: "tag1",
          name: "Node.js",
          slug: "node-js",
          description: "",
          color: "#43853d",
          postsCount: 3,
          activitiesCount: 0,
          createdAt: new Date(),
        },
      ]

      vi.mocked(prisma.tag.count).mockResolvedValue(1)
      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags as any)

      await getTags({}, { skipRateLimit: true })

      expect(rateLimitMocks.enforce).not.toHaveBeenCalled()
    })

    it("应该支持分页参数", async () => {
      vi.mocked(prisma.tag.count).mockResolvedValue(50)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      await getTags({ page: 2, limit: 10 })

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      )
    })

    it("应该支持搜索参数", async () => {
      vi.mocked(prisma.tag.count).mockResolvedValue(1)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      await getTags({ search: "java" })

      expect(prisma.tag.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: "java",
            mode: "insensitive",
          },
        },
      })
    })

    it("非法搜索关键词会被自动清洗并回退", async () => {
      vi.mocked(prisma.tag.count).mockResolvedValue(0)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      const result = await getTags({ search: "%#AI" })

      expect(result.success).toBe(true)
      expect(prisma.tag.count).toHaveBeenCalledWith({
        where: {
          name: {
            contains: "AI",
            mode: "insensitive",
          },
        },
      })
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: "AI",
              mode: "insensitive",
            },
          },
        })
      )
    })

    it("应该支持排序参数", async () => {
      vi.mocked(prisma.tag.count).mockResolvedValue(0)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      await getTags({ orderBy: "name", order: "asc" })

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: "asc" },
        })
      )
    })

    it("应该处理参数验证错误", async () => {
      const result = await getTags({ page: -1 } as any)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("应该处理空结果", async () => {
      vi.mocked(prisma.tag.count).mockResolvedValue(0)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      const result = await getTags()

      expect(result.success).toBe(true)
      expect(result.data?.tags).toHaveLength(0)
      expect(result.data?.pagination.total).toBe(0)
    })

    it("空数据时 totalPages 至少为 1", async () => {
      vi.mocked(prisma.tag.count).mockResolvedValue(0)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      const result = await getTags({ limit: 10 })

      expect(result.success).toBe(true)
      expect(result.data?.pagination.totalPages).toBe(1)
      expect(result.data?.pagination.hasMore).toBe(false)
    })

    it("重复调用相同参数时应命中缓存并避免重复查询", async () => {
      const mockTags = [
        {
          id: "tag-cache",
          name: "Caching",
          slug: "caching",
          description: null,
          color: null,
          postsCount: 1,
          createdAt: new Date(),
        },
      ]

      vi.mocked(prisma.tag.count).mockResolvedValue(1)
      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags)

      const firstResult = await getTags({ page: 1, limit: 20 })
      const secondResult = await getTags({ page: 1, limit: 20 })

      expect(firstResult.success).toBe(true)
      expect(secondResult.success).toBe(true)
      expect(prisma.tag.count).toHaveBeenCalledTimes(1)
      expect(prisma.tag.findMany).toHaveBeenCalledTimes(1)
      expect(secondResult.data?.tags).toEqual(firstResult.data?.tags)
    })
  })

  describe("withTagSearchRateLimit", () => {
    it("在 skipRateLimit 时不会触发限流检查", async () => {
      const operation = vi.fn().mockResolvedValue(createSuccessResponse({ ok: true }))

      const result = await withTagSearchRateLimit("获取标签列表", operation, {
        skipRateLimit: true,
      })

      expect(rateLimitMocks.enforce).not.toHaveBeenCalled()
      expect(operation).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })
  })

  describe("getTag", () => {
    it("应该通过 slug 查询标签", async () => {
      const mockTag = {
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: "JS 相关",
        color: "#f7df1e",
        postsCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.tag.findFirst).mockResolvedValue(mockTag)

      const result = await getTag("javascript")

      expect(result.success).toBe(true)
      expect(result.data?.tag.slug).toBe("javascript")
      expect(prisma.tag.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ slug: "javascript" }, { id: "javascript" }],
        },
        select: expect.any(Object),
      })
    })

    it("应该通过 ID 查询标签", async () => {
      const mockTag = {
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: null,
        color: null,
        postsCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.tag.findFirst).mockResolvedValue(mockTag)

      const result = await getTag("tag1")

      expect(result.success).toBe(true)
      expect(result.data?.tag.id).toBe("tag1")
    })

    it("应该处理标签不存在的情况", async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null)

      const result = await getTag("nonexistent")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("NOT_FOUND")
    })

    it("应该处理空参数", async () => {
      const result = await getTag("")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("限流触发时应返回 RATE_LIMIT_EXCEEDED", async () => {
      const rateLimitError = Object.assign(new Error("标签搜索请求过多，请稍后再试"), {
        statusCode: 429,
        retryAfter: 15,
      })
      rateLimitMocks.enforce.mockRejectedValueOnce(rateLimitError)

      const result = await getTag("javascript")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(result.error?.details?.retryAfter).toBe(15)
      expect(prisma.tag.findFirst).not.toHaveBeenCalled()
    })
  })

  describe("getPopularTags", () => {
    it("应该返回热门标签", async () => {
      const mockTags = [
        {
          id: "tag1",
          name: "JavaScript",
          slug: "javascript",
          color: null,
          postsCount: 100,
          activitiesCount: 0,
        },
        {
          id: "tag2",
          name: "TypeScript",
          slug: "typescript",
          color: null,
          postsCount: 50,
          activitiesCount: 0,
        },
      ]

      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags)

      const result = await getPopularTags()

      expect(result.success).toBe(true)
      expect(result.data?.tags).toHaveLength(2)
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { postsCount: { gt: 0 } },
        orderBy: { postsCount: "desc" },
        take: 10,
        select: expect.any(Object),
      })
    })

    it("应该限制返回数量", async () => {
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      await getPopularTags(5)

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      )
    })

    it("应该限制最大返回数量为50", async () => {
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])

      await getPopularTags(100)

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })
  })

  describe("searchTags", () => {
    it("应该搜索标签", async () => {
      const mockTags = [
        { id: "tag1", name: "JavaScript", slug: "javascript", postsCount: 10 },
        { id: "tag2", name: "Java", slug: "java", postsCount: 5 },
      ]
      vi.mocked(prisma.tag.findMany).mockResolvedValue(mockTags)
      vi.mocked(rateLimitMocks.enforce).mockResolvedValue({ allowed: true })

      const result = await searchTags("java")

      expect(result.success).toBe(true)
      expect(result.data?.tags).toHaveLength(2)
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: "java",
              mode: "insensitive",
            },
          },
          take: 10,
          select: expect.any(Object),
        })
      )
    })

    it("应该处理空查询", async () => {
      vi.mocked(rateLimitMocks.enforce).mockResolvedValue({ allowed: true })

      const result = await searchTags("")

      expect(result.success).toBe(true)
      expect(result.data?.tags).toHaveLength(0)
    })

    it("应该限制返回数量", async () => {
      vi.mocked(prisma.tag.findMany).mockResolvedValue([])
      vi.mocked(rateLimitMocks.enforce).mockResolvedValue({ allowed: true })

      await searchTags("test", 5)

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      )
    })

    it("限流触发时应返回 RATE_LIMIT_EXCEEDED", async () => {
      const rateLimitError = Object.assign(new Error("标签搜索请求过多，请稍后再试"), {
        statusCode: 429,
        retryAfter: 20,
      })
      rateLimitMocks.enforce.mockRejectedValueOnce(rateLimitError)

      const result = await searchTags("java")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(result.error?.details?.retryAfter).toBe(20)
      expect(prisma.tag.findMany).not.toHaveBeenCalled()
    })
  })
})

describe("标签候选操作", () => {
  const adminUser = { id: "admin-1" } as any

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.enforce.mockResolvedValue({ allowed: true })
    cacheMocks.tagCacheStore.clear()
    auditLogMocks.logEvent.mockResolvedValue(undefined)
    authSessionMocks.getOptionalViewer.mockResolvedValue(null)
  })

  it("应该返回 hashtag 候选列表", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    const records = [
      {
        id: "cand-1",
        name: "Next.js",
        slug: "next-js",
        occurrences: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        lastSeenActivityId: "act-1",
      },
      {
        id: "cand-2",
        name: "Prisma",
        slug: "prisma",
        occurrences: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        lastSeenActivityId: null,
      },
    ]
    vi.mocked(prisma.activityTagCandidate.count).mockResolvedValue(records.length)
    vi.mocked(prisma.activityTagCandidate.findMany).mockResolvedValue(records)

    const result = await getTagCandidates({ limit: 5 })

    expect(result.success).toBe(true)
    expect(result.data?.candidates).toHaveLength(2)
    expect(prisma.activityTagCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { occurrences: "desc" },
        take: 5,
      })
    )
  })

  it("应该在搜索词包含 # 前缀时正确过滤", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    vi.mocked(prisma.activityTagCandidate.count).mockResolvedValue(0)
    vi.mocked(prisma.activityTagCandidate.findMany).mockResolvedValue([])

    await getTagCandidates({ search: "#Next.js", limit: 10 })

    expect(prisma.activityTagCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "Next.js", mode: "insensitive" } },
            { slug: { contains: "Next.js", mode: "insensitive" } },
          ],
        },
      })
    )
  })

  it("应该在搜索词仅包含特殊字符时提示验证错误", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)

    const result = await getTagCandidates({ search: "#", limit: 10 })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("VALIDATION_ERROR")
    expect(prisma.activityTagCandidate.findMany).not.toHaveBeenCalled()
    expect(prisma.activityTagCandidate.count).not.toHaveBeenCalled()
  })

  it("应该在未授权时返回错误", async () => {
    vi.mocked(permissions.requireAdmin).mockRejectedValue(
      new AuthError("FORBIDDEN", "需要管理员权限", 403)
    )

    const result = await getTagCandidates()

    expect(result.success).toBe(false)
    expect(result.error?.message).toBeTruthy()
  })

  it("应该将候选标签提升为正式标签", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    const candidate = {
      id: "cand-1",
      name: "Next.js",
      slug: "next-js",
      occurrences: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      lastSeenActivityId: "act-123",
    }
    const createdTag = {
      id: "tag-123",
      name: "Next.js",
      slug: "next-js",
      description: null,
      color: null,
      postsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.activityTagCandidate.findUnique).mockResolvedValue(candidate)
    vi.mocked(prisma.tag.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.tag.create).mockResolvedValue(createdTag)
    vi.mocked(prisma.activityTagCandidate.delete).mockResolvedValue(candidate as any)

    const result = await promoteTagCandidate(candidate.id)

    expect(result.success).toBe(true)
    expect(result.data?.tag.slug).toBe("next-js")
    expect(prisma.activityTagCandidate.delete).toHaveBeenCalledWith({
      where: { id: candidate.id },
    })
    expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TAG_PROMOTE",
        success: true,
      })
    )
  })

  it("在候选不存在时返回 NOT_FOUND", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    vi.mocked(prisma.activityTagCandidate.findUnique).mockResolvedValue(null)

    const result = await promoteTagCandidate("missing-id")

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
  })

  it("在目标 slug 已存在时阻止提升", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    const candidate = {
      id: "cand-dup",
      name: "React",
      slug: "react",
      occurrences: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      lastSeenActivityId: null,
    }
    vi.mocked(prisma.activityTagCandidate.findUnique).mockResolvedValue(candidate)
    vi.mocked(prisma.tag.findFirst).mockResolvedValue({ id: "tag-react" } as any)

    const result = await promoteTagCandidate(candidate.id)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("DUPLICATE_ENTRY")
  })

  it("在事务阶段发生 P2025 时返回 NOT_FOUND", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    const candidate = {
      id: "cand-stale",
      name: "Stale",
      slug: "stale",
      occurrences: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      lastSeenActivityId: null,
    }
    const createdTag = {
      id: "tag-stale",
      name: "Stale",
      slug: "stale",
      description: null,
      color: null,
      postsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.activityTagCandidate.findUnique).mockResolvedValue(candidate as any)
    vi.mocked(prisma.tag.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.tag.create).mockResolvedValue(createdTag as any)
    vi.mocked(prisma.activityTagCandidate.delete).mockRejectedValue(
      Object.assign(new Error("Record to delete does not exist"), { code: "P2025" })
    )

    const result = await promoteTagCandidate(candidate.id)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
  })

  it("在速率限制触发时返回 RATE_LIMIT_EXCEEDED", async () => {
    vi.mocked(permissions.requireAdmin).mockResolvedValue(adminUser)
    rateLimitMocks.enforce.mockRejectedValue(
      Object.assign(new Error("Too many"), { statusCode: 429, retryAfter: 60 })
    )

    const result = await promoteTagCandidate("cand-late")

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
  })
})

describe("标签管理 API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.enforce.mockResolvedValue({ allowed: true })
    cacheMocks.tagCacheStore.clear()
    auditLogMocks.logEvent.mockResolvedValue(undefined)
    authSessionMocks.getOptionalViewer.mockResolvedValue(null)
  })

  describe("createTag", () => {
    it("应该成功创建标签", async () => {
      const mockAdmin = { id: "admin1", role: "ADMIN", status: "ACTIVE" }
      vi.mocked(permissions.requireAdmin).mockResolvedValue(mockAdmin as any)

      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.tag.create).mockResolvedValue({
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: "JS 相关",
        color: "#f7df1e",
        postsCount: 0,
        activitiesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createTag({
        name: "JavaScript",
        description: "JS 相关",
        color: "#f7df1e",
      })

      expect(result.success).toBe(true)
      expect(result.data?.tag.name).toBe("JavaScript")
      expect(permissions.requireAdmin).toHaveBeenCalled()
      expect(prisma.tag.create).toHaveBeenCalled()
      expect(rateLimitMocks.enforce).toHaveBeenCalledWith("mutation", "admin1")

      // 验证缓存失效逻辑
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/admin/tags")
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/tags")
      expect(cacheMocks.revalidateTagMock).toHaveBeenCalledWith("tags:list")
      expect(cacheMocks.revalidateTagMock).toHaveBeenCalledWith("tags:detail")

      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_CREATE",
          success: true,
          userId: "admin1",
        })
      )
    })

    it("应该检查权限", async () => {
      vi.mocked(permissions.requireAdmin).mockRejectedValue(
        new AuthError("需要管理员权限", "FORBIDDEN", 403)
      )

      const result = await createTag({ name: "Test" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("FORBIDDEN")
      expect(result.error?.details?.statusCode).toBe(403)
    })

    it("应该检查名称唯一性", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findFirst).mockResolvedValue({
        id: "existing",
        name: "JavaScript",
        slug: "javascript",
        description: null,
        color: null,
        postsCount: 0,
        activitiesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createTag({ name: "JavaScript" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("DUPLICATE_ENTRY")
      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_CREATE",
          success: false,
        })
      )
    })

    it("应该验证参数", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)

      const result = await createTag({ name: "" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("应该验证颜色格式", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)

      const result = await createTag({
        name: "Test",
        color: "invalid",
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("限流触发时应返回 RATE_LIMIT_EXCEEDED", async () => {
      const rateLimitError = Object.assign(new Error("标签操作过于频繁，请稍后再试"), {
        statusCode: 429,
        retryAfter: 30,
      })
      rateLimitMocks.enforce.mockRejectedValueOnce(rateLimitError)
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)

      const result = await createTag({ name: "JavaScript" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(result.error?.details?.retryAfter).toBe(30)
    })

    it("并发创建同名标签时应返回 DUPLICATE_ENTRY", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null)
      const prismaError = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: "Tag_name_key" },
      })
      vi.mocked(prisma.tag.create).mockRejectedValue(prismaError)

      const result = await createTag({ name: "JavaScript" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("DUPLICATE_ENTRY")
      expect(result.error?.message).toContain("已存在")
    })
  })

  describe("updateTag", () => {
    it("应该成功更新标签", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue({
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: null,
        color: null,
        postsCount: 10,
        activitiesCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.tag.update).mockResolvedValue({
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: "Updated",
        color: null,
        postsCount: 10,
        activitiesCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateTag("tag1", { description: "Updated" })

      expect(result.success).toBe(true)
      expect(permissions.requireAdmin).toHaveBeenCalled()
      expect(prisma.tag.update).toHaveBeenCalled()
      expect(rateLimitMocks.enforce).toHaveBeenCalledWith("mutation", "admin1")

      // 验证缓存失效逻辑
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/admin/tags")
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/tags")
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/tags/javascript")
      expect(cacheMocks.revalidateTagMock).toHaveBeenCalledWith("tags:list")
      expect(cacheMocks.revalidateTagMock).toHaveBeenCalledWith("tags:detail")

      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_UPDATE",
          success: true,
          userId: "admin1",
        })
      )
    })

    it("应该检查标签是否存在", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue(null)

      const result = await updateTag("nonexistent", { description: "Test" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("NOT_FOUND")
      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_UPDATE",
          success: false,
        })
      )
    })

    it("应该在更新名称时重新生成 slug", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue({
        id: "tag1",
        name: "OldName",
        slug: "oldname",
        description: null,
        color: null,
        postsCount: 0,
        activitiesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.tag.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.tag.update).mockResolvedValue({
        id: "tag1",
        name: "NewName",
        slug: "newname",
        description: null,
        color: null,
        postsCount: 0,
        activitiesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateTag("tag1", { name: "NewName" })

      expect(result.success).toBe(true)
      expect(prisma.tag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "NewName",
            slug: expect.any(String),
          }),
        })
      )
      expect(rateLimitMocks.enforce).toHaveBeenCalledWith("mutation", "admin1")
    })

    it("应该要求至少一个更新字段", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)

      const result = await updateTag("tag1", {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("应该在权限不足时返回FORBIDDEN错误", async () => {
      vi.mocked(permissions.requireAdmin).mockRejectedValue(
        new AuthError("需要管理员权限", "FORBIDDEN", 403)
      )

      const result = await updateTag("tag1", { name: "NewName" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("FORBIDDEN")
      expect(result.error?.details?.statusCode).toBe(403)
    })

    it("并发更新为已存在名称时应返回 DUPLICATE_ENTRY", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue({
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: null,
        color: null,
        postsCount: 0,
        activitiesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      const prismaError = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: "Tag_slug_key" },
      })
      vi.mocked(prisma.tag.update).mockRejectedValue(prismaError)

      const result = await updateTag("tag1", { name: "TypeScript" })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("DUPLICATE_ENTRY")
      expect(result.error?.message).toContain("已存在")
    })
  })

  describe("deleteTag", () => {
    it("应该成功删除标签", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue({
        id: "tag1",
        name: "JavaScript",
        slug: "javascript",
        description: null,
        color: null,
        postsCount: 5,
        activitiesCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.postTag.deleteMany).mockResolvedValue({ count: 2 } as any)
      vi.mocked(prisma.activityTag.deleteMany).mockResolvedValue({ count: 1 } as any)
      vi.mocked(prisma.tag.delete).mockResolvedValue({} as any)

      const result = await deleteTag("tag1")

      expect(result.success).toBe(true)
      expect(result.data?.message).toContain("JavaScript")
      expect(permissions.requireAdmin).toHaveBeenCalled()
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: "tag1" } })
      expect(prisma.postTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "tag1" } })
      expect(prisma.activityTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "tag1" } })
      expect(rateLimitMocks.enforce).toHaveBeenCalledWith("mutation", "admin1")

      // 验证缓存失效逻辑
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/admin/tags")
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/tags")
      expect(cacheMocks.revalidatePathMock).toHaveBeenCalledWith("/tags/javascript")
      expect(cacheMocks.revalidateTagMock).toHaveBeenCalledWith("tags:list")
      expect(cacheMocks.revalidateTagMock).toHaveBeenCalledWith("tags:detail")

      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_DELETE",
          success: true,
          userId: "admin1",
        })
      )
    })

    it("应该检查标签是否存在", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue(null)

      const result = await deleteTag("nonexistent")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("NOT_FOUND")
      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_DELETE",
          success: false,
        })
      )
    })

    it("应该验证标签ID", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)

      const result = await deleteTag("")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("应该检查权限", async () => {
      vi.mocked(permissions.requireAdmin).mockRejectedValue(
        new AuthError("需要管理员权限", "FORBIDDEN", 403)
      )

      const result = await deleteTag("tag1")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("FORBIDDEN")
      expect(result.error?.details?.statusCode).toBe(403)
    })
  })

  describe("mergeTags", () => {
    it("应该成功迁移文章与动态关联并删除源标签", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([
        { id: "source", name: "Old", slug: "old" },
        { id: "target", name: "New", slug: "new" },
      ] as any)
      vi.mocked(prisma.postTag.findMany).mockResolvedValue([
        { postId: "post-1" },
        { postId: "post-2" },
      ] as any)
      vi.mocked(prisma.activityTag.findMany).mockResolvedValue([{ activityId: "act-1" }] as any)
      vi.mocked(prisma.postTag.groupBy).mockResolvedValue([
        { tagId: "target", _count: { _all: 2 } },
      ] as any)
      vi.mocked(prisma.activityTag.groupBy).mockResolvedValue([
        { tagId: "target", _count: { _all: 1 } },
      ] as any)
      vi.mocked(prisma.tag.update).mockResolvedValue({} as any)
      vi.mocked(prisma.tag.delete).mockResolvedValue({} as any)
      vi.mocked(prisma.tag.findUnique).mockResolvedValue({
        id: "target",
        name: "New",
        slug: "new",
        description: null,
        color: null,
        postsCount: 2,
        activitiesCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const result = await mergeTags("source", "target")

      expect(result.success).toBe(true)
      expect(prisma.postTag.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { postId: "post-1", tagId: "target" },
            { postId: "post-2", tagId: "target" },
          ],
          skipDuplicates: true,
        })
      )
      expect(prisma.activityTag.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ activityId: "act-1", tagId: "target" }],
          skipDuplicates: true,
        })
      )
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: "source" } })
      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_MERGE",
          success: true,
          userId: "admin1",
        })
      )
    })

    it("应该校验源与目标标签ID", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)

      const result = await mergeTags("", "")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
      expect(auditLogMocks.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "TAG_MERGE", success: false })
      )
    })

    it("找不到标签时返回 NOT_FOUND", async () => {
      vi.mocked(permissions.requireAdmin).mockResolvedValue({ id: "admin1" } as any)
      vi.mocked(prisma.tag.findMany).mockResolvedValue([{ id: "target", name: "New", slug: "new" }] as any)

      const result = await mergeTags("source", "target")

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("NOT_FOUND")
    })
  })
})
