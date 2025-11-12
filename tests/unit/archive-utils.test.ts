import { describe, expect, it } from "vitest"

import { type ArchivePost } from "@/lib/actions/archive"
import {
  archiveMonthNames,
  buildArchiveTimeline,
  type ArchiveAggregateRow,
} from "@/lib/utils/archive"

describe("buildArchiveTimeline", () => {
  it("按年份和月份正确分组文章并保持降序顺序", () => {
    const aggregates: ArchiveAggregateRow[] = [
      { year: 2025, month: 3, count: 2 },
      { year: 2025, month: 2, count: 1 },
      { year: 2024, month: 12, count: 1 },
    ]

    const posts: ArchivePost[] = [
      createPost("a", "2025-03-10T08:00:00.000Z"),
      createPost("b", "2025-03-02T08:00:00.000Z"),
      createPost("c", "2025-02-15T08:00:00.000Z"),
      createPost("d", "2024-12-31T08:00:00.000Z"),
    ]

    const result = buildArchiveTimeline(aggregates, posts, archiveMonthNames)

    expect(result).toHaveLength(2)
    expect(result[0].year).toBe(2025)
    expect(result[0].months.map((m) => m.month)).toEqual([3, 2])
    expect(result[0].totalCount).toBe(3)
    expect(result[0].months[0].posts.map((post) => post.id)).toEqual(["a", "b"])
    expect(result[1].year).toBe(2024)
    expect(result[1].months[0].monthName).toBe("十二月")
    expect(result[1].totalCount).toBe(1)
  })

  it("当没有聚合数据时返回空数组", () => {
    const result = buildArchiveTimeline([], [], archiveMonthNames)
    expect(result).toEqual([])
  })
})

function createPost(id: string, publishedAt: string): ArchivePost {
  return {
    id,
    title: `post-${id}`,
    slug: `post-${id}`,
    summary: null,
    publishedAt: new Date(publishedAt),
    tags: [],
  }
}
