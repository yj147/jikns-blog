/**
 * LikeButton 组件测试
 * QA-Comp-1: 测试点赞按钮的各种交互场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LikeButton } from "@/components/blog/like-button"

// Mock useToast hook
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch as any

const createFetchResponse = (body: any, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  headers: {
    get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
  },
  json: async () => body,
  text: async () => JSON.stringify(body),
})

describe("LikeButton", () => {
  const defaultProps = {
    targetId: "test-post-123",
    initialCount: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("初始渲染", () => {
    it("应该正确显示初始计数", async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      // 初始显示加载状态
      expect(screen.getByText("...")).toBeInTheDocument()

      // 等待状态加载完成
      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // 验证 API 调用参数
      const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchUrl).toBe("/api/likes?action=status&targetType=post&targetId=test-post-123")
      expect(fetchOptions).toMatchObject({ method: "GET", credentials: "same-origin" })
      expect(fetchOptions.headers["Content-Type"]).toBe("application/json")
    })

    it("应该正确显示已点赞状态", async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: true, count: 15 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        const button = screen.getByRole("button")
        expect(button).toHaveAttribute("aria-pressed", "true")
        expect(screen.getByText("15")).toBeInTheDocument()
      })
    })

    it("应该正确格式化大数字", async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 1500 } })
      )

      render(<LikeButton targetId="test" initialCount={1500} />)

      await waitFor(() => {
        expect(screen.getByText("1.5K")).toBeInTheDocument()
      })
    })

    it("未登录用户应该显示初始计数", async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({}, { ok: false, status: 401 }))

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
        const button = screen.getByRole("button")
        expect(button).toHaveAttribute("aria-pressed", "false")
      })
    })
  })

  describe("切换点赞", () => {
    it("成功添加点赞", async () => {
      // 初始状态查询
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // Mock 添加点赞的响应
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: true, count: 11 } })
      )

      const user = userEvent.setup()
      const button = screen.getByRole("button")

      await user.click(button)

      // 验证乐观更新
      expect(screen.getByText("11")).toBeInTheDocument()

      // 验证成功提示
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          description: "已点赞文章",
        })
      })

      // 验证按钮状态
      expect(button).toHaveAttribute("aria-pressed", "true")

      // 验证 API 调用参数
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      expect(lastCall[0]).toBe("/api/likes")
      expect(lastCall[1]).toMatchObject({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ targetType: "post", targetId: "test-post-123" }),
      })
      expect(lastCall[1].headers["Content-Type"]).toBe("application/json")
    })

    it("成功取消点赞", async () => {
      // 初始状态查询 - 已点赞
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: true, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // Mock 取消点赞的响应
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 9 } })
      )

      const user = userEvent.setup()
      const button = screen.getByRole("button")

      await user.click(button)

      // 验证乐观更新
      expect(screen.getByText("9")).toBeInTheDocument()

      // 验证成功提示
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          description: "已取消点赞",
        })
      })

      // 验证按钮状态
      expect(button).toHaveAttribute("aria-pressed", "false")
    })

    it("失败时应该回滚状态", async () => {
      // 初始状态查询
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // Mock 失败响应
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ message: "服务器错误" }, { ok: false, status: 500 })
      )

      const user = userEvent.setup()
      const button = screen.getByRole("button")

      await user.click(button)

      // 等待回滚到原始状态
      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // 验证错误提示（使用新的 useInteractionErrorToast hook 格式）
      expect(mockToast).toHaveBeenCalledWith({
        title: "点赞文章失败",
        description: "服务器错误",
        variant: "destructive",
      })

      // 验证按钮状态回滚
      expect(button).toHaveAttribute("aria-pressed", "false")
    })

    it("未登录时应该提示登录", async () => {
      // 初始状态查询
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // Mock 401 响应
      mockFetch.mockResolvedValueOnce(createFetchResponse({}, { ok: false, status: 401 }))

      const user = userEvent.setup()
      const button = screen.getByRole("button")

      await user.click(button)

      // 等待状态回滚
      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // 验证登录提示（使用新的 useInteractionErrorToast hook 格式）
      expect(mockToast).toHaveBeenCalledWith({
        title: "点赞文章失败",
        description: "请先登录",
        variant: "destructive",
      })
    })

    it("网络错误时应该正确处理", async () => {
      // 初始状态查询
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // Mock 网络错误
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const user = userEvent.setup()
      const button = screen.getByRole("button")

      await user.click(button)

      // 等待状态回滚
      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // 验证网络错误提示（使用新的 useInteractionErrorToast hook 格式）
      expect(mockToast).toHaveBeenCalledWith({
        title: "点赞文章失败",
        description: "Network error",
        variant: "destructive",
      })
    })
  })

  describe("交互状态", () => {
    it("加载时应该禁用按钮", async () => {
      // Mock 一个永不 resolve 的 Promise 来模拟加载状态
      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      render(<LikeButton {...defaultProps} />)

      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })

    it("操作中应该禁用按钮防止重复点击", async () => {
      // 初始状态查询
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText("10")).toBeInTheDocument()
      })

      // Mock 一个慢响应
      let resolveToggle: any
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveToggle = resolve
          })
      )

      const user = userEvent.setup()
      const button = screen.getByRole("button")

      await user.click(button)

      // 按钮应该被禁用
      expect(button).toBeDisabled()

      // 完成请求
      resolveToggle(createFetchResponse({ success: true, data: { isLiked: true, count: 11 } }))

      // 等待按钮重新启用
      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })
  })

  describe("显示选项", () => {
    it("showCount=false 时不应该显示计数", async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      render(<LikeButton targetId="test" showCount={false} />)

      await waitFor(() => {
        const button = screen.getByRole("button")
        expect(button).toBeInTheDocument()
      })

      // 不应该显示计数
      expect(screen.queryByText("10")).not.toBeInTheDocument()
    })

    it("应该支持不同的按钮大小", async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      const { rerender } = render(<LikeButton {...defaultProps} size="sm" />)

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument()
      })

      rerender(<LikeButton {...defaultProps} size="lg" />)

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument()
      })
    })

    it("应该支持不同的按钮变体", async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ success: true, data: { isLiked: false, count: 10 } })
      )

      const { rerender } = render(<LikeButton {...defaultProps} variant="outline" />)

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument()
      })

      rerender(<LikeButton {...defaultProps} variant="ghost" />)

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument()
      })
    })
  })
})
