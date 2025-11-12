import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import CommentList from "@/components/comments/comment-list"

const mockUseSWRInfinite = vi.fn()
const mockFetchDelete = vi.fn()
const mockFetchGet = vi.fn()
const mockToast = vi.fn()
const mockUseAuth = vi.fn(() => ({ user: { id: "user-1", role: "USER" } }))

vi.mock("swr/infinite", () => ({
  __esModule: true,
  default: (...args: any[]) => mockUseSWRInfinite(...args),
}))

vi.mock("@/lib/api/fetch-json", () => ({
  fetchDelete: (...args: any[]) => mockFetchDelete(...args),
  fetchGet: (...args: any[]) => mockFetchGet(...args),
  FetchError: class extends Error {},
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: any[]) => mockToast(...args),
}))

vi.mock("@/components/comments/comment-form", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`comment-form-${props.parentId ?? "root"}`}>
      <button
        type="button"
        data-testid={`comment-form-submit-${props.parentId ?? "root"}`}
        onClick={() => props.onSuccess?.({ parentId: props.parentId ?? null })}
      >
        mock-submit
      </button>
    </div>
  ),
}))

describe("CommentList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSWRInfinite.mockReset()
    mockFetchGet.mockReset()
    mockFetchDelete.mockReset()
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({ user: { id: "user-1", role: "USER" } })
  })

  it("renders loading skeleton during initial fetch", () => {
    mockUseSWRInfinite.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<CommentList targetType="post" targetId="post-1" />)
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument()
  })

  it("shows empty state when no comments", () => {
    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: [],
          meta: { pagination: { hasMore: false, nextCursor: null } },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<CommentList targetType="post" targetId="post-1" />)
    expect(screen.getByText("暂无评论，快来抢沙发吧！")).toBeInTheDocument()
  })

  it("renders comments and load more button when hasMore is true", () => {
    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: [
            {
              id: "comment-1",
              content: "第一条评论",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              isDeleted: false,
              authorId: "user-1",
              targetType: "post",
              targetId: "post-1",
              author: {
                id: "user-1",
                name: "作者",
                email: "a@test.com",
                avatarUrl: null,
                role: "USER",
              },
              _count: { replies: 0 },
            },
          ],
          meta: { pagination: { hasMore: true, nextCursor: "cursor-123" } },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<CommentList targetType="post" targetId="post-1" />)

    expect(screen.getByText("第一条评论")).toBeInTheDocument()
    expect(screen.getByText("加载更多")).toBeInTheDocument()
  })

  it("renders delete button for admin on another user's comment", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-user", role: "ADMIN" } })

    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: [
            {
              id: "comment-1",
              content: "普通评论",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              isDeleted: false,
              authorId: "other-user",
              targetType: "post",
              targetId: "post-1",
              author: {
                id: "other-user",
                name: "Other",
                email: "other@test.com",
                avatarUrl: null,
                role: "USER",
              },
              _count: { replies: 0 },
            },
          ],
          meta: { pagination: { hasMore: false, nextCursor: null } },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<CommentList targetType="post" targetId="post-1" />)

    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument()
  })

  it("loads replies when expanding", async () => {
    mockFetchGet.mockResolvedValue({
      success: true,
      data: [],
      meta: { pagination: { hasMore: false, nextCursor: null } },
    })
    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: [
            {
              id: "comment-1",
              content: "父级评论",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              isDeleted: false,
              authorId: "user-1",
              targetType: "post",
              targetId: "post-1",
              author: {
                id: "user-1",
                name: "作者",
                email: "a@test.com",
                avatarUrl: null,
                role: "USER",
              },
              _count: { replies: 2 },
            },
          ],
          meta: { pagination: { hasMore: false, nextCursor: null } },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<CommentList targetType="post" targetId="post-1" />)

    const toggle = screen.getByRole("button", { name: "展开 2 条回复" })
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockFetchGet).toHaveBeenCalledWith(expect.stringContaining("parentId=comment-1"))
    })
  })

  it("renders load more replies button when pagination reports more data", async () => {
    mockFetchGet
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: "reply-1",
            content: "first reply",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            isDeleted: false,
            authorId: "user-2",
            targetType: "post",
            targetId: "post-1",
            author: {
              id: "user-2",
              name: "B",
              email: "b@test.com",
              avatarUrl: null,
              role: "USER",
            },
            _count: { replies: 0 },
          },
        ],
        meta: { pagination: { hasMore: true, nextCursor: "cursor-2" } },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: "reply-2",
            content: "second reply",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            isDeleted: false,
            authorId: "user-3",
            targetType: "post",
            targetId: "post-1",
            author: {
              id: "user-3",
              name: "C",
              email: "c@test.com",
              avatarUrl: null,
              role: "USER",
            },
            _count: { replies: 0 },
          },
        ],
        meta: { pagination: { hasMore: false, nextCursor: null } },
      })

    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: [
            {
              id: "comment-1",
              content: "父级评论",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              isDeleted: false,
              authorId: "user-1",
              targetType: "post",
              targetId: "post-1",
              author: {
                id: "user-1",
                name: "作者",
                email: "a@test.com",
                avatarUrl: null,
                role: "USER",
              },
              _count: { replies: 3 },
            },
          ],
          meta: { pagination: { hasMore: false, nextCursor: null } },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<CommentList targetType="post" targetId="post-1" />)

    fireEvent.click(screen.getByRole("button", { name: "展开 3 条回复" }))

    await waitFor(() => {
      expect(screen.getByText("加载更多回复")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("加载更多回复"))

    await waitFor(() => {
      expect(mockFetchGet).toHaveBeenLastCalledWith(expect.stringContaining("cursor=cursor-2"))
    })
  })

  it("refetches replies after submitting a child comment", async () => {
    mockFetchGet
      .mockResolvedValueOnce({
        success: true,
        data: [],
        meta: { pagination: { hasMore: false, nextCursor: null } },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: "reply-1",
            content: "新的回复",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            isDeleted: false,
            authorId: "user-2",
            targetType: "post",
            targetId: "post-1",
            author: {
              id: "user-2",
              name: "B",
              email: "b@test.com",
              avatarUrl: null,
              role: "USER",
            },
            _count: { replies: 0 },
          },
        ],
        meta: { pagination: { hasMore: false, nextCursor: null } },
      })

    const mutate = vi.fn(() => Promise.resolve())

    mockUseSWRInfinite.mockReturnValue({
      data: [
        {
          data: [
            {
              id: "comment-1",
              content: "父级评论",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              author: { id: "user-1", name: "作者", email: "a@test.com", avatarUrl: null },
              _count: { replies: 1 },
            },
          ],
          meta: { pagination: { hasMore: false, nextCursor: null } },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate,
    })

    render(<CommentList targetType="post" targetId="post-1" />)

    fireEvent.click(screen.getByRole("button", { name: "展开 1 条回复" }))

    await waitFor(() => {
      expect(mockFetchGet).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: "回复" }))

    fireEvent.click(screen.getByTestId("comment-form-submit-comment-1"))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled()
      expect(mockFetchGet).toHaveBeenCalledTimes(2)
    })
  })
})
