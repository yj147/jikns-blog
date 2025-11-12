/**
 * LikeButton 双击测试
 * P2-2: 测试前端双击场景，验证幂等性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { LikeButton } from "@/components/blog/like-button"
import * as fetchJson from "@/lib/api/fetch-json"

// Mock useToast hook
const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock fetch-json (使用工厂函数避免 hoisting 问题)
vi.mock("@/lib/api/fetch-json", () => {
  const mockFetchGet = vi.fn()
  const mockFetchPost = vi.fn()

  return {
    fetchGet: mockFetchGet,
    fetchPost: mockFetchPost,
    FetchError: class FetchError extends Error {
      statusCode: number
      constructor(message: string, statusCode: number) {
        super(message)
        this.statusCode = statusCode
      }
    },
  }
})

describe("LikeButton 双击测试", () => {
  const mockFetchGet = vi.mocked(fetchJson.fetchGet)
  const mockFetchPost = vi.mocked(fetchJson.fetchPost)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("快速双击时按钮被禁用，防止重复请求", async () => {
    // Mock: 初始未点赞
    mockFetchGet.mockResolvedValueOnce({ isLiked: false, count: 10 })

    // Mock: 第一次点赞请求
    mockFetchPost.mockResolvedValueOnce({ isLiked: true, count: 11 })

    render(<LikeButton targetId="test-post" targetType="post" />)

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument()
    })

    const button = screen.getByRole("button")

    // 快速双击
    fireEvent.click(button)
    fireEvent.click(button) // 第二次点击应该被忽略（按钮已禁用）

    await waitFor(() => {
      // 最终状态应该是已点赞
      expect(button).toHaveAttribute("data-liked", "true")
      expect(screen.getByText("11")).toBeInTheDocument()
    })

    // 只应该发送了 1 次请求（第二次被防抖阻止）
    expect(mockFetchPost).toHaveBeenCalledTimes(1)
  })

  it("双击期间禁用按钮防止过度点击", async () => {
    // Mock: 初始未点赞
    mockFetchGet.mockResolvedValueOnce({ isLiked: false, count: 10 })

    // Mock: 第一次点赞请求延迟返回
    mockFetchPost.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ isLiked: true, count: 11 }), 100)
        })
    )

    render(<LikeButton targetId="test-post" targetType="post" />)

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument()
    })

    const button = screen.getByRole("button")

    // 第一次点击
    fireEvent.click(button)

    // 按钮应该被禁用
    await waitFor(() => {
      expect(button).toBeDisabled()
    })

    // 等待请求完成
    await waitFor(
      () => {
        expect(button).not.toBeDisabled()
      },
      { timeout: 200 }
    )

    // 最终状态应该是已点赞
    expect(button).toHaveAttribute("data-liked", "true")
    expect(screen.getByText("11")).toBeInTheDocument()
  })

  it("双击后第二次请求失败应正确回滚", async () => {
    // Mock: 初始未点赞
    mockFetchGet.mockResolvedValueOnce({ isLiked: false, count: 10 })

    // Mock: 第一次成功，第二次失败
    mockFetchPost
      .mockResolvedValueOnce({ isLiked: true, count: 11 })
      .mockRejectedValueOnce(new Error("Network error"))

    render(<LikeButton targetId="test-post" targetType="post" />)

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument()
    })

    const button = screen.getByRole("button")

    // 第一次点击（成功）
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveAttribute("data-liked", "true")
      expect(screen.getByText("11")).toBeInTheDocument()
    })

    // 第二次点击（失败）
    fireEvent.click(button)

    await waitFor(() => {
      // 应该显示错误提示
      expect(mockToast).toHaveBeenCalled()
    })

    // 状态应该回滚到已点赞（第一次成功的状态）
    expect(button).toHaveAttribute("data-liked", "true")
  })
})
