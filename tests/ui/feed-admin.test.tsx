import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

import { fetchJson } from "@/lib/api/fetch-json"

import FeedAdminClient from "@/components/admin/feed-admin-client"
import type { FeedItem } from "@/types/feed"
import { useFeedFilters } from "@/hooks/useFeedFilters"

const authState = {
  user: {
    id: "admin-user",
    email: "admin@example.com",
    name: "Admin",
    role: "ADMIN",
    status: "ACTIVE",
  },
  isAdmin: true,
  loading: false,
  isLoading: false,
  session: null,
  supabase: null,
  signOut: vi.fn(),
}

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => authState,
}))

const fetchMock = vi.fn()

beforeEach(() => {
  authState.user.role = "ADMIN"
  authState.isAdmin = true
  fetchMock.mockReset()
  ;(globalThis.fetch as any) = fetchMock
})

const baseFeed: FeedItem = {
  id: "feed-1",
  authorId: "author-1",
  content: "第一条动态",
  imageUrls: [],
  isPinned: false,
  deletedAt: null,
  likesCount: 3,
  commentsCount: 1,
  viewsCount: 10,
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-01-02T00:00:00Z").toISOString(),
  author: {
    id: "author-1",
    name: "编辑",
    email: "editor@example.com",
    role: "ADMIN",
    status: "ACTIVE",
  },
}

function createFeed(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    ...baseFeed,
    id,
    authorId: `author-${id}`,
    content: `动态 ${id}`,
    ...overrides,
  }
}

function createListResponse(feeds: FeedItem[]) {
  return {
    success: true,
    data: {
      feeds,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: feeds.length,
        hasNext: false,
        hasPrev: false,
      },
    },
  }
}

function createActionResponse(action: string, affected: number) {
  return {
    success: true,
    data: {
      action,
      affected,
    },
  }
}

function mockJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function renderFeedAdmin() {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: (url: string) => fetchJson(url),
      }}
    >
      <FeedAdminClient />
    </SWRConfig>
  )
}

