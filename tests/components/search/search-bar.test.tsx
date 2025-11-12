/**
 * 搜索框组件测试 - Phase 11 / M3 / T3.6
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { SearchBar } from "@/components/search/search-bar"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

if (!HTMLFormElement.prototype.requestSubmit) {
  HTMLFormElement.prototype.requestSubmit = function requestSubmitPolyfill(this: HTMLFormElement) {
    this.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  }
}

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}))

vi.mock("@/components/search/search-suggestions", () => ({
  SearchSuggestions: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe("SearchBar", () => {
  const mockGet = vi.fn()
  let currentParams: URLSearchParams

  beforeEach(() => {
    vi.clearAllMocks()
    currentParams = new URLSearchParams()
    mockGet.mockImplementation((key: string) => currentParams.get(key))
    ;(useSearchParams as any).mockImplementation(() => ({
      get: (key: string) => mockGet(key),
      forEach: (callback: (value: string, key: string) => void) => {
        currentParams.forEach((value, key) => {
          callback(value, key)
        })
      },
    }))
  })

  it("应该渲染搜索框", () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索文章、动态、用户/)
    expect(input).toBeInTheDocument()
  })

  it("应该显示快捷键提示", () => {
    render(<SearchBar showShortcut={true} />)
    expect(screen.getByText("K")).toBeInTheDocument()
  })

  it("应该在输入时更新查询", () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索文章、动态、用户/)

    fireEvent.change(input, { target: { value: "test query" } })
    expect(input).toHaveValue("test query")
  })

  it("应该在按回车时触发搜索", async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索文章、动态、用户/)
    const form = screen.getByTestId("search-form")

    fireEvent.change(input, { target: { value: " test query " } })
    const dispatched = fireEvent.submit(form)
    expect(dispatched).toBe(true)

    await waitFor(() => {
      const formData = new FormData(form)
      expect(formData.get("q")).toBe("test query")
    })
  })

  it("应该在点击搜索按钮时触发搜索", async () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索文章、动态、用户/)
    const form = screen.getByTestId("search-form")

    fireEvent.change(input, { target: { value: "test query" } })

    const searchButton = screen.getByText("搜索")
    fireEvent.click(searchButton)

    await waitFor(() => {
      const formData = new FormData(form)
      expect(formData.get("q")).toBe("test query")
    })
  })

  it("应该从URL参数初始化查询", () => {
    currentParams = new URLSearchParams("q=initial%20query")

    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索文章、动态、用户/)

    expect(input).toHaveValue("initial query")
  })

  it("应该忽略空查询的搜索", async () => {
    render(<SearchBar />)
    const form = screen.getByTestId("search-form")

    const dispatched = fireEvent.submit(form)

    expect(dispatched).toBe(false)
    const formData = new FormData(form)
    expect(formData.get("q")).toBe("")
  })

  it("应保留现有过滤条件并重置分页", async () => {
    currentParams = new URLSearchParams("q=old&page=3&type=users&tagIds=1,2")

    render(<SearchBar />)
    const input = screen.getByPlaceholderText(/搜索文章、动态、用户/)

    fireEvent.change(input, { target: { value: "new query" } })
    const form = screen.getByTestId("search-form")
    const dispatched = fireEvent.submit(form)
    expect(dispatched).toBe(true)

    await waitFor(() => {
      const formData = new FormData(form)
      expect(formData.get("q")).toBe("new query")
      expect(formData.get("type")).toBe("users")
      expect(formData.get("tagIds")).toBe("1,2")
      expect(formData.get("page")).toBeNull()
    })
  })
})
