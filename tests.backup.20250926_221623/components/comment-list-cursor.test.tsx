/**
 * 评论列表游标分页测试
 * 验证游标分页返回-1时的显示逻辑
 */

import { render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import { CommentList } from "@/components/comments/comment-list"
import useSWR from "swr"

// Mock SWR
vi.mock("swr")

// Mock auth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user123", name: "Test User" },
    session: { user: { id: "user123" } },
  }),
}))

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock CommentForm
vi.mock("@/components/comments/comment-form", () => ({
  CommentForm: () => null,
}))

// Mock individual comment items
vi.mock("@/components/comments/comment-item", () => ({
  CommentItem: ({ comment }: any) => <div>{comment.content}</div>,
}))

describe("CommentList - 游标分页显示", () => {
  it("游标分页返回-1时应显示实际评论数", async () => {
    // Mock SWR返回游标分页数据
    vi.mocked(useSWR).mockReturnValue({
      data: {
        data: [
          { id: "1", content: "评论1", author: { name: "用户1" } },
          { id: "2", content: "评论2", author: { name: "用户2" } },
          { id: "3", content: "评论3", author: { name: "用户3" } },
        ],
        meta: {
          pagination: {
            total: -1, // 游标分页返回-1
            hasMore: true,
            nextCursor: "next-cursor-123",
          },
        },
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as any)

    render(<CommentList targetType="activity" targetId="activity-123" />)

    await waitFor(() => {
      // 应该显示实际的评论数量(3)，而不是-1
      expect(screen.getByText("评论 (3)")).toBeInTheDocument()
    })

    // 验证评论内容也正确显示
    expect(screen.getByText("评论1")).toBeInTheDocument()
    expect(screen.getByText("评论2")).toBeInTheDocument()
    expect(screen.getByText("评论3")).toBeInTheDocument()
  })

  it("正常分页返回总数时应显示总数", async () => {
    // 重新mock返回正常的总数
    vi.mocked(useSWR).mockReturnValue({
      data: {
        data: [{ id: "1", content: "评论1", author: { name: "用户1" } }],
        meta: {
          pagination: {
            total: 100, // 正常的总数
            page: 1,
            limit: 20,
          },
        },
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as any)

    render(<CommentList targetType="post" targetId="post-123" />)

    await waitFor(() => {
      // 应该显示服务器返回的总数
      expect(screen.getByText("评论 (100)")).toBeInTheDocument()
    })
  })
})
