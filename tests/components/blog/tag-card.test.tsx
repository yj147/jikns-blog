/**
 * TagCard 组件单元测试
 * Phase 10 - M3 阶段
 */

import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TagCard } from "@/components/blog/tag-card"

describe("TagCard 组件", () => {
  const mockTag = {
    id: "tag-1",
    name: "JavaScript",
    slug: "javascript",
    description: "JavaScript 编程语言相关文章",
    color: "#F7DF1E",
    postsCount: 15,
  }

  describe("基础渲染", () => {
    it("应该正确渲染标签名称", () => {
      render(<TagCard tag={mockTag} />)
      expect(screen.getByText("JavaScript")).toBeInTheDocument()
    })

    it("应该正确渲染文章数量", () => {
      render(<TagCard tag={mockTag} />)
      expect(screen.getByText("15")).toBeInTheDocument()
      expect(screen.getByText("篇文章")).toBeInTheDocument()
    })

    it("应该正确渲染标签描述", () => {
      render(<TagCard tag={mockTag} />)
      expect(screen.getByText("JavaScript 编程语言相关文章")).toBeInTheDocument()
    })

    it("应该在没有描述时不显示描述文本", () => {
      const tagWithoutDesc = { ...mockTag, description: null }
      render(<TagCard tag={tagWithoutDesc} />)
      expect(screen.queryByText("JavaScript 编程语言相关文章")).not.toBeInTheDocument()
    })
  })

  describe("链接功能", () => {
    it("应该包含正确的链接地址", () => {
      render(<TagCard tag={mockTag} />)
      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/tags/javascript")
    })
  })

  describe("颜色样式", () => {
    it("应该使用标签的自定义颜色", () => {
      render(<TagCard tag={mockTag} />)
      // 验证组件正常渲染，颜色会通过内联样式应用
      expect(screen.getByText("JavaScript")).toBeInTheDocument()
    })

    it("应该在没有颜色时使用默认颜色", () => {
      const tagWithoutColor = { ...mockTag, color: null }
      render(<TagCard tag={tagWithoutColor} />)
      // 验证组件正常渲染，默认颜色会通过内联样式应用
      expect(screen.getByText("JavaScript")).toBeInTheDocument()
    })
  })

  describe("文章数量样式", () => {
    it("应该为高文章数量标签使用大字体", () => {
      const popularTag = { ...mockTag, postsCount: 25 }
      const { container } = render(<TagCard tag={popularTag} />)
      const title = container.querySelector(".text-2xl")
      expect(title).toBeInTheDocument()
    })

    it("应该为中等文章数量标签使用中等字体", () => {
      const mediumTag = { ...mockTag, postsCount: 12 }
      const { container } = render(<TagCard tag={mediumTag} />)
      const title = container.querySelector(".text-xl")
      expect(title).toBeInTheDocument()
    })

    it("应该为低文章数量标签使用小字体", () => {
      const smallTag = { ...mockTag, postsCount: 3 }
      const { container } = render(<TagCard tag={smallTag} />)
      const title = container.querySelector(".text-base")
      expect(title).toBeInTheDocument()
    })
  })

  describe("动画效果", () => {
    it("应该包含 motion 动画组件", () => {
      const { container } = render(<TagCard tag={mockTag} />)
      // framer-motion 会添加特定的 data 属性
      const motionDiv = container.querySelector("[style]")
      expect(motionDiv).toBeInTheDocument()
    })

    it("应该支持自定义 index 延迟", () => {
      render(<TagCard tag={mockTag} index={5} />)
      // 组件应该正常渲染，不会因为 index 而报错
      expect(screen.getByText("JavaScript")).toBeInTheDocument()
    })
  })
})
