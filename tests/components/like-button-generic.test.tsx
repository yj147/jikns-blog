/**
 * 通用点赞按钮测试
 * 验证LikeButton支持post和activity两种目标类型
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import { LikeButton } from "@/components/blog/like-button"

// Mock fetch-json
const mockFetchGet = vi.fn()
const mockFetchPost = vi.fn()

vi.mock("@/lib/api/fetch-json", () => ({
  fetchGet: (...args: any[]) => mockFetchGet(...args),
  fetchPost: (...args: any[]) => mockFetchPost(...args),
  FetchError: class FetchError extends Error {
    constructor(
      public message: string,
      public statusCode: number
    ) {
      super(message)
    }
  },
}))

// Mock toast
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

describe("LikeButton - 通用点赞功能", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("文章点赞", () => {
    it("应该正确处理文章点赞", async () => {
      mockFetchPost.mockResolvedValueOnce({
        isLiked: true,
        count: 11,
      })

      render(
        <LikeButton
          targetId="post-123"
          targetType="post"
          initialCount={10}
          initialIsLiked={false}
        />
      )

      const button = screen.getByRole("button")

      // 初始状态
      expect(screen.getByText("10")).toBeInTheDocument()

      // 点击点赞
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockFetchPost).toHaveBeenCalledWith("/api/likes", {
          targetType: "post",
          targetId: "post-123",
        })
        expect(mockToast).toHaveBeenCalledWith({
          description: "已点赞文章",
        })
      })
    })

    it("应该正确显示文章取消点赞提示", async () => {
      mockFetchPost.mockResolvedValueOnce({
        isLiked: false,
        count: 9,
      })

      render(
        <LikeButton targetId="post-456" targetType="post" initialCount={10} initialIsLiked={true} />
      )

      const button = screen.getByRole("button")
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          description: "已取消点赞",
        })
      })
    })
  })

  describe("动态点赞", () => {
    it("应该正确处理动态点赞", async () => {
      mockFetchPost.mockResolvedValueOnce({
        isLiked: true,
        count: 6,
      })

      render(
        <LikeButton
          targetId="activity-789"
          targetType="activity"
          initialCount={5}
          initialIsLiked={false}
        />
      )

      const button = screen.getByRole("button")

      // 初始状态
      expect(screen.getByText("5")).toBeInTheDocument()

      // 点击点赞
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockFetchPost).toHaveBeenCalledWith("/api/likes", {
          targetType: "activity",
          targetId: "activity-789",
        })
        expect(mockToast).toHaveBeenCalledWith({
          description: "已点赞动态",
        })
      })
    })

    it("应该使用提供的初始点赞状态而不查询", async () => {
      render(
        <LikeButton
          targetId="activity-999"
          targetType="activity"
          initialCount={20}
          initialIsLiked={true}
        />
      )

      // 不应该调用查询接口，因为提供了初始值
      expect(mockFetchGet).not.toHaveBeenCalled()

      // 应该显示初始状态
      expect(screen.getByText("20")).toBeInTheDocument()
      const button = screen.getByRole("button")
      expect(button).toHaveAttribute("aria-pressed", "true")
    })

    it("应该在外部状态变化时同步显示最新状态", async () => {
      const { rerender } = render(
        <LikeButton
          targetId="activity-1000"
          targetType="activity"
          initialCount={5}
          initialIsLiked={false}
        />
      )

      const button = screen.getByRole("button")
      expect(button).toHaveAttribute("aria-pressed", "false")
      expect(screen.getByText("5")).toBeInTheDocument()

      rerender(
        <LikeButton
          targetId="activity-1000"
          targetType="activity"
          initialCount={6}
          initialIsLiked={true}
        />
      )

      await waitFor(() => {
        expect(screen.getByText("6")).toBeInTheDocument()
        expect(button).toHaveAttribute("aria-pressed", "true")
      })
    })
  })

  describe("回调函数", () => {
    it("应该在点赞状态改变时调用onLikeChange", async () => {
      const onLikeChange = vi.fn()

      mockFetchPost.mockResolvedValueOnce({
        isLiked: true,
        count: 101,
      })

      render(
        <LikeButton
          targetId="test-123"
          targetType="activity"
          initialCount={100}
          initialIsLiked={false}
          onLikeChange={onLikeChange}
        />
      )

      const button = screen.getByRole("button")
      fireEvent.click(button)

      // 乐观更新时调用一次
      expect(onLikeChange).toHaveBeenCalledWith(true, 101)

      await waitFor(() => {
        // 服务器响应后再调用一次
        expect(onLikeChange).toHaveBeenCalledTimes(2)
        expect(onLikeChange).toHaveBeenLastCalledWith(true, 101)
      })
    })

    it("应该在错误时回滚并调用onLikeChange", async () => {
      const onLikeChange = vi.fn()
      const FetchError = (await import("@/lib/api/fetch-json")).FetchError

      mockFetchPost.mockRejectedValueOnce(new FetchError("网络错误", 500))

      render(
        <LikeButton
          targetId="error-test"
          targetType="post"
          initialCount={50}
          initialIsLiked={false}
          onLikeChange={onLikeChange}
        />
      )

      const button = screen.getByRole("button")
      fireEvent.click(button)

      // 乐观更新
      expect(onLikeChange).toHaveBeenCalledWith(true, 51)

      await waitFor(() => {
        // 错误后回滚
        expect(onLikeChange).toHaveBeenLastCalledWith(false, 50)
      })
    })
  })

  describe("默认值处理", () => {
    it("应该使用默认的targetType为post", async () => {
      // 先 mock fetchGet 用于初始状态查询
      mockFetchGet.mockResolvedValueOnce({
        isLiked: false,
        count: 1,
      })

      // 再 mock fetchPost 用于点击后的切换
      mockFetchPost.mockResolvedValueOnce({
        isLiked: true,
        count: 2,
      })

      render(<LikeButton targetId="default-test" initialCount={1} />)

      // 等待初始查询完成
      await waitFor(() => {
        expect(mockFetchGet).toHaveBeenCalledWith("/api/likes", {
          action: "status",
          targetType: "post",
          targetId: "default-test",
        })
      })

      const button = screen.getByRole("button")
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockFetchPost).toHaveBeenCalledWith("/api/likes", {
          targetType: "post", // 默认值
          targetId: "default-test",
        })
      })
    })
  })
})
