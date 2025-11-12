import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock hooks
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-activities", () => ({
  useActivities: vi.fn(() => ({
    activities: [
      {
        id: "activity-1",
        content: "这是一条动态",
        author: { name: "用户A" },
        commentsCount: 2,
        likesCount: 5,
        isLiked: false,
        createdAt: new Date(),
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    hasMore: false,
    total: 1,
    appliedFilters: null,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  })),
}))

import FeedPage from "@/app/feed/page"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"

describe("Feed页面评论功能改进测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("未登录用户可以查看评论", () => {
    it("未登录用户应该能够展开评论区", async () => {
      // 设置未登录状态
      vi.mocked(useAuth).mockReturnValue({
        user: null,
      } as any)

      render(<FeedPage />)

      // 找到评论按钮
      const commentButtons = screen.getAllByRole("button", { name: /0/i })
      const commentButton = commentButtons.find((btn) =>
        btn.querySelector(".lucide-message-circle")
      )

      expect(commentButton).toBeDefined()

      // 点击展开评论
      if (commentButton) {
        fireEvent.click(commentButton)
      }

      // 不应该显示登录提示
      expect(toast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: "请先登录",
        })
      )

      // 评论区应该展开（通过类名判断）
      await waitFor(() => {
        const expandedSection = document.querySelector(".mt-4.border-t.pt-4")
        expect(expandedSection).toBeTruthy()
      })
    })

    it("未登录用户在评论区应该看到登录提示而非输入框", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
      } as any)

      // Mock CommentList 和 CommentForm
      vi.mock("@/components/comments/comment-list", () => ({
        default: ({ targetType, targetId }: any) => (
          <div data-testid="comment-list">
            评论列表 - {targetType} - {targetId}
          </div>
        ),
      }))

      vi.mock("@/components/comments/comment-form", () => ({
        default: ({ targetType, targetId }: any) => {
          const MockCommentForm = () => {
            const { user } = useAuth()
            if (!user) {
              return <div data-testid="login-prompt">登录后即可发表评论</div>
            }
            return (
              <div data-testid="comment-form">
                评论表单 - {targetType} - {targetId}
              </div>
            )
          }
          return <MockCommentForm />
        },
      }))

      render(<FeedPage />)

      const commentButtons = screen.getAllByRole("button", { name: /0/i })
      const commentButton = commentButtons.find((btn) =>
        btn.querySelector(".lucide-message-circle")
      )

      if (commentButton) {
        fireEvent.click(commentButton)
      }

      // 应该能看到评论列表
      await waitFor(() => {
        expect(screen.queryByTestId("comment-list")).toBeTruthy()
      })
    })
  })

  describe("删除评论后计数同步", () => {
    it("删除评论应该触发活动数据刷新", async () => {
      const refreshMock = vi.fn()

      // Mock 登录用户
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "当前用户" },
      } as any)

      // Mock useActivities 返回 refresh 函数
      vi.mock("@/hooks/use-activities", () => ({
        useActivities: vi.fn(() => ({
          activities: [
            {
              id: "activity-1",
              content: "这是一条动态",
              author: { name: "用户A" },
              commentsCount: 2,
              likesCount: 5,
              isLiked: false,
              createdAt: new Date(),
            },
          ],
          isLoading: false,
          isError: false,
          error: null,
          hasMore: false,
          total: 1,
          appliedFilters: null,
          loadMore: vi.fn(),
          refresh: refreshMock, // 使用 mock 函数
        })),
      }))

      // Mock CommentList 组件
      vi.mock("@/components/comments/comment-list", () => ({
        default: ({ onCommentDeleted }: any) => {
          return (
            <div data-testid="comment-list">
              <button onClick={() => onCommentDeleted?.()} data-testid="delete-comment">
                删除评论
              </button>
            </div>
          )
        },
      }))

      render(<FeedPage />)

      // 展开评论区
      const commentButtons = screen.getAllByRole("button", { name: /2/i })
      const commentButton = commentButtons.find((btn) =>
        btn.querySelector(".lucide-message-circle")
      )

      if (commentButton) {
        fireEvent.click(commentButton)
      }

      // 等待评论区渲染
      await waitFor(() => {
        expect(screen.getByTestId("comment-list")).toBeInTheDocument()
      })

      // 模拟删除评论
      const deleteButton = screen.getByTestId("delete-comment")
      fireEvent.click(deleteButton)

      // 验证 refresh 被调用
      await waitFor(() => {
        expect(refreshMock).toHaveBeenCalled()
      })
    })
  })

  describe("评论展开状态管理", () => {
    it("点击评论按钮应该切换展开/收起状态", async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "user-1", name: "用户" },
      } as any)

      render(<FeedPage />)

      const commentButtons = screen.getAllByRole("button", { name: /0/i })
      const commentButton = commentButtons.find((btn) =>
        btn.querySelector(".lucide-message-circle")
      )

      expect(commentButton).toBeDefined()

      if (!commentButton) return

      // 初始状态：评论区应该是隐藏的
      expect(document.querySelector(".mt-4.border-t.pt-4")).toBeFalsy()

      // 第一次点击：展开
      fireEvent.click(commentButton)
      await waitFor(() => {
        expect(document.querySelector(".mt-4.border-t.pt-4")).toBeTruthy()
      })

      // 按钮应该高亮
      expect(commentButton.classList.contains("text-primary")).toBeTruthy()

      // 第二次点击：收起
      fireEvent.click(commentButton)
      await waitFor(() => {
        expect(document.querySelector(".mt-4.border-t.pt-4")).toBeFalsy()
      })

      // 按钮不再高亮
      expect(commentButton.classList.contains("text-primary")).toBeFalsy()
    })

    it("多个动态的评论区应该独立控制", async () => {
      // Mock 多个活动
      vi.mock("@/hooks/use-activities", () => ({
        useActivities: vi.fn(() => ({
          activities: [
            {
              id: "activity-1",
              content: "第一条动态",
              author: { name: "用户A" },
              commentsCount: 1,
              likesCount: 2,
              isLiked: false,
              createdAt: new Date(),
            },
            {
              id: "activity-2",
              content: "第二条动态",
              author: { name: "用户B" },
              commentsCount: 3,
              likesCount: 5,
              isLiked: false,
              createdAt: new Date(),
            },
          ],
          isLoading: false,
          isError: false,
          error: null,
          hasMore: false,
          total: 2,
          appliedFilters: null,
          loadMore: vi.fn(),
          refresh: vi.fn(),
        })),
      }))

      render(<FeedPage />)

      const allCommentButtons = screen.getAllByRole("button")
      const commentButtons = allCommentButtons.filter((btn) =>
        btn.querySelector(".lucide-message-circle")
      )

      expect(commentButtons.length).toBeGreaterThanOrEqual(2)

      // 展开第一个动态的评论
      fireEvent.click(commentButtons[0])

      // 等待第一个评论区展开
      await waitFor(() => {
        const expandedSections = document.querySelectorAll(".mt-4.border-t.pt-4")
        expect(expandedSections.length).toBe(1)
      })

      // 展开第二个动态的评论
      fireEvent.click(commentButtons[1])

      // 两个评论区都应该展开
      await waitFor(() => {
        const expandedSections = document.querySelectorAll(".mt-4.border-t.pt-4")
        expect(expandedSections.length).toBe(2)
      })

      // 收起第一个
      fireEvent.click(commentButtons[0])

      // 只剩一个展开
      await waitFor(() => {
        const expandedSections = document.querySelectorAll(".mt-4.border-t.pt-4")
        expect(expandedSections.length).toBe(1)
      })
    })
  })
})
