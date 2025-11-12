import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  post: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  $queryRaw: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}))

const cacheMocks = vi.hoisted(() => ({
  unstable_cache: vi.fn((fn: any) => fn),
  revalidateTag: vi.fn(),
}))

vi.mock("next/cache", () => cacheMocks)

import {
  getArchiveData,
  getArchiveMonths,
  getArchiveStats,
  getArchiveYears,
  searchArchivePosts,
} from "@/lib/actions/archive"
import { ARCHIVE_CACHE_TAGS } from "@/lib/cache/archive-tags"
import { ARCHIVE_SEARCH_MAX_QUERY_LENGTH } from "@/lib/constants/archive-search"

describe("Archive server actions 聚合逻辑", () => {
  beforeEach(() => {
    prismaMock.post.findMany.mockReset()
    prismaMock.post.count.mockReset()
    prismaMock.post.findFirst.mockReset()
    prismaMock.$queryRaw.mockReset()
    cacheMocks.unstable_cache.mockReset()
    cacheMocks.unstable_cache.mockImplementation((fn: any) => fn)
    cacheMocks.revalidateTag.mockReset()
  })

  it("getArchiveData 优先使用数据库聚合结果", async () => {
    const publishedAt = new Date("2025-02-10T00:00:00.000Z")

    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "post-1" }])
      .mockResolvedValueOnce([{ year: 2025, month: 2, count: 1 }])

    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "测试文章",
        slug: "test-post",
        excerpt: "摘要",
        publishedAt,
        tags: [],
      },
    ])

    const timeline = await getArchiveData({ year: 2025 })

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
    expect(timeline).toEqual([
      {
        year: 2025,
        totalCount: 1,
        months: [
          {
            month: 2,
            monthName: "二月",
            count: 1,
            posts: [
              {
                id: "post-1",
                title: "测试文章",
                slug: "test-post",
                summary: "摘要",
                publishedAt,
                tags: [],
              },
            ],
          },
        ],
      },
    ])
  })

  it("getArchiveData 在聚合结果为空时使用内存聚合兜底", async () => {
    const publishedAt = new Date("2024-12-01T00:00:00.000Z")

    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "post-2" }]).mockResolvedValueOnce([])

    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-2",
        title: "另一篇文章",
        slug: "another-post",
        excerpt: null,
        publishedAt,
        tags: [],
      },
    ])

    const timeline = await getArchiveData({ year: 2024 })

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
    // 验证兜底机制：即使数据库聚合为空，也应该通过内存聚合返回数据
    expect(timeline).toEqual([
      {
        year: 2024,
        totalCount: 1,
        months: [
          {
            month: 12,
            monthName: "十二月",
            count: 1,
            posts: [
              {
                id: "post-2",
                title: "另一篇文章",
                slug: "another-post",
                summary: null,
                publishedAt,
                tags: [],
              },
            ],
          },
        ],
      },
    ])
  })

  it("getArchiveYears 使用数据库聚合返回按年份计数", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { year: 2025, count: 2 },
      { year: 2024, count: 1 },
    ])

    const years = await getArchiveYears()

    expect(prismaMock.$queryRaw).not.toHaveBeenCalledWith(
      expect.objectContaining([{ year: expect.any(Number), month: expect.any(Number) }])
    )
    expect(years).toEqual([
      { year: 2025, count: 2 },
      { year: 2024, count: 1 },
    ])
  })

  it("getArchiveMonths 返回包含月份名称的聚合结果", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { month: 3, count: 5 },
      { month: 2, count: 2 },
    ])

    const months = await getArchiveMonths(2025)

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(months).toEqual([
      { month: 3, monthName: "三月", count: 5 },
      { month: 2, monthName: "二月", count: 2 },
    ])
  })

  it("getArchiveData 根据 perMonthPostLimit 限制月份文章数量", async () => {
    const publishedAt = new Date("2025-02-10T08:00:00.000Z")

    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "post-1" }])
      .mockResolvedValueOnce([{ year: 2025, month: 2, count: 3 }])

    prismaMock.post.findMany.mockResolvedValueOnce([
      { id: "post-1", title: "A", slug: "a", excerpt: "a", publishedAt, tags: [] },
    ])

    const timeline = await getArchiveData({ year: 2025, perMonthPostLimit: 1 })

    expect(timeline[0].months[0].count).toBe(3)
    expect(timeline[0].months[0].posts).toHaveLength(1)
    expect(timeline[0].months[0].posts[0].id).toBe("post-1")
  })

  it("getArchiveData recent 查询会附带 years 标签并按窗口切分", async () => {
    const publishedMay = new Date("2024-05-10T00:00:00.000Z")
    const publishedDec = new Date("2023-12-12T00:00:00.000Z")
    const cacheCalls: Array<{ key: unknown; options?: Record<string, unknown> }> = []

    cacheMocks.unstable_cache.mockImplementation((fn: any, key?: unknown, options?: any) => {
      cacheCalls.push({ key, options })
      return fn
    })

    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        { year: 2025, count: 10 },
        { year: 2024, count: 6 },
        { year: 2023, count: 3 },
      ])
      .mockResolvedValueOnce([
        { id: "post-alpha" },
        { id: "post-beta" },
      ])
      .mockResolvedValueOnce([
        { year: 2024, month: 5, count: 1 },
        { year: 2023, month: 12, count: 1 },
      ])

    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-alpha",
        title: "Alpha",
        slug: "alpha",
        excerpt: "A",
        publishedAt: publishedMay,
        tags: [],
      },
      {
        id: "post-beta",
        title: "Beta",
        slug: "beta",
        excerpt: "B",
        publishedAt: publishedDec,
        tags: [],
      },
    ])

    const timeline = await getArchiveData({ limitYears: 2, offsetYears: 1 })

    expect(timeline.map(({ year }) => year)).toEqual([2024, 2023])

    const dataCacheCall = cacheCalls.find(
      (entry) => Array.isArray(entry.key) && entry.key[0] === "archive:data"
    )
    expect(dataCacheCall?.options?.tags).toEqual(
      expect.arrayContaining([ARCHIVE_CACHE_TAGS.years])
    )
  })

  it("getArchiveData 在 perMonthPostLimit 为 null 时直接走 findMany 分页", async () => {
    const publishedAt = new Date("2025-05-10T00:00:00.000Z")

    prismaMock.$queryRaw.mockResolvedValueOnce([{ year: 2025, month: 5, count: 1 }])

    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "Latest",
        slug: "latest",
        excerpt: "L",
        publishedAt,
        tags: [],
      },
    ])

    const timeline = await getArchiveData({
      year: 2025,
      perMonthPostLimit: null,
      limit: 2,
      offset: 1,
    })

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 2,
        orderBy: { publishedAt: "desc" },
      })
    )
    expect(timeline[0].months[0].posts.map((post) => post.id)).toEqual(["post-1"])
  })

  it("getArchiveData 在月份查询时不会应用 perMonth 限制", async () => {
    const publishedAt = new Date("2024-05-10T00:00:00.000Z")

    prismaMock.$queryRaw.mockResolvedValueOnce([{ year: 2024, month: 5, count: 1 }])
    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-monthly",
        title: "Monthly",
        slug: "monthly",
        excerpt: "M",
        publishedAt,
        tags: [],
      },
    ])

    const timeline = await getArchiveData({ year: 2024, month: 5 })

    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publishedAt: expect.objectContaining({
            gte: new Date(2024, 4, 1),
            lte: new Date(2024, 5, 0, 23, 59, 59, 999),
          }),
        }),
        select: expect.any(Object),
      })
    )
    expect(timeline[0].months[0].posts[0].id).toBe("post-monthly")
  })

  it("getArchiveData 在 recent 查询窗口无年份时返回空数组", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ year: 2024, count: 1 }])

    const timeline = await getArchiveData({ limitYears: 1, offsetYears: 5 })

    expect(timeline).toEqual([])
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })
})

