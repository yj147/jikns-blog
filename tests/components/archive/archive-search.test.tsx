import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createContext, useContext } from "react"

vi.mock("@/components/ui/select", () => {
  const SelectContext = createContext<(value: string) => void>(() => {})
  const Select = ({ children, onValueChange }: any) => (
    <SelectContext.Provider value={onValueChange ?? (() => {})}>
      <div data-testid="select-root">{children}</div>
    </SelectContext.Provider>
  )
  const SelectTrigger = ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  )
  const SelectValue = ({ children }: any) => <span>{children}</span>
  const SelectContent = ({ children }: any) => <div>{children}</div>
  const SelectItem = ({ children, value, onSelect, ...props }: any) => {
    const notify = useContext(SelectContext)
    return (
      <button
        type="button"
        data-value={value}
        onClick={() => {
          onSelect?.(value)
          notify?.(value)
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
  ScrollBar: () => null,
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import ArchiveSearch from "@/components/archive/archive-search"
import { ARCHIVE_SEARCH_MAX_QUERY_LENGTH } from "@/lib/constants/archive-search"

const YEARS = [
  { year: 2025, count: 12 },
  { year: 2024, count: 18 },
]

describe("ArchiveSearch", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("输入过短时显示错误提示并不触发请求", async () => {
    render(<ArchiveSearch years={YEARS} />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText("搜索文章"), "a")
    await user.click(screen.getByRole("button", { name: "执行归档搜索" }))

    await waitFor(() => {
      expect(screen.getByText(/至少输入/)).toBeInTheDocument()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("输入过长时直接提示错误", async () => {
    render(<ArchiveSearch years={YEARS} />)

    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText("搜索文章"),
      "a".repeat(ARCHIVE_SEARCH_MAX_QUERY_LENGTH + 1)
    )
    await user.click(screen.getByRole("button", { name: "执行归档搜索" }))

    await waitFor(() => {
      expect(screen.getByText(/最多输入/)).toBeInTheDocument()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("成功搜索后展示结果并记录历史", async () => {
    ;(global.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "post-1",
            title: "归档测试",
            slug: "archive-test",
            summary: "这是一个摘要",
            publishedAt: "2025-02-10T00:00:00.000Z",
            tags: [],
          },
        ],
      }),
    })

    render(<ArchiveSearch years={YEARS} />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText("搜索文章"), "Playwright")
    await user.click(screen.getByRole("button", { name: "执行归档搜索" }))

    await expect(screen.findByRole("link", { name: "归档测试" })).resolves.toBeInTheDocument()

    expect(screen.getByText("共找到 1 篇文章")).toBeInTheDocument()
    await waitFor(() => {
      expect(localStorage.getItem("archive-search-history")).toContain("Playwright")
    })
  })

  it("点击历史记录会再次触发搜索", async () => {
    localStorage.setItem("archive-search-history", JSON.stringify(["Next.js"]))
    ;(global.fetch as unknown as vi.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })

    render(<ArchiveSearch years={YEARS} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Next.js" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("q=Next.js"),
        expect.any(Object)
      )
    })
  })

  it("可以清除搜索历史", async () => {
    localStorage.setItem("archive-search-history", JSON.stringify(["Playwright"]))
    ;(global.fetch as unknown as vi.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })

    render(<ArchiveSearch years={YEARS} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "清除搜索历史" }))

    await waitFor(() => {
      expect(localStorage.getItem("archive-search-history")).toBeNull()
    })
  })

  it("切换年份会在查询触发后自动刷新结果", async () => {
    const fetchMock = global.fetch as unknown as vi.Mock
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })

    render(<ArchiveSearch years={YEARS} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("搜索文章"), "Playwright")
    await user.click(screen.getByRole("button", { name: "执行归档搜索" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByLabelText("限定年份"))
    await user.click(screen.getByText("2024 年 (18)"))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("year=2024"),
        expect.any(Object)
      )
    })
  })

  it("当请求失败时显示错误提示", async () => {
    ;(global.fetch as unknown as vi.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "SEARCH_FAILED" }),
    })

    render(<ArchiveSearch years={YEARS} />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText("搜索文章"), "Broken")
    await user.click(screen.getByRole("button", { name: "执行归档搜索" }))

    await waitFor(() => {
      expect(screen.getByText("搜索失败，请稍后重试")).toBeInTheDocument()
    })
  })
})
