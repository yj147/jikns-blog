/**
 * 评论列表组件测试
 */

import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach } from "vitest"
import CommentList from "@/components/comments/comment-list"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

// Mock 依赖
vi.mock("@/hooks/use-auth")
vi.mock("@/hooks/use-toast")
vi.mock("swr", () => ({
  default: vi.fn(),
  mutate: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe("CommentList", () => {
  const mockUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "USER",
  }

  const mockComments = {
    success: true,
    data: [
      {
        id: "comment-1",
        content: "这是第一条评论",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          avatarUrl: null,
        },
        replies: [],
        parentId: null,
      },
      {
        id: "comment-2",
        content: "这是第二条评论",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: "user-2",
          name: "Another User",
          email: "another@example.com",
          avatarUrl: null,
        },
        replies: [
          {
            id: "comment-3",
            content: "这是一条回复",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              avatarUrl: null,
            },
            replies: [],
            parentId: "comment-2",
          },
        ],
        parentId: null,
      },
    ],
    meta: {
      pagination: {
        total: 2,
        hasMore: false,
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockComments,
    })
  })

  describe("加载状态", () => {
    it("应该显示加载状态", () => {
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: true,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument()
    })
  })

  describe("空状态", () => {
    it("当没有评论时应该显示空状态提示", () => {
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: { success: true, data: [], meta: { pagination: { total: 0, hasMore: false } } },
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByText("暂无评论，快来发表第一条评论吧！")).toBeInTheDocument()
    })
  })

  describe("错误状态", () => {
    it("当加载失败时应该显示错误信息", () => {
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: undefined,
        error: new Error("加载失败"),
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByText("加载评论失败")).toBeInTheDocument()
    })
  })

  describe("评论展示", () => {
    it("应该正确显示评论列表", () => {
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByText("这是第一条评论")).toBeInTheDocument()
      expect(screen.getByText("这是第二条评论")).toBeInTheDocument()
      expect(screen.getByText("Test User")).toBeInTheDocument()
      expect(screen.getByText("Another User")).toBeInTheDocument()
    })

    it("应该显示评论总数", () => {
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByText("评论 (2)")).toBeInTheDocument()
    })
  })

  describe("用户交互", () => {
    it("登录用户应该能看到评论输入框", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByPlaceholderText("写下你的评论...")).toBeInTheDocument()
    })

    it("未登录用户应该看到登录提示", () => {
      ;(useAuth as any).mockReturnValue({ user: null })
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      expect(screen.getByText("登录后即可发表评论")).toBeInTheDocument()
      expect(screen.getByText("立即登录")).toBeInTheDocument()
    })

    it("用户应该能看到自己评论的删除按钮", () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      // 第一条评论是当前用户的，应该有删除按钮
      const deleteButtons = screen.getAllByLabelText("删除")
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it("点击回复按钮应该显示回复输入框", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      const replyButtons = screen.getAllByText("回复")
      fireEvent.click(replyButtons[0])

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/回复.*Test User/)).toBeInTheDocument()
      })
    })
  })

  describe("删除功能", () => {
    it("删除成功应该显示成功提示", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const mockToast = vi.fn()
      ;(toast as any).mockImplementation(mockToast)

      const useSWR = require("swr").default
      const mutate = require("swr").mutate
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      const deleteButtons = screen.getAllByLabelText("删除")

      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "删除成功",
        })
        expect(mutate).toHaveBeenCalled()
      })
    })

    it("删除失败应该显示错误提示", async () => {
      ;(useAuth as any).mockReturnValue({ user: mockUser })
      const mockToast = vi.fn()
      ;(toast as any).mockImplementation(mockToast)

      const useSWR = require("swr").default
      useSWR.mockReturnValue({
        data: mockComments,
        error: undefined,
        isLoading: false,
      })
      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "权限不足" }),
      })

      render(<CommentList targetType="post" targetId="post-1" />)

      const deleteButtons = screen.getAllByLabelText("删除")

      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "权限不足或账号异常",
          variant: "destructive",
        })
      })
    })
  })
})