describe("searchArchivePosts", () => {
  beforeEach(() => {
    prismaMock.post.findMany.mockReset()
    prismaMock.$queryRaw.mockReset()
  })

  it("使用 search_vector 返回匹配结果并保持排名顺序", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: "post-2", rank: 0.9 },
      { id: "post-1", rank: 0.6 },
    ])

    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "次要匹配",
        slug: "secondary",
        excerpt: "excerpt",
        publishedAt: new Date("2025-01-01T00:00:00.000Z"),
        tags: [],
      },
      {
        id: "post-2",
        title: "最高匹配",
        slug: "top",
        excerpt: "summary",
        publishedAt: new Date("2025-02-10T00:00:00.000Z"),
        tags: [],
      },
    ])

    const results = await searchArchivePosts("Next.js search")

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["post-2", "post-1"] } },
      })
    )
    expect(results.map((item) => item.id)).toEqual(["post-2", "post-1"])
  })

  it("短查询直接返回空数组", async () => {
    const results = await searchArchivePosts("a")
    expect(results).toEqual([])
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })

  it("超长查询直接返回空数组", async () => {
    const longQuery = "a".repeat(ARCHIVE_SEARCH_MAX_QUERY_LENGTH + 1)
    const results = await searchArchivePosts(longQuery)

    expect(results).toEqual([])
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })
})

describe("getArchiveStats", () => {
  beforeEach(() => {
    prismaMock.post.findMany.mockReset()
    prismaMock.post.count.mockReset()
    prismaMock.post.findFirst.mockReset()
    prismaMock.$queryRaw.mockReset()
    cacheMocks.unstable_cache.mockReset()
    cacheMocks.unstable_cache.mockImplementation((fn: any) => fn)
  })

  it("返回文章总览并复用年份聚合", async () => {
    prismaMock.post.count.mockResolvedValueOnce(3)
    prismaMock.post.findFirst
      .mockResolvedValueOnce({ publishedAt: new Date("2023-01-01T00:00:00.000Z") })
      .mockResolvedValueOnce({ publishedAt: new Date("2024-02-10T00:00:00.000Z") })

    prismaMock.$queryRaw.mockResolvedValueOnce([
      { year: 2024, count: 2 },
      { year: 2023, count: 1 },
    ])

    const stats = await getArchiveStats()

    expect(prismaMock.post.count).toHaveBeenCalledTimes(1)
    expect(prismaMock.post.findFirst).toHaveBeenCalledTimes(2)
    expect(stats.totalPosts).toBe(3)
    expect(stats.totalYears).toBe(2)
    expect(stats.oldestPost?.toISOString()).toBe("2023-01-01T00:00:00.000Z")
    expect(stats.newestPost?.toISOString()).toBe("2024-02-10T00:00:00.000Z")
    expect(stats.postsPerYear).toEqual([
      { year: 2024, count: 2 },
      { year: 2023, count: 1 },
    ])
  })
})
