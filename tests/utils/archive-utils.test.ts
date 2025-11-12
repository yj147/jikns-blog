import { describe, expect, it } from "vitest"

import {
  archiveMonthNames,
  buildArchiveTimeline,
  resolveAdjacentMonths,
  summarizeArchivePosts,
} from "@/lib/utils/archive"
import type { ArchiveAggregateRow, ArchivePost } from "@/lib/actions/archive"

function createPost(overrides: Partial<ArchivePost> = {}): ArchivePost {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "title",
    slug: overrides.slug ?? "slug",
    summary: overrides.summary ?? null,
    publishedAt: overrides.publishedAt ?? new Date("2024-05-10T08:00:00.000Z"),
    tags: overrides.tags ?? [],
  }
}

describe("archive utils", () => {
  it("buildArchiveTimeline 按年份/月份降序合并聚合数据", () => {
    const aggregates: ArchiveAggregateRow[] = [
      { year: 2024, month: 5, count: 2 },
      { year: 2023, month: 12, count: 1 },
    ]

    const posts: ArchivePost[] = [
      createPost({ id: "2024-05-a", publishedAt: new Date("2024-05-09T00:00:00Z") }),
      createPost({ id: "2024-05-b", publishedAt: new Date("2024-05-08T00:00:00Z") }),
      createPost({ id: "2023-12-a", publishedAt: new Date("2023-12-01T00:00:00Z") }),
    ]

    const timeline = buildArchiveTimeline(aggregates, posts, archiveMonthNames)

    expect(timeline.map((year) => year.year)).toEqual([2024, 2023])
    expect(timeline[0].months[0].monthName).toBe("五月")
    expect(timeline[0].months[0].posts).toHaveLength(2)
    expect(timeline[1].months[0].posts[0].id).toBe("2023-12-a")
  })

  it("summarizeArchivePosts 会忽略非法日期并统计年月", () => {
    const posts: ArchivePost[] = [
      createPost({ publishedAt: new Date("2024-01-01T00:00:00Z") }),
      createPost({ publishedAt: new Date("2024-01-05T00:00:00Z") }),
      createPost({ publishedAt: new Date("2023-02-05T00:00:00Z") }),
      createPost({ publishedAt: new Date("invalid") }),
    ]

    const result = summarizeArchivePosts(posts)

    expect(result).toEqual([
      { year: 2024, month: 1, count: 2 },
      { year: 2023, month: 2, count: 1 },
    ])
  })

  it("resolveAdjacentMonths 能正确定位前后月份", () => {
    const years = [2023, 2024]
    const monthsByYear = new Map<number, number[]>()
    monthsByYear.set(2023, [11, 12])
    monthsByYear.set(2024, [1, 2, 3])

    const { prev, next } = resolveAdjacentMonths(2024, 2, years, monthsByYear)

    expect(prev).toEqual({ year: 2024, month: 1 })
    expect(next).toEqual({ year: 2024, month: 3 })

    const boundary = resolveAdjacentMonths(2023, 11, years, monthsByYear)
    expect(boundary.prev).toBeNull()
    expect(boundary.next).toEqual({ year: 2023, month: 12 })
  })
})
