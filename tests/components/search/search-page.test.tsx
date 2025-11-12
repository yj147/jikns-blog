import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { endOfDay, startOfDay } from "date-fns"
import SearchPage from "@/app/search/page"
import { MAX_SEARCH_TAG_IDS } from "@/lib/search/search-params"
import { getCurrentUser } from "@/lib/auth"

const searchResultsMock = vi.fn()
const searchFiltersMock = vi.fn()

vi.mock("@/components/search/search-bar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}))

vi.mock("@/components/search/search-filters", () => ({
  SearchFilters: (props: any) => {
    searchFiltersMock(props)
    return <div data-testid="filters" />
  },
}))

vi.mock("@/components/search/search-results", () => ({
  SearchResults: (props: any) => {
    searchResultsMock(props)
    return <div data-testid="results" />
  },
}))

vi.mock("@/components/search/search-results-skeleton", () => ({
  SearchResultsSkeleton: () => <div data-testid="results-skeleton" />,
}))

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}))

describe("SearchPage 参数解析", () => {
  beforeEach(() => {
    searchResultsMock.mockReset()
    searchFiltersMock.mockReset()
    vi.mocked(getCurrentUser).mockResolvedValue(null)
  })

  async function renderPage(params: Record<string, string | string[] | undefined>) {
    const element = await SearchPage({
      searchParams: Promise.resolve(params),
    })
    render(element)
  }

  it("默认启用 onlyPublished", async () => {
    await renderPage({ q: "test" })
    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({ onlyPublished: true }),
      })
    )
  })

  it("管理员才可关闭 onlyPublished", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      status: "ACTIVE",
    } as any)

    await renderPage({ q: "test", onlyPublished: "false" })

    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({ onlyPublished: false }),
      })
    )
    expect(searchFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({ allowDraftToggle: true })
    )
  })

  it("普通用户强制 onlyPublished=true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      role: "USER",
      status: "ACTIVE",
    } as any)

    await renderPage({ q: "test", onlyPublished: "false" })

    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({ onlyPublished: true }),
      })
    )
    expect(searchFiltersMock).toHaveBeenCalledWith(
      expect.objectContaining({ allowDraftToggle: false })
    )
  })

  it("非法页码回退到 1", async () => {
    await renderPage({ q: "test", page: "abc" })
    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: expect.objectContaining({ page: 1 }) })
    )
  })

  it("过滤非法日期参数", async () => {
    const nowIso = new Date().toISOString()
    await renderPage({ q: "test", publishedFrom: "not-a-date", publishedTo: nowIso })

    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({
          publishedFrom: undefined,
          publishedTo: new Date(nowIso),
        }),
      })
    )
  })

  it("自动矫正倒置的日期范围", async () => {
    const early = "2024-01-01"
    const late = "2024-12-31"
    await renderPage({ q: "test", publishedFrom: late, publishedTo: early })

    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({
          publishedFrom: startOfDay(new Date(early)),
          publishedTo: endOfDay(new Date(late)),
        }),
      })
    )
  })

  it("去重并清洗 tagIds", async () => {
    await renderPage({ q: "test", tagIds: ["tag-1,tag-2", "tag-2"] })
    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({ tagIds: ["tag-1", "tag-2"] }),
      })
    )
  })

  it("限制 tagIds 数量", async () => {
    const manyTags = Array.from({ length: MAX_SEARCH_TAG_IDS + 5 }, (_, index) => `tag-${index}`)
    await renderPage({ q: "test", tagIds: [manyTags.join(",")] })

    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({ tagIds: manyTags.slice(0, MAX_SEARCH_TAG_IDS) }),
      })
    )
  })

  it("保留 ISO 日期时间精度", async () => {
    const iso = "2025-10-17T06:59:59.999Z"
    await renderPage({ q: "test", publishedTo: iso })

    expect(searchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({ publishedTo: new Date(iso) }),
      })
    )
  })

  it("无查询时展示空状态", async () => {
    const element = await SearchPage({ searchParams: Promise.resolve({}) })
    render(element)

    expect(screen.getByText("输入关键词开始搜索")).toBeInTheDocument()
    expect(searchResultsMock).not.toHaveBeenCalled()
  })
})
