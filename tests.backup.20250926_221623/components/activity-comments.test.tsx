/**
 * 动态评论功能集成测试
 * 测试评论展开/收起、登录状态、乐观更新等
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { act } from "react"
import CommentList from "@/components/comments/comment-list"
import CommentForm from "@/components/comments/comment-form"

// Mock hooks
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}))

// Mock SWR
vi.mock("swr", () => {
  const actualSWR = vi.importActual("swr")
  return {
    ...actualSWR,
    default: vi.fn(),
    mutate: vi.fn(),
  }
})

import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import useSWR, { mutate as swrMutate } from "swr"

describe("动态评论功能测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: null } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("评论列表展示", () => {
    it("应该正确显示动态的评论列表", () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "这是第一条评论",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          author: {
            id: "user-1",
            name: "用户A",
            email: "userA@example.com",
            avatarUrl: null,
          },
          replies: [],
        },
        {
          id: "comment-2",
          content: "这是第二条评论",
          createdAt: "2024-01-02T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
          author: {
            id: "user-2",
            name: "用户B",
            email: "userB@example.com",
            avatarUrl: null,
          },
          replies: [],
        },
      ]

      vi.mocked(useSWR).mockReturnValue({
        data: { success: true, data: mockComments },
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      } as any)

      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      const onDeleted = vi.fn()

      render(
        <CommentList targetType="activity" targetId="activity-1" onCommentDeleted={onDeleted} />
      )

      expect(screen.getByText("这是第一条评论")).toBeInTheDocument()
      expect(screen.getByText("这是第二条评论")).toBeInTheDocument()
      expect(screen.getByText("用户A")).toBeInTheDocument()
      expect(screen.getByText("用户B")).toBeInTheDocument()
    })

    it("应该在无评论时显示空状态", () => {
      vi.mocked(useSWR).mockReturnValue({
        data: { success: true, data: [] },
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      } as any)

      vi.mocked(useAuth).mockReturnValue({
        user: null,
      } as any)

      const onDeleted = vi.fn()

      render(
        <CommentList targetType="activity" targetId="activity-1" onCommentDeleted={onDeleted} />
      )

      expect(screen.getByText("暂无评论，快来发表第一条评论吧！")).toBeInTheDocument()
    })

    it("应该在加载时显示骨架屏", () => {
      vi.mocked(useSWR).mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        mutate: vi.fn(),
      } as any)

      const onDeleted = vi.fn()

      render(
        <CommentList targetType="activity" targetId="activity-1" onCommentDeleted={onDeleted} />
      )

      const skeleton = screen.getByTestId("loading-skeleton")
      expect(skeleton).toBeInTheDocument()
      expect(skeleton.querySelector(".animate-pulse")).toBeInTheDocument()
    })
  })

  describe("评论表单交互", () => {
    it("应该在未登录时显示登录提示", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
      } as any)

      render(<CommentForm targetType="activity" targetId="activity-1" />)

      expect(screen.getByText("登录后即可发表评论")).toBeInTheDocument()
      expect(screen.getByText("立即登录")).toBeInTheDocument()
    })

    it("应该在登录后显示评论输入框", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      render(
        <CommentForm targetType="activity" targetId="activity-1" placeholder="分享你的想法..." />
      )

      const textarea = screen.getByPlaceholderText("分享你的想法...")
      expect(textarea).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /发表/i })).toBeInTheDocument()
    })

    it("应该处理评论提交", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      // Mock fetch for CSRF token
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "new-comment" } }),
      } as any)

      const onSuccess = vi.fn()

      render(<CommentForm targetType="activity" targetId="activity-1" onSuccess={onSuccess} />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      const submitButton = screen.getByRole("button", { name: /发表/i })

      // 输入评论内容
      fireEvent.change(textarea, { target: { value: "测试评论" } })

      // 提交评论
      await act(async () => {
        fireEvent.click(submitButton)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/comments",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              content: "测试评论",
              targetType: "activity",
              targetId: "activity-1",
              parentId: undefined,
            }),
          })
        )
      })
    })

    it("应该限制评论长度", () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      render(<CommentForm targetType="activity" targetId="activity-1" />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      const longText = "a".repeat(1001) // 超过1000字符限制

      fireEvent.change(textarea, { target: { value: longText } })

      // 显示字符计数
      expect(screen.getByText(/1001 \/ 1000/)).toBeInTheDocument()

      // 提交按钮应该被禁用
      const submitButton = screen.getByRole("button", { name: /发表/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe("评论展开/收起功能", () => {
    it("应该支持展开和收起回复", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "主评论",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          author: {
            id: "user-1",
            name: "用户A",
            email: "userA@example.com",
            avatarUrl: null,
          },
          replies: [
            {
              id: "reply-1",
              content: "这是一条回复",
              createdAt: "2024-01-01T01:00:00Z",
              updatedAt: "2024-01-01T01:00:00Z",
              author: {
                id: "user-2",
                name: "用户B",
                email: "userB@example.com",
                avatarUrl: null,
              },
            },
          ],
        },
      ]

      vi.mocked(useSWR).mockReturnValue({
        data: { success: true, data: mockComments },
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      } as any)

      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      render(<CommentList targetType="activity" targetId="activity-1" />)

      // 初始状态下回复应该是隐藏的
      expect(screen.queryByText("这是一条回复")).not.toBeInTheDocument()

      // 点击展开回复
      const expandButton = screen.getByText(/展开 1 条回复/)
      fireEvent.click(expandButton)

      // 回复应该显示
      await waitFor(() => {
        expect(screen.getByText("这是一条回复")).toBeInTheDocument()
      })

      // 按钮文本应该变为收起
      expect(screen.getByText(/收起 1 条回复/)).toBeInTheDocument()

      // 再次点击收起
      fireEvent.click(screen.getByText(/收起 1 条回复/))

      // 回复应该隐藏
      await waitFor(() => {
        expect(screen.queryByText("这是一条回复")).not.toBeInTheDocument()
      })
    })
  })

  describe("评论删除功能", () => {
    it("应该允许作者删除自己的评论", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "我的评论",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          author: {
            id: "user-1",
            name: "当前用户",
            email: "user@example.com",
            avatarUrl: null,
          },
          replies: [],
        },
      ]

      vi.mocked(useSWR).mockReturnValue({
        data: { success: true, data: mockComments },
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      } as any)

      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      // Mock delete request
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ success: true }),
      } as any)

      const onDeleted = vi.fn()

      render(
        <CommentList targetType="activity" targetId="activity-1" onCommentDeleted={onDeleted} />
      )

      // 找到删除按钮（通过 aria-label）
      const deleteButton = screen.getByLabelText("删除")
      expect(deleteButton).toBeInTheDocument()

      // 点击删除
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/comments/comment-1",
          expect.objectContaining({
            method: "DELETE",
          })
        )
      })

      // 应该触发外部同步
      await waitFor(() => {
        expect(onDeleted).toHaveBeenCalled()
      })
    })

    it("不应该显示其他用户评论的删除按钮", () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "别人的评论",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          author: {
            id: "user-2",
            name: "其他用户",
            email: "other@example.com",
            avatarUrl: null,
          },
          replies: [],
        },
      ]

      vi.mocked(useSWR).mockReturnValue({
        data: { success: true, data: mockComments },
        error: null,
        isLoading: false,
        mutate: vi.fn(),
      } as any)

      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      render(<CommentList targetType="activity" targetId="activity-1" />)

      // 不应该有删除按钮
      expect(screen.queryByLabelText("删除")).not.toBeInTheDocument()
    })
  })

  describe("错误处理", () => {
    it("应该处理加载失败的情况", () => {
      vi.mocked(useSWR).mockReturnValue({
        data: null,
        error: new Error("加载失败"),
        isLoading: false,
        mutate: vi.fn(),
      } as any)

      render(<CommentList targetType="activity" targetId="activity-1" />)

      expect(screen.getByText("加载评论失败")).toBeInTheDocument()
    })

    it("应该处理评论提交失败", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      // Mock failed request
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("网络错误"))

      const toastMock = vi.mocked(toast)

      render(<CommentForm targetType="activity" targetId="activity-1" />)

      const textarea = screen.getByPlaceholderText("写下你的评论...")
      const submitButton = screen.getByRole("button", { name: /发表/i })

      fireEvent.change(textarea, { target: { value: "测试评论" } })

      await act(async () => {
        fireEvent.click(submitButton)
      })

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "网络错误",
            variant: "destructive",
          })
        )
      })
    })
  })
})
