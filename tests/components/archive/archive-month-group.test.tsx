import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

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

import ArchiveMonthGroup from "@/components/archive/archive-month-group"
import type { ArchiveMonth, ArchivePost } from "@/lib/actions/archive"

const createPost = (overrides: Partial<ArchivePost> = {}): ArchivePost => ({
  id: "post-1",
  title: "测试文章",
  slug: "test-post",
  summary: "摘要内容",
  publishedAt: new Date("2025-02-10T00:00:00.000Z"),
  tags: [],
  ...overrides,
})

const buildMonthData = (): ArchiveMonth => ({
  month: 2,
  monthName: "二月",
  count: 2,
  posts: [createPost(), createPost({ id: "post-2" })],
})

describe("ArchiveMonthGroup", () => {
  it("折叠按钮具有正确的 aria 属性并可被键盘触发", async () => {
    render(<ArchiveMonthGroup year={2025} monthData={buildMonthData()} />)

    const button = screen.getByRole("button", { name: /二月/ })
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(button).toHaveAttribute("aria-controls", "archive-month-2025-2-panel")

    const user = userEvent.setup()
    await user.click(button)

    expect(button).toHaveAttribute("aria-expanded", "true")
    const region = screen.getByRole("region", { name: "2025 年 二月 文章列表" })
    expect(region).toBeInTheDocument()
  })

  it("链接具备描述性的 aria-label", () => {
    render(<ArchiveMonthGroup year={2025} monthData={buildMonthData()} />)

    const link = screen.getByRole("link", { name: "2025 年 二月的所有文章" })
    expect(link).toHaveAttribute("href", "/archive/2025/02")
  })
})
