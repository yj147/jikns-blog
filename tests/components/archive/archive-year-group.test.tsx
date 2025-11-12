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

vi.mock("@/components/archive/archive-month-group", () => ({
  __esModule: true,
  default: ({ year, monthData }: any) => <div data-testid={`month-${year}-${monthData.month}`} />,
}))

import ArchiveYearGroup from "@/components/archive/archive-year-group"

const buildYearData = () => ({
  year: 2024,
  totalCount: 3,
  months: [
    {
      month: 2,
      monthName: "二月",
      count: 2,
      posts: [],
    },
  ],
})

describe("ArchiveYearGroup", () => {
  it("使用按钮提供可访问的折叠控制", async () => {
    const onToggle = vi.fn()
    render(<ArchiveYearGroup yearData={buildYearData()} isExpanded={false} onToggle={onToggle} />)

    const button = screen.getByRole("button", { name: /2024 年/ })
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(button).toHaveAttribute("aria-controls", "archive-year-2024-panel")

    const user = userEvent.setup()
    await user.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("展开时渲染具有 aria-label 的内容区域", () => {
    render(<ArchiveYearGroup yearData={buildYearData()} isExpanded={true} onToggle={vi.fn()} />)

    const region = screen.getByRole("region", { name: "2024 年份文章" })
    expect(region).toBeInTheDocument()
    expect(screen.getByTestId("month-2024-2")).toBeInTheDocument()
  })
})
