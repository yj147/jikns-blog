import React from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}))

import { ProfilePostsTab } from "@/components/profile/profile-posts-tab"

const jsonResponse = (data: any, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as unknown as Response

const errorResponse = (status = 500, message = "server error") =>
  ({
    ok: false,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ error: { message } }),
    text: async () => JSON.stringify({ error: { message } }),
  }) as unknown as Response

const userId = "user-profile"
const originalFetch = global.fetch

const renderWithSWR = (ui: React.ReactNode) =>
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        errorRetryInterval: 0,
        shouldRetryOnError: false,
      }}
    >
      {ui}
    </SWRConfig>
  )

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

describe("ProfilePostsTab", () => {
  it("空态时展示友好提示", async () => {
    const emptyPage = {
      success: true,
      data: [],
      pagination: { page: 1, limit: 5, total: 0, hasMore: false },
    }

    global.fetch = vi.fn(async () => jsonResponse(emptyPage)) as unknown as typeof fetch

    renderWithSWR(<ProfilePostsTab userId={userId} />)

    await waitFor(() => {
      expect(screen.getByText("还没有发布博客文章")).toBeInTheDocument()
    })
  })

  it("正常渲染列表并在加载更多时显示 loading 状态", async () => {
    const page1 = {
      success: true,
      data: [
        {
          id: "post-1",
          title: "第一篇文章",
          slug: "post-1",
          excerpt: "文章摘要 1",
          coverImage: null,
          publishedAt: "2024-05-01T00:00:00Z",
          viewCount: 150,
          readTimeMinutes: 5,
          tags: [
            {
              id: "tag-1",
              name: "Next.js",
              slug: "nextjs",
            },
          ],
          _count: {
            likes: 10,
            comments: 2,
          },
        },
      ],
      pagination: { page: 1, limit: 5, total: 2, hasMore: true },
    }

    const page2 = {
      success: true,
      data: [
        {
          id: "post-2",
          title: "第二篇文章",
          slug: "post-2",
          excerpt: "文章摘要 2",
          coverImage: null,
          publishedAt: "2024-05-10T00:00:00Z",
          viewCount: 320,
          readTimeMinutes: 8,
          tags: [],
          _count: {
            likes: 25,
            comments: 6,
          },
        },
      ],
      pagination: { page: 2, limit: 5, total: 2, hasMore: false },
    }

    let resolvePage2: (value: Response) => void = () => {}
    const page2Promise = new Promise<Response>((resolve) => {
      resolvePage2 = resolve
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url
      if (url.includes("page=1")) {
        return jsonResponse(page1)
      }
      if (url.includes("page=2")) {
        return page2Promise
      }
      return jsonResponse(page1)
    }) as unknown as typeof fetch

    global.fetch = fetchMock

    renderWithSWR(<ProfilePostsTab userId={userId} />)

    await waitFor(() => expect(screen.getByText("第一篇文章")).toBeInTheDocument())
    expect(screen.getByText("文章摘要 1")).toBeInTheDocument()
    expect(screen.getByText("150 阅读")).toBeInTheDocument()
    expect(screen.getByText("10 点赞")).toBeInTheDocument()
    expect(screen.getByText("2 评论")).toBeInTheDocument()

    const loadMoreButton = await screen.findByRole("button", { name: "加载更多" })
    const user = userEvent.setup()
    await user.click(loadMoreButton)

    await waitFor(() => expect(screen.getByRole("button", { name: "加载中..." })).toBeDisabled())

    resolvePage2(jsonResponse(page2))

    await waitFor(() => expect(screen.getByText("第二篇文章")).toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([arg]) => String(arg).includes("page=2"))).toBe(true)
  })

  it("API 失败时展示错误并支持重试", async () => {
    const page = {
      success: true,
      data: [
        {
          id: "retry-post",
          title: "重试后的文章",
          slug: "retry-post",
          excerpt: "恢复后摘要",
          coverImage: null,
          publishedAt: "2024-05-12T00:00:00Z",
          viewCount: 80,
          readTimeMinutes: 4,
          tags: [],
          _count: {
            likes: 5,
            comments: 1,
          },
        },
      ],
      pagination: { page: 1, limit: 5, total: 1, hasMore: false },
    }

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => errorResponse(500, "boom"))
      .mockImplementationOnce(async () => jsonResponse(page)) as unknown as typeof fetch

    global.fetch = fetchMock

    renderWithSWR(<ProfilePostsTab userId={userId} />)

    await waitFor(() => expect(screen.getByText("加载文章失败")).toBeInTheDocument())

    const retryButton = screen.getByRole("button", { name: "重新加载" })
    const user = userEvent.setup()
    await user.click(retryButton)

    await waitFor(() => expect(screen.getByText("重试后的文章")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
