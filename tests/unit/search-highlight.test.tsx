/**
 * 搜索高亮功能单元测试
 * 测试 highlightText 函数的多关键词高亮逻辑
 */

import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { SearchResultCard } from "@/components/search/search-result-card"
import type { SearchPostResult } from "@/lib/repos/search"

describe("搜索高亮功能", () => {
  const mockPost: SearchPostResult = {
    id: "post-1",
    slug: "test-post",
    title: "Next.js 全文搜索教程",
    excerpt: "这是一篇关于 Next.js 和 PostgreSQL 的教程",
    coverImage: null,
    published: true,
    publishedAt: new Date("2024-01-01"),
    viewCount: 100,
    createdAt: new Date("2024-01-01"),
    rank: 0.9,
    author: {
      id: "user-1",
      name: "测试用户",
      avatarUrl: null,
    },
    tags: [],
  }

  describe("多关键词高亮", () => {
    it("应该高亮多个关键词", () => {
      const { container } = render(
        <SearchResultCard type="post" data={mockPost} query="Next.js 教程" />
      )

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBeGreaterThan(0)

      // 验证 "Next.js" 和 "教程" 都被高亮
      const markedTexts = Array.from(marks).map((mark) => mark.textContent)
      expect(markedTexts).toContain("Next.js")
      expect(markedTexts).toContain("教程")
    })

    it("应该支持大小写不敏感匹配", () => {
      const { container } = render(
        <SearchResultCard type="post" data={mockPost} query="next.js POSTGRESQL" />
      )

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBeGreaterThan(0)

      // 验证原始大小写被保留
      const markedTexts = Array.from(marks).map((mark) => mark.textContent)
      expect(markedTexts.some((text) => text === "Next.js")).toBe(true)
      expect(markedTexts.some((text) => text === "PostgreSQL")).toBe(true)
    })

    it("应该处理单个关键词", () => {
      const { container } = render(<SearchResultCard type="post" data={mockPost} query="Next.js" />)

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBeGreaterThan(0)

      const markedTexts = Array.from(marks).map((mark) => mark.textContent)
      expect(markedTexts).toContain("Next.js")
    })

    it("应该处理空查询", () => {
      const { container } = render(<SearchResultCard type="post" data={mockPost} query="" />)

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBe(0)
    })

    it("应该过滤空关键词", () => {
      const { container } = render(
        <SearchResultCard type="post" data={mockPost} query="Next.js   教程" />
      )

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBeGreaterThan(0)

      // 多个空格应该被正确处理
      const markedTexts = Array.from(marks).map((mark) => mark.textContent)
      expect(markedTexts).toContain("Next.js")
      expect(markedTexts).toContain("教程")
    })

    it("应该处理特殊字符", () => {
      const postWithSpecialChars: SearchPostResult = {
        ...mockPost,
        title: "使用 React.useMemo 优化性能",
      }

      const { container } = render(
        <SearchResultCard type="post" data={postWithSpecialChars} query="React.useMemo 优化" />
      )

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBeGreaterThan(0)

      const markedTexts = Array.from(marks).map((mark) => mark.textContent)
      expect(markedTexts.some((text) => text.includes("React"))).toBe(true)
      expect(markedTexts).toContain("优化")
    })
  })

  describe("边界情况", () => {
    it("应该处理 null 文本", () => {
      const postWithNullExcerpt: SearchPostResult = {
        ...mockPost,
        excerpt: null,
      }

      const { container } = render(
        <SearchResultCard type="post" data={postWithNullExcerpt} query="test" />
      )

      // 不应该抛出错误
      expect(container).toBeTruthy()
    })

    it("应该处理空文本", () => {
      const postWithEmptyExcerpt: SearchPostResult = {
        ...mockPost,
        excerpt: "",
      }

      const { container } = render(
        <SearchResultCard type="post" data={postWithEmptyExcerpt} query="test" />
      )

      // 不应该抛出错误
      expect(container).toBeTruthy()
    })

    it("应该处理仅包含空格的查询", () => {
      const { container } = render(<SearchResultCard type="post" data={mockPost} query="   " />)

      const marks = container.querySelectorAll("mark")
      expect(marks.length).toBe(0)
    })
  })
})
