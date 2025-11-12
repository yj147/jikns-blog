/**
 * 标签增强功能集成测试
 * Phase 10 - M4 阶段
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagAutocomplete } from "@/components/admin/tag-autocomplete"
import { PopularTags } from "@/components/blog/popular-tags"
import * as tagsActions from "@/lib/actions/tags"

// Mock tags actions
vi.mock("@/lib/actions/tags", () => ({
  searchTags: vi.fn(),
  getPopularTags: vi.fn(),
}))

describe("TagAutocomplete 集成测试", () => {
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

  const mockOnTagsChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("输入触发搜索", () => {
    it("应该在输入时触发搜索", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "Java")

      await waitFor(() => {
        expect(tagsActions.searchTags).toHaveBeenCalledWith("Java")
      })
    })

    it("应该显示搜索结果", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "Java")

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
        expect(screen.getByText("TypeScript")).toBeInTheDocument()
      })
    })

    it("应该使用防抖优化搜索请求", async () => {
      const user = userEvent.setup({ delay: null })
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "JavaScript")

      // 防抖期间不应该调用多次
      await waitFor(
        () => {
          expect(tagsActions.searchTags).toHaveBeenCalledTimes(1)
        },
        { timeout: 500 }
      )
    })
  })

  describe("选择建议标签", () => {
    it("应该在点击建议标签时添加到已选列表", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "Java")

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
      })

      await user.click(screen.getByText("JavaScript"))

      expect(mockOnTagsChange).toHaveBeenCalledWith([mockTags[0]])
    })

    it("应该在选择标签后清空输入框", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入") as HTMLInputElement
      await user.type(input, "Java")

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
      })

      await user.click(screen.getByText("JavaScript"))

      await waitFor(() => {
        expect(input.value).toBe("")
      })
    })
  })

  describe("创建新标签", () => {
    it("应该在没有匹配结果时显示创建新标签选项", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "NewTag")

      await waitFor(() => {
        expect(screen.getByText(/创建新标签/)).toBeInTheDocument()
      })
    })

    it("应该在点击创建新标签时添加到已选列表", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "NewTag")

      await waitFor(() => {
        expect(screen.getByText(/创建新标签/)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/创建新标签/))

      expect(mockOnTagsChange).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "NewTag",
          slug: "newtag",
        }),
      ])
    })
  })

  describe("编辑模式去重", () => {
    it("应该隐藏与已选标签 slug 相同的建议项", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      const existingTags = [
        {
          id: "existing-javascript-0",
          name: "JavaScript",
          slug: "javascript",
          color: null,
        },
      ]

      render(<TagAutocomplete selectedTags={existingTags} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "Java")

      await waitFor(() => {
        expect(screen.queryByRole("option", { name: /JavaScript/ })).not.toBeInTheDocument()
        expect(screen.getByRole("option", { name: /TypeScript/ })).toBeInTheDocument()
      })
    })

    it("应该阻止通过创建新标签重复添加 slug", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      const existingTags = [
        {
          id: "existing-ai-0",
          name: "AI",
          slug: "ai",
          color: null,
        },
      ]

      render(<TagAutocomplete selectedTags={existingTags} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "AI")

      await waitFor(() => {
        expect(screen.getByText(/创建新标签/)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/创建新标签/))

      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })
  })

  describe("防止重复标签", () => {
    it("应该过滤掉已选中的标签", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[mockTags[0]]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "Java")

      await waitFor(() => {
        // 检查下拉列表中不包含已选中的标签
        const dropdown = screen.queryByRole("listbox")
        if (dropdown) {
          const { queryByText } = within(dropdown)
          expect(queryByText("JavaScript")).not.toBeInTheDocument()
        }
        // 验证其他标签仍然显示
        expect(screen.getByText("TypeScript")).toBeInTheDocument()
      })
    })

    it("应该在达到最大标签数时禁用输入", () => {
      const maxTags = 3
      const selectedTags = mockTags.slice(0, maxTags)

      render(
        <TagAutocomplete
          selectedTags={selectedTags}
          onTagsChange={mockOnTagsChange}
          maxTags={maxTags}
        />
      )

      const input = screen.getByLabelText("标签输入") as HTMLInputElement
      expect(input).toBeDisabled()
    })
  })

  describe("键盘导航", () => {
    it("应该支持 ESC 键关闭下拉", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: mockTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "Java")

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
      })

      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(screen.queryByText("JavaScript")).not.toBeInTheDocument()
      })
    })

    it("应该支持 Enter 键创建新标签", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "NewTag{Enter}")

      await waitFor(() => {
        expect(mockOnTagsChange).toHaveBeenCalledWith([
          expect.objectContaining({
            name: "NewTag",
          }),
        ])
      })
    })

    it("应该在输入非法字符时提示错误并阻止创建", async () => {
      const user = userEvent.setup()
      vi.mocked(tagsActions.searchTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<TagAutocomplete selectedTags={[]} onTagsChange={mockOnTagsChange} />)

      const input = screen.getByLabelText("标签输入")
      await user.type(input, "#AI")

      await waitFor(() => {
        expect(
          screen.getByText("标签名称只能包含字母、数字、中文、空格、连字符、下划线和点")
        ).toBeInTheDocument()
      })

      await user.keyboard("{Enter}")

      expect(mockOnTagsChange).not.toHaveBeenCalled()
      expect(tagsActions.searchTags).not.toHaveBeenCalled()
    })
  })

  describe("移除标签", () => {
    it("应该在点击移除按钮时删除标签", async () => {
      const user = userEvent.setup()

      render(<TagAutocomplete selectedTags={[mockTags[0]]} onTagsChange={mockOnTagsChange} />)

      const removeButton = screen.getByLabelText(`移除标签 ${mockTags[0].name}`)
      await user.click(removeButton)

      expect(mockOnTagsChange).toHaveBeenCalledWith([])
    })
  })
})

describe("PopularTags 集成测试", () => {
  const mockPopularTags = [
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
  })

  describe("组件渲染", () => {
    it("应该正确渲染热门标签列表", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<PopularTags />)

      await waitFor(() => {
        expect(screen.getByText("JavaScript")).toBeInTheDocument()
        expect(screen.getByText("TypeScript")).toBeInTheDocument()
        expect(screen.getByText("React")).toBeInTheDocument()
      })
    })

    it("应该显示标题", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<PopularTags showTitle={true} />)

      await waitFor(() => {
        expect(screen.getByText("热门标签")).toBeInTheDocument()
      })
    })

    it("应该在加载时显示加载指示器", () => {
      vi.mocked(tagsActions.getPopularTags).mockImplementation(
        () => new Promise(() => {}) // 永不 resolve
      )

      render(<PopularTags />)

      expect(screen.getByText("热门标签")).toBeInTheDocument()
      const loader = document.querySelector(".animate-spin")
      expect(loader).toBeInTheDocument()
    })

    it("应该在没有标签时不渲染组件", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: [] },
        meta: { timestamp: new Date().toISOString() },
      })

      const { container } = render(<PopularTags />)

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })
  })

  describe("数据获取", () => {
    it("应该使用指定的限制数量获取标签", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<PopularTags limit={5} />)

      await waitFor(() => {
        expect(tagsActions.getPopularTags).toHaveBeenCalledWith(5)
      })
    })

    it("应该显示每个标签的文章数量", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<PopularTags />)

      await waitFor(() => {
        expect(screen.getByText("(25)")).toBeInTheDocument()
        expect(screen.getByText("(18)")).toBeInTheDocument()
        expect(screen.getByText("(30)")).toBeInTheDocument()
      })
    })
  })

  describe("点击跳转", () => {
    it("应该包含正确的链接地址", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      render(<PopularTags />)

      await waitFor(() => {
        const jsLink = screen.getByText("JavaScript").closest("a")
        expect(jsLink).toHaveAttribute("href", "/tags/javascript")

        const tsLink = screen.getByText("TypeScript").closest("a")
        expect(tsLink).toHaveAttribute("href", "/tags/typescript")
      })
    })
  })

  describe("布局模式", () => {
    it("应该支持网格布局", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      const { container } = render(<PopularTags layout="grid" />)

      await waitFor(() => {
        const gridContainer = container.querySelector(".flex-wrap")
        expect(gridContainer).toBeInTheDocument()
      })
    })

    it("应该支持横向滚动布局", async () => {
      vi.mocked(tagsActions.getPopularTags).mockResolvedValue({
        success: true,
        data: { tags: mockPopularTags },
        meta: { timestamp: new Date().toISOString() },
      })

      const { container } = render(<PopularTags layout="horizontal" />)

      await waitFor(() => {
        const scrollContainer = container.querySelector(".overflow-x-auto")
        expect(scrollContainer).toBeInTheDocument()
      })
    })
  })
})
