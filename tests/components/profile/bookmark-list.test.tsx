/**
 * 收藏列表组件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BookmarkList } from "@/components/profile/bookmark-list"
import { fetchGet, fetchPost, FetchError } from "@/lib/api/fetch-json"
import type { BookmarkListItem } from "@/lib/interactions/bookmarks"

vi.mock("@/lib/api/fetch-json", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/fetch-json")>("@/lib/api/fetch-json")
  return {
    ...actual,
    fetchGet: vi.fn(),
    fetchPost: vi.fn(),
  }
})

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// Mock useToast
const mockToast = vi.fn()
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock 数据
const mockBookmarks: BookmarkListItem[] = [
  {
    id: "bookmark-1",
    createdAt: "2024-01-15T10:00:00Z",
    post: {
      id: "post-1",
      slug: "test-post-1",
      title: "测试文章 1",
      coverImage: "/test-image-1.jpg",
      author: {
        id: "author-1",
        name: "作者 1",
        avatarUrl: "/avatar-1.jpg",
      },
    },
  },
  {
    id: "bookmark-2",
    createdAt: "2024-01-14T10:00:00Z",
    post: {
      id: "post-2",
      slug: "test-post-2",
      title: "测试文章 2",
      coverImage: null,
      author: {
        id: "author-2",
        name: null,
        avatarUrl: null,
      },
    },
  },
]

const fetchGetMock = vi.mocked(fetchGet)
const fetchPostMock = vi.mocked(fetchPost)

describe("BookmarkList 组件", () => {
  const mockUserId = "test-user-id"

  beforeEach(() => {
    fetchGetMock.mockReset()
    fetchPostMock.mockReset()
    mockToast.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("初始渲染", () => {
    it("应该正确渲染收藏列表", () => {
      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      // 检查文章标题
      expect(screen.getByText("测试文章 1")).toBeInTheDocument()
      expect(screen.getByText("测试文章 2")).toBeInTheDocument()

      // 检查作者名称
      expect(screen.getByText("作者 1")).toBeInTheDocument()
      expect(screen.getByText("匿名用户")).toBeInTheDocument() // 第二个作者为 null

      // 检查取消收藏按钮
      const unbookmarkButtons = screen.getAllByText("取消收藏")
      expect(unbookmarkButtons).toHaveLength(2)

      // 检查阅读文章链接
      const readLinks = screen.getAllByText(/阅读文章/)
      expect(readLinks).toHaveLength(2)
    })

    it("应该显示空态当没有收藏时", () => {
      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={[]}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      expect(screen.getByText("还没有收藏的文章")).toBeInTheDocument()
      expect(screen.getByText("您收藏的文章会在这里显示")).toBeInTheDocument()
      expect(screen.getByText("探索文章")).toBeInTheDocument()
    })

    it("应该显示加载更多按钮当有更多内容时", () => {
      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={true}
          initialCursor="next-cursor"
        />
      )

      expect(screen.getByText("加载更多")).toBeInTheDocument()
    })

    it("不应该显示加载更多按钮当没有更多内容时", () => {
      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      expect(screen.queryByText("加载更多")).not.toBeInTheDocument()
    })
  })

  describe("加载更多功能", () => {
    it("应该正确加载更多收藏并拼接到列表", async () => {
      const user = userEvent.setup()

      const moreBookmarks: BookmarkListItem[] = [
        {
          id: "bookmark-3",
          createdAt: "2024-01-13T10:00:00Z",
          post: {
            id: "post-3",
            slug: "test-post-3",
            title: "测试文章 3",
            coverImage: null,
            author: {
              id: "author-3",
              name: "作者 3",
              avatarUrl: null,
            },
          },
        },
      ]

      fetchGetMock.mockResolvedValueOnce({
        success: true,
        data: moreBookmarks,
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: -1,
            hasMore: false,
            nextCursor: null,
          },
        },
      })

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={true}
          initialCursor="cursor-2"
        />
      )

      const loadMoreButton = screen.getByText("加载更多")
      await user.click(loadMoreButton)

      await waitFor(() => {
        expect(screen.getByText("测试文章 3")).toBeInTheDocument()
      })

      // 验证请求参数
      expect(fetchGetMock).toHaveBeenCalledWith("/api/bookmarks", {
        action: "list",
        userId: mockUserId,
        cursor: "cursor-2",
        limit: 20,
      })

      // 验证所有文章都在列表中
      expect(screen.getByText("测试文章 1")).toBeInTheDocument()
      expect(screen.getByText("测试文章 2")).toBeInTheDocument()
      expect(screen.getByText("测试文章 3")).toBeInTheDocument()

      // 加载更多按钮应该消失（hasMore=false）
      expect(screen.queryByText("加载更多")).not.toBeInTheDocument()
    })

    it("应该正确传递 cursor 参数", async () => {
      const user = userEvent.setup()

      fetchGetMock.mockResolvedValueOnce({
        success: true,
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: -1,
            hasMore: true,
            nextCursor: "next-cursor-2",
          },
        },
      })

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={true}
          initialCursor="initial-cursor"
        />
      )

      const loadMoreButton = screen.getByText("加载更多")
      await user.click(loadMoreButton)

      expect(fetchGetMock).toHaveBeenCalledWith("/api/bookmarks", {
        action: "list",
        userId: mockUserId,
        cursor: "initial-cursor",
        limit: 20,
      })
    })

    it("应该处理加载更多时的错误", async () => {
      const user = userEvent.setup()

      fetchGetMock.mockRejectedValueOnce(new FetchError("服务器错误", 500))

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={true}
          initialCursor="cursor"
        />
      )

      const loadMoreButton = screen.getByText("加载更多")
      await user.click(loadMoreButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "加载失败",
          description: "无法加载更多收藏，请稍后重试",
          variant: "destructive",
        })
      })
    })

    it("应该处理加载更多时的401错误", async () => {
      const user = userEvent.setup()

      fetchGetMock.mockRejectedValueOnce(new FetchError("需要登录", 401))

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={true}
          initialCursor="cursor"
        />
      )

      const loadMoreButton = screen.getByText("加载更多")
      await user.click(loadMoreButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "请先登录",
          description: "您需要登录才能查看收藏列表",
          variant: "destructive",
        })
      })
    })
  })

  describe("取消收藏功能", () => {
    it("应该成功取消收藏并从列表移除", async () => {
      const user = userEvent.setup()

      fetchPostMock.mockResolvedValueOnce({
        success: true,
        data: {
          isBookmarked: false,
          count: 0,
        },
      })

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      // 确认文章在列表中
      expect(screen.getByText("测试文章 1")).toBeInTheDocument()

      // 点击第一个取消收藏按钮
      const unbookmarkButtons = screen.getAllByText("取消收藏")
      await user.click(unbookmarkButtons[0])

      // 验证请求
      expect(fetchPostMock).toHaveBeenCalledWith("/api/bookmarks", { postId: "post-1" })

      // 文章应该被移除（乐观更新）
      await waitFor(() => {
        expect(screen.queryByText("测试文章 1")).not.toBeInTheDocument()
      })

      // 应该显示成功提示
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "已取消收藏",
          description: "该文章已从您的收藏列表中移除",
        })
      })

      // 第二篇文章应该还在
      expect(screen.getByText("测试文章 2")).toBeInTheDocument()
    })

    it("应该在失败时回滚并提示错误", async () => {
      const user = userEvent.setup()

      fetchPostMock.mockRejectedValueOnce(new FetchError("服务器错误", 500))

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      // 点击取消收藏
      const unbookmarkButtons = screen.getAllByText("取消收藏")
      await user.click(unbookmarkButtons[0])

      // 文章应该仍然在列表中（回滚）
      await waitFor(() => {
        expect(screen.getByText("测试文章 1")).toBeInTheDocument()
      })

      // 应该显示错误提示
      expect(mockToast).toHaveBeenCalledWith({
        title: "操作失败",
        description: "无法取消收藏，请稍后重试",
        variant: "destructive",
      })
    })

    it("应该处理401未登录错误", async () => {
      const user = userEvent.setup()

      fetchPostMock.mockRejectedValueOnce(new FetchError("需要登录", 401))

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      const unbookmarkButtons = screen.getAllByText("取消收藏")
      await user.click(unbookmarkButtons[0])

      // 文章应该仍然在列表中（回滚）
      await waitFor(() => {
        expect(screen.getByText("测试文章 1")).toBeInTheDocument()
      })

      // 应该显示登录提示
      expect(mockToast).toHaveBeenCalledWith({
        title: "请先登录",
        description: "您需要登录才能取消收藏",
        variant: "destructive",
      })
    })

    it("应该在服务端返回仍为收藏状态时回滚", async () => {
      const user = userEvent.setup()

      fetchPostMock.mockResolvedValueOnce({
        success: true,
        data: {
          isBookmarked: true, // 仍然是收藏状态
          count: 1,
        },
      })

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={false}
          initialCursor={null}
        />
      )

      const unbookmarkButtons = screen.getAllByText("取消收藏")
      await user.click(unbookmarkButtons[0])

      // 文章应该仍然在列表中（回滚）
      await waitFor(() => {
        expect(screen.getByText("测试文章 1")).toBeInTheDocument()
      })
    })
  })

  describe("边界情况", () => {
    it("应该正确处理没有封面图的文章", () => {
      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={[mockBookmarks[1]]} // 第二个没有封面图
          initialHasMore={false}
          initialCursor={null}
        />
      )

      // 不应该有封面图元素（第二个文章的 coverImage 为 null）
      const images = screen.queryAllByRole("img")
      expect(images).toHaveLength(0) // 没有任何图片（头像使用 fallback 文字）

      // 但应该有文章标题
      expect(screen.getByText("测试文章 2")).toBeInTheDocument()
    })

    it("应该正确处理匿名作者", () => {
      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={[mockBookmarks[1]]} // 第二个作者为 null
          initialHasMore={false}
          initialCursor={null}
        />
      )

      expect(screen.getByText("匿名用户")).toBeInTheDocument()
    })

    it("应该防止在加载过程中重复点击", async () => {
      const user = userEvent.setup()

      // 模拟缓慢的网络请求
      fetchGetMock.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({
                success: true,
                data: [],
                meta: { pagination: { hasMore: false } },
              })
            }, 100)
          )
      )

      render(
        <BookmarkList
          userId={mockUserId}
          initialBookmarks={mockBookmarks}
          initialHasMore={true}
          initialCursor="cursor"
        />
      )

      const loadMoreButton = screen.getByText("加载更多")

      // 快速点击多次
      await user.click(loadMoreButton)
      await user.click(loadMoreButton)
      await user.click(loadMoreButton)

      // 应该只发送一次请求
      await waitFor(() => {
        expect(fetchGetMock).toHaveBeenCalledTimes(1)
      })
    })
  })
})
