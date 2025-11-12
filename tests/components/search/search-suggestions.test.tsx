import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="popover">{children}</div> : null,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}))

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("@/lib/actions/search", () => ({
  getSearchSuggestions: vi.fn(),
}))

import { SearchSuggestions } from "@/components/search/search-suggestions"
import { getSearchSuggestions } from "@/lib/actions/search"

const mockedGetSearchSuggestions = vi.mocked(getSearchSuggestions)

describe("SearchSuggestions", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedGetSearchSuggestions.mockReset()
    pushMock.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("保持弹层可见并展示加载状态", async () => {
    mockedGetSearchSuggestions.mockImplementation(
      () =>
        new Promise(() => {
          // 保持挂起以测试加载态
        })
    )

    render(
      <SearchSuggestions query="react" isOpen onClose={vi.fn()} onSelect={vi.fn()}>
        <input />
      </SearchSuggestions>
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByTestId("popover-content")).toBeInTheDocument()
    expect(screen.getByText("加载中...")).toBeInTheDocument()
  })

  it("在无建议时展示空状态", async () => {
    mockedGetSearchSuggestions.mockResolvedValue({
      success: true,
      data: { suggestions: [] },
    })

    render(
      <SearchSuggestions query="next" isOpen onClose={vi.fn()} onSelect={vi.fn()}>
        <input />
      </SearchSuggestions>
    )

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(screen.getByTestId("popover-content")).toBeInTheDocument()
    expect(screen.getByText("没有找到相关建议")).toBeInTheDocument()
  })

  it("支持外部传入已防抖关键字以立即触发查询", async () => {
    mockedGetSearchSuggestions.mockResolvedValue({
      success: true,
      data: { suggestions: [] },
    })

    render(
      <SearchSuggestions
        query="react"
        debouncedQuery="react"
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
      >
        <input />
      </SearchSuggestions>
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockedGetSearchSuggestions).toHaveBeenCalledWith({
      query: "react",
      limit: 5,
    })
  })
})
