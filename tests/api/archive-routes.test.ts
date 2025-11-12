import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET as getArchiveChunk } from "@/app/api/archive/chunk/route"
import { GET as getArchiveSearch } from "@/app/api/archive/search/route"
import { ARCHIVE_SEARCH_MAX_QUERY_LENGTH } from "@/lib/constants/archive-search"

const prismaMock = vi.hoisted(() => ({
  post: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}))

const cacheMocks = vi.hoisted(() => ({
  unstable_cache: (fn: any) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock("next/cache", () => cacheMocks)

beforeEach(() => {
  prismaMock.post.findMany.mockReset()
  prismaMock.$queryRaw.mockReset()
  cacheMocks.revalidateTag.mockReset()
})

describe("Archive chunk API", () => {
  it("返回压缩后的月份数据并维护 hasMore 状态", async () => {
    const publishedAt = new Date("2025-02-01T00:00:00.000Z")

    const yearRows = [
      { year: 2025, count: 10 },
      { year: 2024, count: 8 },
    ]

    prismaMock.$queryRaw
      .mockResolvedValueOnce(yearRows) // route getArchiveYears
      .mockResolvedValueOnce(yearRows) // getArchiveData -> getArchiveYears
      .mockResolvedValueOnce([
        { id: "post-0" },
        { id: "post-1" },
        { id: "post-2" },
        { id: "post-3" },
        { id: "post-4" },
      ])
      .mockResolvedValueOnce([{ year: 2025, month: 2, count: 10 }])

    prismaMock.post.findMany.mockResolvedValueOnce(
      Array.from({ length: 5 }).map((_, index) => ({
        id: `post-${index}`,
        title: `Post ${index}`,
        slug: `post-${index}`,
        excerpt: `摘要 ${index}`,
        publishedAt,
        tags: [],
      }))
    )

    const request = new NextRequest("http://localhost:3000/api/archive/chunk?offset=0&limit=1")
    const response = await getArchiveChunk(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.years).toHaveLength(1)
    expect(body.years[0].months[0].count).toBe(10)
    expect(body.years[0].months[0].posts).toHaveLength(5)
    expect(body.hasMore).toBe(true)
    expect(body.nextOffset).toBe(1)
  })

  it("offset 非法时返回 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/archive/chunk?offset=-1")
    const response = await getArchiveChunk(request)
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.message).toBe("INVALID_OFFSET")
  })

  it("limit 非法时返回 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/archive/chunk?limit=0")
    const response = await getArchiveChunk(request)
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.message).toBe("INVALID_LIMIT")
  })
})

describe("Archive search API", () => {
  it("利用全文索引返回匹配结果", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "post-1", rank: 0.9 }])
    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "归档搜索",
        slug: "archive-search",
        excerpt: "内容",
        publishedAt: new Date("2025-03-01T00:00:00.000Z"),
        tags: [],
      },
    ])

    const request = new NextRequest(
      "http://localhost:3000/api/archive/search?q=archive&utm_source=test"
    )
    const response = await getArchiveSearch(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].slug).toBe("archive-search")
  })

  it("短查询返回友好提示", async () => {
    const request = new NextRequest("http://localhost:3000/api/archive/search?q=a")
    const response = await getArchiveSearch(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe("QUERY_TOO_SHORT")
    expect(body.results).toEqual([])
  })

  it("超长查询返回 400 并跳过数据库", async () => {
    const longQuery = "a".repeat(ARCHIVE_SEARCH_MAX_QUERY_LENGTH + 1)
    const request = new NextRequest(`http://localhost:3000/api/archive/search?q=${longQuery}`)
    const response = await getArchiveSearch(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toBe("QUERY_TOO_LONG")
    expect(body.results).toEqual([])
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })

  it("年份参数无法解析时返回 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/archive/search?q=abc&year=oops")
    const response = await getArchiveSearch(request)
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.message).toBe("INVALID_YEAR")
    expect(body.results).toEqual([])
  })
})
