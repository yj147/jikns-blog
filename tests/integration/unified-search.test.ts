import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"
import { ErrorCode } from "@/lib/api/unified-response"
import * as errorHandler from "@/lib/api/error-handler"
import { SearchValidationError } from "@/types/search"

vi.unmock("@/lib/prisma")
vi.mock("server-only", () => ({}))

const rateLimitMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/rate-limit/shared", () => ({
  applyDistributedRateLimit: (...args: Parameters<typeof rateLimitMock>) => rateLimitMock(...args),
}))

let prisma: typeof import("@/lib/prisma").prisma
let searchModule: typeof import("@/lib/repos/search/unified-search")
let runUnifiedSearch: typeof import("@/lib/repos/search/unified-search").unifiedSearch
let searchHandler: typeof import("@/app/api/search/route").GET
let originalQueryRaw: typeof import("@/lib/prisma").prisma.$queryRaw

describe("unified search", () => {
  const ids: string[] = []

  beforeAll(async () => {
    const prismaModule = await import("@/lib/prisma")
    prisma = prismaModule.prisma
    searchModule = await import("@/lib/repos/search/unified-search")
    runUnifiedSearch = searchModule.unifiedSearch
    ;({ GET: searchHandler } = await import("@/app/api/search/route"))
    originalQueryRaw = prisma.$queryRaw.bind(prisma)

    const author = await prisma.user.create({
      data: {
        email: "unified-author@example.com",
        name: "Unified Author",
        status: "ACTIVE",
      },
    })
    ids.push(author.id)

    const tag = await prisma.tag.create({
      data: {
        name: "Unified Tag",
        slug: `unified-tag-${Date.now()}`,
        description: "Tag for unified search",
        color: "#3366ff",
        postsCount: 0,
      },
    })
    ids.push(tag.id)

    const recentPost = await prisma.post.create({
      data: {
        title: "Unified search new post",
        titleTokens: "Unified search new post",
        content: "Fresh content about unified search",
        contentTokens: "Fresh content about unified search",
        excerpt: "Unified search excerpt",
        excerptTokens: "Unified search excerpt",
        seoDescriptionTokens: "Unified search",
        slug: `unified-new-${Date.now()}`,
        published: true,
        publishedAt: new Date(),
        authorId: author.id,
      },
    })
    ids.push(recentPost.id)

    const olderPost = await prisma.post.create({
      data: {
        title: "Unified search archived",
        titleTokens: "Unified search archived",
        content: "Older content about unified search",
        contentTokens: "Older content about unified search",
        excerpt: "Archived unified search",
        excerptTokens: "Archived unified search",
        seoDescriptionTokens: "Unified search",
        slug: `unified-old-${Date.now()}`,
        published: true,
        publishedAt: new Date("2024-01-02T00:00:00Z"),
        createdAt: new Date("2024-01-01T00:00:00Z"),
        authorId: author.id,
      },
    })
    ids.push(olderPost.id)

    const activity = await prisma.activity.create({
      data: {
        content: "Unified search activity stream",
        contentTokens: "Unified search activity stream",
        authorId: author.id,
        imageUrls: [],
      },
    })
    ids.push(activity.id)

    const searchUser = await prisma.user.create({
      data: {
        email: "unified-user@example.com",
        name: "Unified User",
        status: "ACTIVE",
      },
    })
    ids.push(searchUser.id)
  })

  afterAll(async () => {
    await prisma.activity.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    await prisma.post.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    await prisma.tag.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {})
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 1,
      retryAfter: undefined,
      backend: "memory",
      limit: 10,
    })
  })

  it("returns results for all buckets", async () => {
    const result = await runUnifiedSearch({ query: "Unified", type: "all", limit: 5, page: 1 })

    expect(result.overallTotal).toBeGreaterThan(0)
    expect(result.posts.items.length).toBeGreaterThan(0)
    expect(result.activities.items.length).toBeGreaterThan(0)
    expect(result.users.items.length).toBeGreaterThan(0)
    expect(result.tags.items.length).toBeGreaterThan(0)
  })

  it("prefers newer content via time-weighted rank", async () => {
    const result = await runUnifiedSearch({
      query: "Unified",
      type: "posts",
      limit: 2,
      page: 1,
      sort: "relevance",
    })
    expect(result.posts.items.length).toBeGreaterThan(1)
    const [first, second] = result.posts.items
    expect(first.publishedAt && second.publishedAt).toBeTruthy()
    expect(first.publishedAt.getTime()).toBeGreaterThan(second.publishedAt!.getTime())
  })

  it("falls back to LIKE when FTS throws", async () => {
    const spy = vi.spyOn(prisma as any, "$queryRaw")
    spy.mockImplementation((...args: any[]) => originalQueryRaw(...(args as any)))
    spy.mockRejectedValueOnce(new Error("fts failure"))

    const result = await runUnifiedSearch({ query: "Unified", type: "posts", limit: 5, page: 1 })

    expect(result.posts.items.length).toBeGreaterThan(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("falls back to LIKE for users when FTS fails", async () => {
    const spy = vi.spyOn(prisma as any, "$queryRaw")
    spy.mockImplementation((...args: any[]) => originalQueryRaw(...(args as any)))
    spy.mockRejectedValueOnce(new Error("fts user failure"))

    const result = await runUnifiedSearch({ query: "Unified", type: "users", limit: 5, page: 1 })

    expect(result.users.items.length).toBeGreaterThan(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("falls back to LIKE for activities when FTS fails", async () => {
    const spy = vi.spyOn(prisma as any, "$queryRaw")
    spy.mockImplementation((...args: any[]) => originalQueryRaw(...(args as any)))
    spy.mockRejectedValueOnce(new Error("fts activity failure"))

    const result = await runUnifiedSearch({
      query: "Unified",
      type: "activities",
      limit: 5,
      page: 1,
    })

    expect(result.activities.items.length).toBeGreaterThan(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("falls back to LIKE for tags when FTS fails", async () => {
    const spy = vi.spyOn(prisma as any, "$queryRaw")
    spy.mockImplementation((...args: any[]) => originalQueryRaw(...(args as any)))
    spy.mockRejectedValueOnce(new Error("fts tag failure"))

    const result = await runUnifiedSearch({ query: "Unified", type: "tags", limit: 5, page: 1 })

    expect(result.tags.items.length).toBeGreaterThan(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("API route returns unified response", async () => {
    const searchSpy = vi.spyOn(searchModule, "unifiedSearch").mockResolvedValue({
      query: "Unified",
      type: "all",
      page: 1,
      limit: 5,
      overallTotal: 0,
      posts: { items: [], total: 0, page: 1, limit: 5, hasMore: false },
      activities: { items: [], total: 0, page: 1, limit: 5, hasMore: false },
      users: { items: [], total: 0, page: 1, limit: 5, hasMore: false },
      tags: { items: [], total: 0, page: 1, limit: 5, hasMore: false },
    })
    const request = new NextRequest("http://localhost:3000/api/search?q=Unified&type=all&limit=5")
    const response = await searchHandler(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.query).toBe("Unified")
    searchSpy.mockRestore()
  })

  it("API route rejects negative limit with Zod validation", async () => {
    const request = new NextRequest("http://localhost:3000/api/search?q=Unified&type=all&limit=-1")
    const response = await searchHandler(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(body.error.details.field).toBe("limit")
  })

  it("API route surfaces SearchValidationError from service", async () => {
    const searchSpy = vi
      .spyOn(searchModule, "unifiedSearch")
      .mockRejectedValue(new SearchValidationError("服务校验失败", { reason: "invalid" }))
    const request = new NextRequest("http://localhost:3000/api/search?q=Unified&type=all")
    const response = await searchHandler(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(body.error.details.reason).toBe("invalid")
    searchSpy.mockRestore()
  })

  it("API route delegates unknown errors to handleApiError", async () => {
    const genericError = new Error("boom")
    const searchSpy = vi.spyOn(searchModule, "unifiedSearch").mockRejectedValue(genericError)
    const apiErrorSpy = vi.spyOn(errorHandler, "handleApiError")

    const request = new NextRequest("http://localhost:3000/api/search?q=Unified&type=all")
    const response = await searchHandler(request)
    const body = await response.json()

    expect(apiErrorSpy).toHaveBeenCalledWith(genericError)
    expect(response.status).toBe(500)
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR)

    apiErrorSpy.mockRestore()
    searchSpy.mockRestore()
  })

  it("API route rejects illegal query tokens", async () => {
    const request = new NextRequest("http://localhost:3000/api/search?q=bad;drop&type=all")
    const response = await searchHandler(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it("API route returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 30,
      backend: "memory",
      remaining: 0,
      limit: 10,
    })
    const request = new NextRequest("http://localhost:3000/api/search?q=Unified&type=all")
    const response = await searchHandler(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED")
    expect(body.error.details.retryAfter).toBe(30)
  })
})
