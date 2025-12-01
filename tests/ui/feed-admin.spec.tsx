import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

import FeedAdminClient from "@/components/admin/feed-admin-client"
import type { FeedItem } from "@/types/feed"

const toastSpy = vi.fn()

if (typeof Element !== "undefined") {
  const elementProto = Element.prototype as any
  if (!elementProto.hasPointerCapture) {
    elementProto.hasPointerCapture = () => false
  }
  if (!elementProto.releasePointerCapture) {
    elementProto.releasePointerCapture = () => {}
  }
  if (!elementProto.scrollIntoView) {
    elementProto.scrollIntoView = () => {}
  }
}

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: toastSpy,
    dismiss: vi.fn(),
    toasts: [],
  }),
}))

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
const originalFetch = global.fetch

beforeEach(() => {
  toastSpy.mockReset()
  authState.user.role = "ADMIN"
  authState.isAdmin = true
  fetchMock.mockReset()
  window.sessionStorage?.clear()
  document.cookie = ""
  ;(globalThis.fetch as any) = fetchMock
})

afterEach(() => {
  ;(globalThis.fetch as any) = originalFetch
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

function createListResponse(feeds: FeedItem[], paginationOverrides?: Partial<FeedListPagination>) {
  const defaults: FeedListPagination = {
    currentPage: 1,
    totalPages: 1,
    totalCount: feeds.length,
    hasNext: false,
    hasPrev: false,
  }

  return {
    success: true,
    data: {
      feeds,
      pagination: {
        ...defaults,
        ...(paginationOverrides ?? {}),
      },
    },
  }
}

type FeedListPagination = {
  currentPage: number
  totalPages: number
  totalCount: number
  hasNext: boolean
  hasPrev: boolean
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

async function fetchJson(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("request failed")
  }
  return response.json()
}

describe("FeedAdminClient filters", () => {
  it("支持管理员组合筛选、分页和重置", async () => {
    const requestLog: string[] = []
    fetchMock.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url

      if (url.startsWith("/api/admin/feeds")) {
        requestLog.push(url)
        const fullUrl = new URL(url, "http://localhost")
        const page = Number(fullUrl.searchParams.get("page") ?? "1")
        const feeds = [createFeed(`feed-${page}`)]
        return Promise.resolve(
          mockJsonResponse(
            createListResponse(feeds, {
              currentPage: page,
              totalPages: 3,
              totalCount: 6,
              hasNext: page < 3,
              hasPrev: page > 1,
            })
          )
        )
      }

      return Promise.reject(new Error(`unexpected request: ${url}`))
    })

    renderFeedAdmin()

    await screen.findByText("动态 feed-1")
    await screen.findByText("第 1 / 3 页")

    await userEvent.click(screen.getByRole("button", { name: "只看我" }))
    await waitFor(() => {
      expect(requestLog.at(-1)).toContain(`authorId=${authState.user.id}`)
    })

    const searchInput = screen.getByPlaceholderText("搜索内容、标签或描述")
    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, "Alpha")
    await waitFor(() => {
      expect(requestLog.at(-1)).toContain("q=Alpha")
    })

    await userEvent.click(screen.getByLabelText("置顶筛选"))
    const pinnedOption = await screen.findByRole("option", { name: "仅置顶" })
    await userEvent.click(pinnedOption)
    await waitFor(() => {
      expect(requestLog.at(-1)).toContain("isPinned=true")
    })

    const dateFrom = screen.getByLabelText("开始日期")
    const dateTo = screen.getByLabelText("结束日期")
    await userEvent.clear(dateFrom)
    await userEvent.type(dateFrom, "2024-02-01")
    await userEvent.clear(dateTo)
    await userEvent.type(dateTo, "2024-02-10")
    await waitFor(() => {
      const lastCall = requestLog.at(-1) ?? ""
      expect(lastCall).toContain("dateFrom=2024-02-01")
      expect(lastCall).toContain("dateTo=2024-02-10")
    })

    await userEvent.click(screen.getByRole("button", { name: "下一页" }))
    await waitFor(() => {
      expect(screen.getByText("第 2 / 3 页")).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(requestLog.at(-1)).toContain("page=2")
    })

    await userEvent.click(screen.getByRole("button", { name: "上一页" }))
    await waitFor(() => {
      expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "清空筛选" })).toBeEnabled()
    })
    await userEvent.click(screen.getByRole("button", { name: "清空筛选" }))
    await waitFor(() => {
      const lastCall = requestLog.at(-1) ?? ""
      expect(lastCall).toContain("page=1")
      expect(lastCall).toContain("limit=20")
      expect(lastCall).not.toContain("authorId=")
      expect(lastCall).not.toContain("isPinned")
      expect(lastCall).not.toContain("dateFrom")
    })
  })
})

describe("FeedAdminClient batch failures", () => {
  it("批量操作失败时提示错误并保留选择", async () => {
    fetchMock.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url

      if (url === "/api/csrf-token") {
        return Promise.resolve(mockJsonResponse({ token: "csrf-token" }))
      }

      if (url.startsWith("/api/admin/feeds/batch")) {
        return Promise.resolve(
          mockJsonResponse({ success: false, error: { message: "包含无权限" } }, 403)
        )
      }

      if (url.startsWith("/api/admin/feeds")) {
        return Promise.resolve(
          mockJsonResponse(
            createListResponse([createFeed("feed-1")], {
              currentPage: 1,
              totalPages: 1,
              totalCount: 1,
              hasNext: false,
              hasPrev: false,
            })
          )
        )
      }

      return Promise.reject(new Error(`unexpected request: ${url}`))
    })

    renderFeedAdmin()

    await screen.findByText("动态 feed-1")

    await userEvent.click(screen.getByLabelText("选择动态 feed-1"))
    await screen.findByText("已选择 1 条动态")

    await userEvent.click(screen.getByRole("button", { name: "隐藏" }))
    const confirmButton = await screen.findByRole("button", { name: "确认执行" })
    await userEvent.click(confirmButton)

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({ variant: "destructive", title: "包含无权限" })
    })

    const selectionAlert = screen.getByText("已选择 1 条动态")
    expect(selectionAlert).toBeInTheDocument()
  })
})
