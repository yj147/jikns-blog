/**
 * TagFilter 组件单元测试
 * Phase 10 - M3 阶段
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagFilter } from "@/components/blog/tag-filter"
import * as tagsActions from "@/lib/actions/tags"
import { useRouter, useSearchParams } from "next/navigation"

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

// Mock tags actions
vi.mock("@/lib/actions/tags", () => ({
  getPopularTags: vi.fn(),
}))

describe("TagFilter 组件", () => {
  const mockPush = vi.fn()
  const mockSearchParams = new URLSearchParams()

  const mockTags = [
    {
      id: "tag-1",
      name: "JavaScript",
      slug: "javascript",
      color: "#F7DF1E",
      postsCount: 25,
    },
    {
      id: "tag-2",
      name: "TypeScript",
      slug: "typescript",
      color: "#3178C6",
      postsCount: 18,
    },
    {
      id: "tag-3",
      name: "React",
      slug: "react",
      color: "#61DAFB",
      postsCount: 30,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as any)
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams as any)
  })

  describe("加载状态", () => {
    it("应该在加载时显示加载指示器", () => {
      vi.mocked(tagsActions.getPopularTags).mockImplementation(
        () => new Promise(() => {}) // 永不 resolve，保持加载状态
      )

      render(<TagFilter />)
      expect(screen.getByText("热门标签")).toBeInTheDocument()
      // 查找 Loader2 图标（通过 animate-spin 类）
      const loader = document.querySelector(".animate-spin")
      expect(loader).toBeInTheDocument()
    })
  })

  describe("成功加载标签", () => {
    beforeEach(() => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })
    })

    it("应该正确渲染热门标签列表", async () => {
      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
        expect(screen.getByText("TypeScript")).toBeInTheDocument()
        expect(screen.getByText("React")).toBeInTheDocument()
      })
    })

    it("应该显示每个标签的文章数量", async () => {
      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("(25)")).toBeInTheDocument()
        expect(screen.getByText("(18)")).toBeInTheDocument()
        expect(screen.getByText("(30)")).toBeInTheDocument()
      })
    })

    it("应该显示查看所有标签链接", async () => {
      render(<TagFilter />)

      await waitFor(() => {
        const link = screen.getByText("查看所有标签 →")
        expect(link).toBeInTheDocument()
        expect(link.closest("a")).toHaveAttribute("href", "/tags")
      })
    })
  })

  describe("标签选择功能", () => {
    beforeEach(() => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })
    })

    it("应该在点击标签时更新 URL", async () => {
      const user = userEvent.setup()
      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
      })

      await user.click(screen.getByText("JavaScript"))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/blog?tag=javascript")
      })
    })

    it("应该在选择新的标签时替换旧的选中项", async () => {
      const user = userEvent.setup()
      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
      })

      await user.click(screen.getByText("JavaScript"))
      await user.click(screen.getByText("TypeScript"))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/blog?tag=typescript")
      })
    })

    it("应该在再次点击已选中标签时取消选择", async () => {
      const user = userEvent.setup()
      const searchParamsWithTag = new URLSearchParams("tag=javascript")
      vi.mocked(useSearchParams).mockReturnValue(searchParamsWithTag as any)

      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
      })

      await user.click(screen.getByText("JavaScript"))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/blog")
      })
    })

    it("应该显示清除按钮当有选中标签时", async () => {
      const searchParamsWithTag = new URLSearchParams("tag=javascript")
      vi.mocked(useSearchParams).mockReturnValue(searchParamsWithTag as any)

      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("清除")).toBeInTheDocument()
      })
    })

    it("应该在点击清除按钮时清除所有筛选", async () => {
      const user = userEvent.setup()
      const searchParamsWithTag = new URLSearchParams("tag=javascript")
      vi.mocked(useSearchParams).mockReturnValue(searchParamsWithTag as any)

      render(<TagFilter />)

      await waitFor(() => {
        expect(screen.getByText("清除")).toBeInTheDocument()
      })

      await user.click(screen.getByText("清除"))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/blog")
      })
    })
  })

  describe("空状态处理", () => {
    it("应该在没有标签时不渲染组件", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      const { container } = render(<TagFilter />)

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })
  })

  describe("错误处理", () => {
    it("应该在加载失败时不渲染组件", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "加载失败",
        },
        meta: { timestamp: new Date().toISOString() },
      })

      const { container } = render(<TagFilter />)

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })
  })

  describe("自定义限制", () => {
    it("应该使用自定义的标签数量限制", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagFilter limit={5} />)

      await waitFor(() => {
        expect(tagsActions.getPopularTags).toHaveBeenCalledWith(5)
      })
    })
  })
})