describe("FeedAdminClient", () => {
  it("renders feeds and applies keyword/includeDeleted filters", async () => {
    const feeds = [createFeed("feed-1"), createFeed("feed-2")]
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/csrf-token") {
        return Promise.resolve(mockJsonResponse({ token: "test-token" }))
      }
      if (url.startsWith("/api/admin/feeds")) {
        return Promise.resolve(mockJsonResponse(createListResponse(feeds)))
      }
      throw new Error("unexpected call")
    })

    renderFeedAdmin()

    await screen.findByText("动态 feed-1")

    const searchInput = screen.getByPlaceholderText("搜索内容、标签或描述")
    await userEvent.type(searchInput, "error")

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)
      expect(lastCall?.[0]).toContain("q=error")
    })

    const includeSwitch = screen.getByLabelText("包含已隐藏的动态")
    await userEvent.click(includeSwitch)

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)
      expect(lastCall?.[0]).toContain("includeDeleted=true")
    })
  })

  it("handles batch hide action with confirmation and refresh", async () => {
    const feeds = [createFeed("feed-1"), createFeed("feed-2")]
    const queue = [createListResponse(feeds), createListResponse(feeds)]
    let lastPayload = queue[queue.length - 1]

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/csrf-token") {
        return Promise.resolve(mockJsonResponse({ token: "test-token" }))
      }
      if (url.startsWith("/api/admin/feeds")) {
        const payload = queue.length > 0 ? queue.shift()! : lastPayload
        lastPayload = payload
        return Promise.resolve(mockJsonResponse(payload))
      }
      if (url === "/api/admin/feeds/batch") {
        return Promise.resolve(mockJsonResponse(createActionResponse("hide", 2)))
      }
      throw new Error("unexpected call")
    })

    renderFeedAdmin()

    await screen.findByText("动态 feed-1")

    await userEvent.click(screen.getByLabelText("选择动态 feed-1"))
    await userEvent.click(screen.getByLabelText("选择动态 feed-2"))

    await screen.findByText("已选择 2 条动态")

    await userEvent.click(screen.getByRole("button", { name: "隐藏" }))
    const confirmButton = await screen.findByRole("button", { name: "确认执行" })
    await userEvent.click(confirmButton)

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")
      expect(postCall).toBeTruthy()
      const body = JSON.parse((postCall?.[1] as RequestInit).body as string)
      expect(body).toEqual({ action: "hide", ids: ["feed-1", "feed-2"] })
    })

    await waitFor(() => {
      const listCalls = fetchMock.mock.calls.filter(([url]) => (url as string).startsWith("/api/admin/feeds"))
      expect(listCalls.length).toBeGreaterThanOrEqual(2)
    })

    await waitFor(() => {
      expect(screen.queryByText(/已选择/)).not.toBeInTheDocument()
    })
  })

  it("hides admin-only controls for regular authors", async () => {
    authState.user.role = "USER"
    authState.isAdmin = false

    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/csrf-token") {
        return Promise.resolve(mockJsonResponse({ token: "test-token" }))
      }
      if (url.startsWith("/api/admin/feeds")) {
        return Promise.resolve(mockJsonResponse(createListResponse([createFeed("feed-1")])))
      }
      throw new Error("unexpected call")
    })

    renderFeedAdmin()

    await screen.findByText("动态 feed-1")

    expect(screen.getByText("权限限制")).toBeInTheDocument()
    expect(screen.queryByLabelText("包含已隐藏的动态")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument()
  })

  it("shows error state and retries on demand", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/csrf-token") {
        return Promise.resolve(mockJsonResponse({ token: "test-token" }))
      }
      return Promise.resolve(mockJsonResponse({ success: false, error: { message: "boom" } }, 500))
    })

    renderFeedAdmin()

    await screen.findByText("加载失败")

    await userEvent.click(screen.getByRole("button", { name: "重试" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  it("opens detail panel and renders feed metadata", async () => {
    const feeds = [
      createFeed("feed-1", {
        imageUrls: ["https://img.test/1.png"],
        likesCount: 1200,
        commentsCount: 42,
        viewsCount: 555,
        deletedAt: new Date("2024-02-02T00:00:00Z").toISOString(),
      }),
    ]

    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/csrf-token") {
        return Promise.resolve(mockJsonResponse({ token: "test-token" }))
      }
      if (url.startsWith("/api/admin/feeds")) {
        return Promise.resolve(mockJsonResponse(createListResponse(feeds)))
      }
      throw new Error("unexpected call")
    })

    renderFeedAdmin()

    await screen.findByText("动态 feed-1")

    await userEvent.click(screen.getByRole("button", { name: "查看详情" }))

    const panel = screen.getByRole("dialog")

    expect(within(panel).getByText("Feed ID：feed-1")).toBeInTheDocument()
    expect(within(panel).queryByText("对外可见")).not.toBeInTheDocument()
    expect(within(panel).getAllByText("已隐藏")).toHaveLength(1)
    expect(within(panel).getByAltText("Feed 图片")).toBeInTheDocument()
    expect(within(panel).getByText((content) => content.startsWith("点赞"))).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(screen.queryByText("动态详情")).not.toBeInTheDocument()
    })
  })
})

describe("useFeedFilters", () => {
  it("clamps limit changes and resets page", () => {
    const { result } = renderHook(() => useFeedFilters({ initialPage: 3, initialLimit: 50 }))

    act(() => {
      result.current.setPage(4)
    })
    expect(result.current.page).toBe(4)

    act(() => {
      result.current.setLimit(250)
    })

    expect(result.current.limit).toBe(100)
    expect(result.current.page).toBe(1)
  })

  it("normalizes date range order and exposes query state", () => {
    const { result } = renderHook(() => useFeedFilters())

    act(() => {
      result.current.setDateRange("2024-02-10", "2024-02-01")
      result.current.setSearch("  keyword  ")
      result.current.setPinned("pinned")
    })

    expect(result.current.filters.dateFrom).toBe("2024-02-01")
    expect(result.current.filters.dateTo).toBe("2024-02-10")
    expect(result.current.queryParams.q).toBe("keyword")
    expect(result.current.queryParams.isPinned).toBe(true)
    expect(result.current.hasActiveFilters).toBe(true)

    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.hasActiveFilters).toBe(false)
    expect(result.current.filters.dateFrom).toBeNull()
  })
})
