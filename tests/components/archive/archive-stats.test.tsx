import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div {...props} data-motion="div">
        {children}
      </div>
    ),
  },
}))

import ArchiveStats from "@/components/archive/archive-stats"
import type { ArchiveStats as ArchiveStatsType } from "@/lib/actions/archive"

const buildStats = (overrides: Partial<ArchiveStatsType> = {}): ArchiveStatsType => ({
  totalPosts: 42,
  totalYears: 3,
  oldestPost: new Date("2022-01-15T00:00:00.000Z"),
  newestPost: new Date("2024-06-01T00:00:00.000Z"),
  postsPerYear: [
    { year: 2024, count: 20 },
    { year: 2023, count: 15 },
    { year: 2022, count: 7 },
  ],
  ...overrides,
})

describe("ArchiveStats", () => {
  it("计算平均值并显示时间范围", () => {
    render(<ArchiveStats stats={buildStats()} />)

    expect(screen.getByText("总文章数").nextElementSibling).toHaveTextContent("42")
    expect(screen.getByText("时间跨度").nextElementSibling).toHaveTextContent("3 年")
    expect(screen.getByText("年均文章").nextElementSibling).toHaveTextContent("14")
    expect(screen.getByText("发布时间").nextElementSibling).toHaveTextContent(
      "2022年1月 - 2024年6月"
    )
  })

  it("在缺少日期时回退到暂无数据", () => {
    render(
      <ArchiveStats
        stats={buildStats({ oldestPost: null, newestPost: null, totalYears: 0, totalPosts: 0 })}
      />
    )

    expect(screen.getByText("年均文章").nextElementSibling).toHaveTextContent("0")
    expect(screen.getByText("发布时间").nextElementSibling).toHaveTextContent("暂无数据")
  })
})
