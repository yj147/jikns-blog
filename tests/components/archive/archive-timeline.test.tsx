import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div {...props} data-motion="div">
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock("@/hooks/use-intersection-observer", () => ({
  useIntersectionObserver: () => [{ current: null }, false] as const,
}))

import ArchiveTimeline from "@/components/archive/archive-timeline"
import type { ArchiveMonth, ArchiveYear } from "@/lib/actions/archive"

const createMonth = (overrides: Partial<ArchiveMonth> = {}): ArchiveMonth => ({
  month: 1,
  monthName: "一月",
  count: 1,
  posts: [],
  ...overrides,
})

const createYear = (year: number): ArchiveYear => ({
  year,
  totalCount: 1,
  months: [createMonth()],
})

describe("ArchiveTimeline", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it("渲染初始年份列表", () => {
    render(
      <ArchiveTimeline
        data={[createYear(2025), createYear(2024)]}
        totalYearCount={4}
        initialChunkSize={2}
      />
    )

    expect(screen.getByRole("heading", { name: "2025 年" })).toBeInTheDocument()
  })

  it("点击加载更多后追加新年份", async () => {
    const user = userEvent.setup()

    ;(global.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        years: [createYear(2023)],
        hasMore: false,
        nextOffset: 3,
      }),
    })

    render(
      <ArchiveTimeline
        data={[createYear(2025), createYear(2024)]}
        totalYearCount={3}
        initialChunkSize={1}
      />
    )

    await user.click(screen.getByRole("button", { name: "加载更多年份" }))

    expect(global.fetch).toHaveBeenCalledWith("/api/archive/chunk?offset=2&limit=1", {
      cache: "no-store",
    })
    expect(await screen.findByRole("heading", { name: "2023 年" })).toBeInTheDocument()
  })
})
