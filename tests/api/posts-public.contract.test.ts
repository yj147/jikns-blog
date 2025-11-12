import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/posts/route"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

const mockedPrisma = vi.mocked(prisma)

describe("公开文章 API 契约", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.FEATURE_POSTS_PUBLIC_EMAIL_AUDIT
    delete process.env.FEATURE_POSTS_PUBLIC_HIDE_AUTHOR_EMAIL
    delete process.env.FEATURE_POSTS_PUBLIC_PARAM_MONITOR
    delete process.env.FEATURE_POSTS_PUBLIC_PARAM_ENFORCE
  })

  afterEach(() => {
    delete process.env.FEATURE_POSTS_PUBLIC_EMAIL_AUDIT
    delete process.env.FEATURE_POSTS_PUBLIC_HIDE_AUTHOR_EMAIL
    delete process.env.FEATURE_POSTS_PUBLIC_PARAM_MONITOR
    delete process.env.FEATURE_POSTS_PUBLIC_PARAM_ENFORCE
  })

  it("默认应隐藏作者 email 并保留 avatar", async () => {
    process.env.FEATURE_POSTS_PUBLIC_HIDE_AUTHOR_EMAIL = "true"

    mockedPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "测试文章",
        excerpt: "摘要",
        slug: "test-post",
        publishedAt: new Date("2025-09-20T12:00:00Z"),
        author: {
          id: "author-1",
          name: "Alice",
          avatarUrl: "https://example.com/avatar.png",
        },
        series: null,
        tags: [],
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      },
    ] as any)
    mockedPrisma.post.count.mockResolvedValueOnce(1 as any)

    const request = new NextRequest("http://localhost:3000/api/posts?page=1&limit=5")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.posts).toHaveLength(1)
    expect(body.data.posts[0].author).toEqual({
      id: "author-1",
      name: "Alice",
      avatarUrl: "https://example.com/avatar.png",
    })
    expect(body.data.posts[0].author.email).toBeUndefined()
  })

  it("当审计开关开启且仍返回 email 时，应该记录审计日志", async () => {
    process.env.FEATURE_POSTS_PUBLIC_EMAIL_AUDIT = "true"
    process.env.FEATURE_POSTS_PUBLIC_HIDE_AUTHOR_EMAIL = "false"

    mockedPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post-2",
        title: "第二篇文章",
        excerpt: null,
        slug: "second-post",
        publishedAt: new Date("2025-09-21T00:00:00Z"),
        author: {
          id: "author-2",
          name: "Bob",
          email: "bob@example.com",
          avatarUrl: null,
        },
        series: null,
        tags: [],
        _count: { comments: 2, likes: 3, bookmarks: 1 },
      },
    ] as any)
    mockedPrisma.post.count.mockResolvedValueOnce(1 as any)

    const infoSpy = vi.spyOn(apiLogger, "info")

    const request = new NextRequest("http://localhost:3000/api/posts?limit=1", {
      headers: {
        "x-request-id": "req-audit",
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "vitest",
      },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.meta?.requestId).toBe("req-audit")
    expect(infoSpy).toHaveBeenCalledWith(
      "posts_public_api_email_audit",
      expect.objectContaining({
        requestId: "req-audit",
        ipAddress: "203.0.113.10",
        containsAuthorEmail: true,
      })
    )

    infoSpy.mockRestore()
  })

  it("非法 limit 在监控模式下应被截断并记录", async () => {
    process.env.FEATURE_POSTS_PUBLIC_PARAM_MONITOR = "true"

    mockedPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post-3",
        title: "第三篇文章",
        excerpt: null,
        slug: "third-post",
        publishedAt: new Date("2025-09-22T00:00:00Z"),
        author: {
          id: "author-3",
          name: "Charlie",
          avatarUrl: null,
        },
        series: null,
        tags: [],
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      },
    ] as any)
    mockedPrisma.post.count.mockResolvedValueOnce(1 as any)

    const warnSpy = vi.spyOn(apiLogger, "warn")

    const request = new NextRequest("http://localhost:3000/api/posts?limit=500")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockedPrisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
    expect(warnSpy).toHaveBeenCalledWith(
      "posts_public_param_violation",
      expect.objectContaining({
        violations: expect.arrayContaining([
          expect.objectContaining({ param: "limit", value: "500" }),
        ]),
      })
    )

    warnSpy.mockRestore()
  })

  it("强制模式下非法 orderBy 应返回 400", async () => {
    process.env.FEATURE_POSTS_PUBLIC_PARAM_ENFORCE = "true"

    const warnSpy = vi.spyOn(apiLogger, "warn")

    const request = new NextRequest("http://localhost:3000/api/posts?orderBy=views")
    const response = await GET(request)

    expect(response.status).toBe(400)
    expect(mockedPrisma.post.findMany).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      "posts_public_param_violation",
      expect.objectContaining({
        violations: expect.arrayContaining([
          expect.objectContaining({ param: "orderBy", value: "views" }),
        ]),
      })
    )

    warnSpy.mockRestore()
  })

  it("合法的 orderBy/order 应映射到 Prisma 排序", async () => {
    mockedPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post-4",
        title: "排序测试",
        excerpt: null,
        slug: "sort-test",
        publishedAt: new Date("2025-09-23T00:00:00Z"),
        author: {
          id: "author-4",
          name: "Dana",
          avatarUrl: null,
        },
        series: null,
        tags: [],
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      },
    ] as any)
    mockedPrisma.post.count.mockResolvedValueOnce(1 as any)

    const request = new NextRequest("http://localhost:3000/api/posts?orderBy=viewCount&order=asc")
    const response = await GET(request)

    expect(response.status).toBe(200)

    const callArgs = mockedPrisma.post.findMany.mock.calls[0][0]
    expect(callArgs.orderBy).toEqual([
      { viewCount: "asc" },
      { publishedAt: "desc" },
      { id: "desc" },
    ])
  })

  it("?tag=<slug> 应按 slug 过滤文章", async () => {
    mockedPrisma.post.findMany.mockResolvedValueOnce([] as any)
    mockedPrisma.post.count.mockResolvedValueOnce(0 as any)

    const request = new NextRequest("http://localhost:3000/api/posts?tag=frontend-tools")
    await GET(request)

    const callArgs = mockedPrisma.post.findMany.mock.calls.at(-1)?.[0]
    expect(callArgs?.where?.tags?.some?.tag?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: expect.objectContaining({
            equals: "frontend-tools",
            mode: "insensitive",
          }),
        }),
      ])
    )
  })

  it("?tag=<name> 应按名称兼容过滤", async () => {
    mockedPrisma.post.findMany.mockResolvedValueOnce([] as any)
    mockedPrisma.post.count.mockResolvedValueOnce(0 as any)

    const request = new NextRequest("http://localhost:3000/api/posts?tag=%E5%89%8D%E7%AB%AF")
    await GET(request)

    const callArgs = mockedPrisma.post.findMany.mock.calls.at(-1)?.[0]
    expect(callArgs?.where?.tags?.some?.tag?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.objectContaining({
            equals: "前端",
            mode: "insensitive",
          }),
        }),
      ])
    )
  })
})
