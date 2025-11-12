/**
 * 测试点赞按钮页面刷新后的状态保持
 */

import { render, screen, waitFor } from "@testing-library/react"
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
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

describe("LikeButton - 页面刷新状态保持", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("文章页刷新后应该正确显示已点赞状态", async () => {
    // 模拟服务器返回：用户已点赞
    mockFetchGet.mockResolvedValueOnce({
      isLiked: true,
      count: 42,
    })

    // 渲染组件，不传 initialIsLiked（模拟文章页的实际情况）
    render(
      <LikeButton
        targetId="article-123"
        targetType="post"
        initialCount={42}
        // 注意：不传 initialIsLiked
      />
    )

    // 等待状态查询完成
    await waitFor(() => {
      const button = screen.getByRole("button")
      expect(button).toHaveAttribute("aria-pressed", "true")
      expect(button).toHaveAttribute("data-liked", "true")

      // 验证红心填充
      const heart = button.querySelector("svg")
      expect(heart).toHaveClass("fill-current")

      // 验证点赞数
      expect(screen.getByTestId("like-count")).toHaveTextContent("42")
    })

    // 验证查询调用
    expect(mockFetchGet).toHaveBeenCalledWith("/api/likes", {
      action: "status",
      targetType: "post",
      targetId: "article-123",
    })
  })

  it("动态页传入initialIsLiked时应该不查询状态", async () => {
    // 渲染组件，传入 initialIsLiked（模拟动态页的情况）
    render(
      <LikeButton
        targetId="activity-456"
        targetType="activity"
        initialCount={10}
        initialIsLiked={true} // 明确传入初始状态
      />
    )

    // 立即验证状态（不需要等待）
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(button).toHaveAttribute("data-liked", "true")

    // 验证红心填充
    const heart = button.querySelector("svg")
    expect(heart).toHaveClass("fill-current")

    // 验证点赞数
    expect(screen.getByTestId("like-count")).toHaveTextContent("10")

    // 验证没有调用查询
    expect(mockFetchGet).not.toHaveBeenCalled()
  })

  it("未登录用户刷新后应该正确显示未点赞状态", async () => {
    // 模拟服务器返回 401（未登录）
    const FetchError = (await import("@/lib/api/fetch-json")).FetchError
    mockFetchGet.mockRejectedValueOnce(new FetchError("未登录", 401))

    // 渲染组件，不传 initialIsLiked
    render(<LikeButton targetId="article-789" targetType="post" initialCount={20} />)

    // 等待状态查询完成
    await waitFor(() => {
      const button = screen.getByRole("button")
      expect(button).toHaveAttribute("aria-pressed", "false")
      expect(button).toHaveAttribute("data-liked", "false")

      // 验证空心
      const heart = button.querySelector("svg")
      expect(heart).not.toHaveClass("fill-current")

      // 验证点赞数（使用初始值）
      expect(screen.getByTestId("like-count")).toHaveTextContent("20")
    })

    // 验证查询被调用
    expect(mockFetchGet).toHaveBeenCalled()
  })
})
