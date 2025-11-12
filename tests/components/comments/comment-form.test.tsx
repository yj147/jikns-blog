/**
 * 评论表单组件测试
 */

import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach } from "vitest"
import CommentForm from "@/components/comments/comment-form"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

// Mock 依赖
vi.mock("@/hooks/use-auth")
vi.mock("@/hooks/use-toast")

// Mock fetch
global.fetch = vi.fn()

describe("CommentForm", () => {
  const mockUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "USER",
  }

  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("未登录状态", () => {
    it("未登录用户应该看到登录提示", () => {
      ;(useAuth as any).mockReturnValue({ user: null })

      render(<CommentForm targetType="post" targetId="post-1" />)

      expect(screen.getByText("登录后即可发表评论")).toBeInTheDocument()
      expect(screen.getByText("立即登录")).toBeInTheDocument()
    })

    it("点击登录按钮应该跳转到登录页", () => {
      ;(useAuth as any).mockReturnValue({ user: null })
      const originalLocation = window.location

      // Mock window.location
      delete (window as any).location
      window.location = { href: "" } as any

      render(<CommentForm targetType="post" targetId="post-1" />)

      const loginButton = screen.getByText("立即登录")
      fireEvent.click(loginButton)

      expect(window.location.href).toBe("/login")

      // Restore window.location
      window.location = originalLocation
    })
  })

  describe("登录状态", () => {
    it("登录用户应该看到评论输入框", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })

      render(<CommentForm targetType="post" targetId="post-1" />)

      expect(screen.getByPlaceholderText("写下你的评论...")).toBeInTheDocument()
      expect(screen.getByText("发表评论")).toBeInTheDocument()
    })

    it("应该显示自定义占位符文本", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })

      render(<CommentForm targetType="post" targetId="post-1" placeholder="自定义占位符文本" />)

      expect(screen.getByPlaceholderText("自定义占位符文本")).toBeInTheDocument()
    })

    it("应该显示字数统计", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const user = userEvent.setup()

      render(<CommentForm targetType="post" targetId="post-1" />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      await user.type(textarea, "这是一条测试评论")

      expect(screen.getByText("8 / 1000")).toBeInTheDocument()
    })

    it("超过字数限制应该显示错误", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const user = userEvent.setup()

      render(<CommentForm targetType="post" targetId="post-1" />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      const longText = "a".repeat(1001)
      await user.type(textarea, longText)

      const charCount = screen.getByText("1001 / 1000")
      expect(charCount).toHaveClass("text-red-500")
    })

    it("空内容不能提交", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })

      render(<CommentForm targetType="post" targetId="post-1" />)

      const submitButton = screen.getByText("发表评论")
      expect(submitButton).toBeDisabled()
    })

    it("有取消按钮时应该显示取消按钮", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })

      render(<CommentForm targetType="post" targetId="post-1" onCancel={mockOnCancel} />)

      expect(screen.getByText("取消")).toBeInTheDocument()
    })
  })

  describe("提交功能", () => {
    it("提交成功应该重置表单并调用成功回调", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const mockToast = vi.fn()
      ;(toast as any).mockImplementation(mockToast)
      const user = userEvent.setup()

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({ id: "new-comment-1" }),
      })

      render(<CommentForm targetType="post" targetId="post-1" onSuccess={mockOnSuccess} />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      await user.type(textarea, "这是一条测试评论")

      const submitButton = screen.getByText("发表评论")
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/comments",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              "X-CSRF-Token": expect.any(String),
            }),
            credentials: "same-origin",
            body: JSON.stringify({
              content: "这是一条测试评论",
              targetType: "post",
              targetId: "post-1",
              parentId: undefined,
            }),
          })
        )

        expect(mockToast).toHaveBeenCalledWith({
          title: "评论发表成功",
        })

        expect(mockOnSuccess).toHaveBeenCalled()
        expect(textarea).toHaveValue("")
      })
    })

    it("提交失败应该显示错误信息", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const mockToast = vi.fn()
      ;(toast as any).mockImplementation(mockToast)
      const user = userEvent.setup()

      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({ error: "操作过于频繁" }),
      })

      render(<CommentForm targetType="post" targetId="post-1" />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      await user.type(textarea, "这是一条测试评论")

      const submitButton = screen.getByText("发表评论")
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "操作过于频繁，请稍后再试",
          variant: "destructive",
        })
      })
    })

    it("提交时应该显示加载状态", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const user = userEvent.setup()

      ;(fetch as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  headers: {
                    get: () => "application/json",
                  },
                  json: async () => ({ id: "new-comment-1" }),
                }),
              100
            )
          })
      )

      render(<CommentForm targetType="post" targetId="post-1" />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      await user.type(textarea, "这是一条测试评论")

      const submitButton = screen.getByText("发表评论")
      fireEvent.click(submitButton)

      expect(screen.getByText("发送中...")).toBeInTheDocument()
      expect(textarea).toBeDisabled()

      await waitFor(() => {
        expect(screen.getByText("发表评论")).toBeInTheDocument()
      })
    })

    it("应该正确处理回复评论", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const user = userEvent.setup()

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json",
        },
        json: async () => ({ id: "new-reply-1" }),
      })

      render(
        <CommentForm
          targetType="post"
          targetId="post-1"
          parentId="parent-comment-1"
          placeholder="回复 @Test User..."
        />
      )

      const textarea = screen.getByPlaceholderText("回复 @Test User...")
      await user.type(textarea, "这是一条回复")

      const submitButton = screen.getByText("发表评论")
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/comments",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              "X-CSRF-Token": expect.any(String),
            }),
            credentials: "same-origin",
            body: JSON.stringify({
              content: "这是一条回复",
              targetType: "post",
              targetId: "post-1",
              parentId: "parent-comment-1",
            }),
          })
        )
      })
    })
  })

  describe("取消功能", () => {
    it("点击取消按钮应该调用取消回调", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })

      render(<CommentForm targetType="post" targetId="post-1" onCancel={mockOnCancel} />)

      const cancelButton = screen.getByText("取消")
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })
})
