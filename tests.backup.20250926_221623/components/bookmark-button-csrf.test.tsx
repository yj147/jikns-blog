/**
 * 收藏按钮 CSRF Token 测试
 * 验证组件正确使用 fetchJson 并自动带上 CSRF token
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BookmarkButton } from "@/components/blog/bookmark-button"
import * as fetchJsonModule from "@/lib/api/fetch-json"
import { vi } from "vitest"

// Mock fetchJson 模块
vi.mock("@/lib/api/fetch-json", () => ({
  fetchGet: vi.fn(),
  fetchPost: vi.fn(),
  FetchError: class FetchError extends Error {
    statusCode: number
    constructor(message: string, statusCode: number) {
      super(message)
      this.statusCode = statusCode
    }
  },
}))

// Mock useToast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe("BookmarkButton CSRF Token Tests", () => {
  const mockFetchGet = vi.mocked(fetchJsonModule.fetchGet)
  const mockFetchPost = vi.mocked(fetchJsonModule.fetchPost)

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置模拟的 CSRF token
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: vi.fn(() => "test-csrf-token"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  it("应该在查询状态时使用 fetchGet（自动带 CSRF token）", async () => {
    // 模拟状态查询响应
    mockFetchGet.mockResolvedValueOnce({
      isBookmarked: false,
      count: 3,
    })

    render(<BookmarkButton postId="test-post-456" />)

    await waitFor(() => {
      // 验证 fetchGet 被调用，参数正确
      expect(mockFetchGet).toHaveBeenCalledWith("/api/bookmarks", {
        action: "status",
        postId: "test-post-456",
      })
    })
  })

  it("应该在切换收藏时使用 fetchPost（自动带 CSRF token）", async () => {
    // 先模拟初始状态查询
    mockFetchGet.mockResolvedValueOnce({
      isBookmarked: false,
      count: 3,
    })

    // 模拟收藏切换响应
    mockFetchPost.mockResolvedValueOnce({
      isBookmarked: true,
      count: 4,
    })

    render(<BookmarkButton postId="test-post-456" />)

    // 等待初始加载完成
    await waitFor(() => {
      expect(mockFetchGet).toHaveBeenCalled()
    })

    // 点击收藏按钮
    const button = screen.getByTestId("bookmark-button")
    fireEvent.click(button)

    await waitFor(() => {
      // 验证 fetchPost 被调用，参数正确
      expect(mockFetchPost).toHaveBeenCalledWith("/api/bookmarks", {
        postId: "test-post-456",
      })
    })
  })

  it("应该正确处理 401 错误（未认证）", async () => {
    // 模拟初始状态查询
    mockFetchGet.mockResolvedValueOnce({
      isBookmarked: false,
      count: 3,
    })

    // 模拟 401 错误
    mockFetchPost.mockRejectedValueOnce(new fetchJsonModule.FetchError("未授权", 401))

    render(<BookmarkButton postId="test-post-456" />)

    // 等待初始加载
    await waitFor(() => {
      expect(mockFetchGet).toHaveBeenCalled()
    })

    // 点击收藏按钮
    const button = screen.getByTestId("bookmark-button")
    fireEvent.click(button)

    // 验证按钮仍可用（错误处理后）
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it("应该处理网络错误并保持状态一致", async () => {
    // 模拟初始状态
    mockFetchGet.mockResolvedValueOnce({
      isBookmarked: false,
      count: 8,
    })

    // 模拟网络错误
    mockFetchPost.mockRejectedValueOnce(new Error("Network error"))

    render(<BookmarkButton postId="test-post-456" />)

    // 等待初始加载
    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument()
    })

    // 点击收藏
    const button = screen.getByTestId("bookmark-button")
    fireEvent.click(button)

    // 验证状态回滚（错误后恢复原状态）
    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument()
      expect(button).toHaveAttribute("data-bookmarked", "false")
    })
  })
})
