/**
 * TagDialog 组件单元测试
 * Phase 10 - M2 阶段
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TagDialog, type TagDialogProps } from "@/components/admin/tag-dialog"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const createMockTag = () => ({
  id: "tag-1",
  name: "JavaScript",
  slug: "javascript",
  description: "JS",
  color: "#3b82f6",
  postsCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe("TagDialog", () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSuccess = vi.fn()
  const mockCreateTag = vi.fn()
  const mockUpdateTag = vi.fn()

  const renderComponent = (props?: Partial<TagDialogProps>) =>
    render(
      <TagDialog
        open
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
        createTagAction={mockCreateTag}
        updateTagAction={mockUpdateTag}
        {...props}
      />
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTag.mockResolvedValue({
      success: true,
      data: { tag: createMockTag() },
      meta: { timestamp: new Date().toISOString() },
    })
    mockUpdateTag.mockResolvedValue({
      success: true,
      data: { tag: createMockTag() },
      meta: { timestamp: new Date().toISOString() },
    })
  })

  describe("创建模式", () => {
    it("应该正确渲染创建对话框", () => {
      renderComponent()

      expect(screen.getByRole("heading", { name: "创建标签" })).toBeInTheDocument()
      expect(screen.getByText("创建一个新的标签来组织你的文章。")).toBeInTheDocument()
      expect(screen.getByLabelText(/标签名称/)).toBeInTheDocument()
      expect(screen.getByLabelText("描述")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "创建标签" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument()
    })

    it("应该在输入名称时自动生成 slug", async () => {
      const user = userEvent.setup()

      renderComponent()

      const nameInput = screen.getByLabelText(/标签名称/)
      await user.type(nameInput, "JavaScript")

      await waitFor(() => {
        expect(screen.getByText("javascript")).toBeInTheDocument()
      })
    })

    it("应该成功创建标签", async () => {
      const user = userEvent.setup()

      renderComponent()

      await user.type(screen.getByLabelText(/标签名称/), "JavaScript")
      await user.type(screen.getByLabelText("描述"), "JavaScript 相关文章")

      await user.click(screen.getByRole("button", { name: "创建标签" }))

      await waitFor(() => {
        expect(mockCreateTag).toHaveBeenCalledWith({
          name: "JavaScript",
          description: "JavaScript 相关文章",
          color: "#3b82f6",
        })
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })

    it("应该验证必填字段", async () => {
      const user = userEvent.setup()

      renderComponent()

      await user.click(screen.getByRole("button", { name: "创建标签" }))

      await waitFor(() => {
        expect(screen.getByText("标签名称不能为空")).toBeInTheDocument()
      })
    })

    it("应该验证名称长度", async () => {
      const user = userEvent.setup()

      renderComponent()

      const longName = "a".repeat(51)
      await user.type(screen.getByLabelText(/标签名称/), longName)
      await user.click(screen.getByRole("button", { name: "创建标签" }))

      await waitFor(() => {
        expect(screen.getByText("标签名称最多50个字符")).toBeInTheDocument()
      })
    })

    it("应该验证颜色格式", async () => {
      const user = userEvent.setup()

      renderComponent()

      await user.type(screen.getByLabelText(/标签名称/), "Test")

      const colorInputs = screen.getAllByRole("textbox")
      const colorTextInput = colorInputs.find(
        (input) => input.getAttribute("placeholder") === "#3b82f6"
      )
      if (colorTextInput) {
        await user.type(colorTextInput, "invalid-color")
      }

      await user.click(screen.getByRole("button", { name: "创建标签" }))

      await waitFor(() => {
        expect(screen.getByText("颜色格式必须为 #RRGGBB")).toBeInTheDocument()
      })
    })

    it("应该处理重复名称错误", async () => {
      const user = userEvent.setup()
      mockCreateTag.mockResolvedValueOnce({
        success: false,
        error: {
          code: "DUPLICATE_ENTRY",
          message: "标签名称已存在",
        },
        meta: { timestamp: new Date().toISOString() },
      })

      renderComponent()

      await user.type(screen.getByLabelText(/标签名称/), "JavaScript")
      await user.click(screen.getByRole("button", { name: "创建标签" }))

      await waitFor(() => {
        expect(screen.getByText("该标签名称已存在")).toBeInTheDocument()
      })
    })
  })

  describe("编辑模式", () => {
    const existingTag = {
      ...createMockTag(),
      id: "tag-2",
      name: "TypeScript",
      slug: "typescript",
      description: "TypeScript 相关文章",
    }

    it("应该渲染编辑模式", () => {
      renderComponent({ tag: existingTag })

      expect(screen.getByRole("heading", { name: "编辑标签" })).toBeInTheDocument()
      expect(screen.getByDisplayValue("TypeScript")).toBeInTheDocument()
    })

    it("应该成功更新标签", async () => {
      const user = userEvent.setup()

      renderComponent({ tag: existingTag })

      const nameInput = screen.getByLabelText(/标签名称/) as HTMLInputElement
      await user.clear(nameInput)
      await user.type(nameInput, "TypeScript Pro")

      await user.click(screen.getByRole("button", { name: "保存更改" }))

      await waitFor(() => {
        expect(mockUpdateTag).toHaveBeenCalledWith(existingTag.id, {
          name: "TypeScript Pro",
          description: existingTag.description,
          color: existingTag.color,
        })
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })

    it("应该处理更新失败错误", async () => {
      const user = userEvent.setup()
      mockUpdateTag.mockResolvedValueOnce({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "更新标签失败" },
        meta: { timestamp: new Date().toISOString() },
      })

      renderComponent({ tag: existingTag })

      await user.click(screen.getByRole("button", { name: "保存更改" }))

      await waitFor(() => {
        expect(mockUpdateTag).toHaveBeenCalled()
      })
    })
  })
})
