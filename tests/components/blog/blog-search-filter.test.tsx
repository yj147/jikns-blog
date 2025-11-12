/**
 * BlogSearchFilter 组件单元测试
 * 验证 TagFilter 集成逻辑
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BlogSearchFilter } from "@/components/blog/blog-search-filter"
import { useRouter, useSearchParams } from "next/navigation"

vi.mock("@/hooks/use-debounce", () => ({
  useDebounce: <T,>(value: T) => value,
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

const mockTagFilter = vi.fn(({ onTagChange }: any) => (
  <button data-testid="tag-filter-mock" onClick={() => onTagChange?.("javascript")}>
    Mock Tag Filter
  </button>
))

vi.mock("@/components/blog/tag-filter", () => ({
  TagFilter: (props: any) => mockTagFilter(props),
}))

describe("BlogSearchFilter", () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockClear()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as any)
  })

  it("应该把 popularTags 透传给 TagFilter", () => {
    const popularTags = [
      { id: "1", name: "JS", slug: "js", postsCount: 10, color: "#fff" },
      { id: "2", name: "AI", slug: "ai", postsCount: 5, color: "#000" },
    ]

    render(<BlogSearchFilter popularTags={popularTags} />)

    expect(mockTagFilter).toHaveBeenCalled()
    const props = mockTagFilter.mock.calls[0][0]
    expect(props.initialTags).toEqual(popularTags)
    expect(props.limit).toBe(popularTags.length)
  })

  it("应该在 TagFilter 触发 onTagChange 时更新路由", async () => {
    const user = userEvent.setup()
    render(<BlogSearchFilter popularTags={[]} />)
    mockPush.mockClear()

    await user.click(screen.getByTestId("tag-filter-mock"))

    expect(mockPush).toHaveBeenCalledWith("/blog?tag=javascript&sort=publishedAt&order=desc&page=1")
  })

  it("应该将 URL 中的标签状态同步给 TagFilter", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tag=react") as any)

    render(<BlogSearchFilter popularTags={[]} />)

    const props = mockTagFilter.mock.calls.at(-1)?.[0]
    expect(props?.selectedTag).toBe("react")
  })
})
