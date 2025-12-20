import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

const pushMock = vi.fn()
let currentParams = new URLSearchParams()
const fetchMock = vi.fn()
const mockSearchParams = {
  get: (key: string) => currentParams.get(key),
  forEach: (cb: (value: string, key: string) => void) => currentParams.forEach(cb),
  toString: () => currentParams.toString(),
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => mockSearchParams,
}))

import { SearchPageClient } from "@/app/search/search-page-client"

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SearchPageClient />
    </SWRConfig>
  )
}

function mockJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  currentParams = new URLSearchParams()
  pushMock.mockReset()
  fetchMock.mockReset()
  ;(globalThis.fetch as any) = fetchMock
})

describe("SearchPageClient", () => {
  it("显示引导提示，当没有查询词时", () => {
    renderPage()
    expect(screen.getByTestId("search-empty-hint")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("输入并提交搜索词会跳转到 /search", async () => {
    renderPage()

    const input = screen.getByPlaceholderText("搜索文章、动态、用户、标签")
    await userEvent.type(input, "hello world")
    await userEvent.click(screen.getByRole("button", { name: "搜索" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalled())
    const target = pushMock.mock.calls[0][0] as string
    expect(target).toContain("/search?")
    const params = new URLSearchParams(target.split("?")[1])
    expect(params.get("q")).toBe("hello world")
  })

  it("渲染搜索结果并允许 Tab 切换", async () => {
    currentParams = new URLSearchParams("q=next")
    const payload = {
      success: true,
      data: {
        query: "next",
        type: "all",
        page: 1,
        limit: 10,
        overallTotal: 3,
        posts: {
          items: [
            {
              id: "p1",
              slug: "hello-next",
              title: "Hello Next",
              excerpt: "Next.js 指南",
              publishedAt: "2024-01-01T00:00:00.000Z",
              createdAt: "2024-01-01T00:00:00.000Z",
              coverImage: null,
              authorId: "u1",
              authorName: "Tester",
              rank: 0.9,
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          hasMore: false,
        },
        activities: { items: [], total: 0, page: 1, limit: 10, hasMore: false },
        users: {
          items: [
            {
              id: "u1",
              name: "Alice",
              email: "alice@example.com",
              avatarUrl: null,
              bio: "hello",
              rank: 0.8,
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
          hasMore: false,
        },
        tags: { items: [], total: 0, page: 1, limit: 10, hasMore: false },
      },
    }

    fetchMock.mockResolvedValue(mockJsonResponse(payload))

    renderPage()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await screen.findByText("作者：Tester")
    expect(screen.getByText("Alice")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: /用户/ }))
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining("type=users"),
        expect.objectContaining({ scroll: false })
      )
    })
  })

  it("加载时显示骨架屏", async () => {
    currentParams = new URLSearchParams("q=loading")

    let resolveFetch: (() => void) | null = null
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = () =>
          resolve(mockJsonResponse({ success: true, data: emptyResult("loading") }))
      })
    )

    renderPage()

    expect(screen.getByText("搜索文章、动态、用户与标签")).toBeInTheDocument()
    expect(
      screen.queryByText((content) => content.includes("输入关键词开始搜索"))
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("search-results-skeleton")).toBeInTheDocument()

    resolveFetch?.()
    await screen.findByTestId("search-empty-state")
  })

  it("当结果为空时显示空状态", async () => {
    currentParams = new URLSearchParams("q=none")
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true, data: emptyResult("none") }))

    renderPage()

    await screen.findByTestId("search-empty-state")
  })

  it("当接口报错时显示错误状态", async () => {
    currentParams = new URLSearchParams("q=error")
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: "bad" } }, 500))

    renderPage()

    await screen.findByTestId("search-error")
    expect(screen.getByText("bad")).toBeInTheDocument()
  })
})

function emptyResult(query: string) {
  return {
    query,
    type: "all",
    page: 1,
    limit: 10,
    overallTotal: 0,
    posts: { items: [], total: 0, page: 1, limit: 10, hasMore: false },
    activities: { items: [], total: 0, page: 1, limit: 10, hasMore: false },
    users: { items: [], total: 0, page: 1, limit: 10, hasMore: false },
    tags: { items: [], total: 0, page: 1, limit: 10, hasMore: false },
  }
}
