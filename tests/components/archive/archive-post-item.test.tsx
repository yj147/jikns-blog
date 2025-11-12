import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import ArchivePostItem from "@/components/archive/archive-post-item"
import type { ArchivePost } from "@/lib/actions/archive"

const buildPost = (overrides: Partial<ArchivePost> = {}): ArchivePost => ({
  id: "post-1",
  title: "测试文章",
  slug: "test-post",
  summary: "文章摘要",
  publishedAt: new Date("2025-01-02T03:00:00.000Z"),
  tags: [],
  ...overrides,
})

describe("ArchivePostItem", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-03-01T00:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("渲染日期、标题和摘要内容", () => {
    render(<ArchivePostItem post={buildPost()} />)

    expect(screen.getByText("测试文章")).toBeInTheDocument()
    expect(screen.getByText("文章摘要")).toBeInTheDocument()
    expect(screen.getByText("01/02")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "测试文章" })).toHaveAttribute(
      "href",
      "/blog/test-post"
    )
  })

  it("展示前三个标签并显示剩余数量", () => {
    const tags = [
      { tag: { id: "tag-1", name: "A", slug: "a" } },
      { tag: { id: "tag-2", name: "B", slug: "b" } },
      { tag: { id: "tag-3", name: "C", slug: "c" } },
      { tag: { id: "tag-4", name: "D", slug: "d" } },
    ]

    render(<ArchivePostItem post={buildPost({ tags })} />)

    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("href", "/tags/a")
    expect(screen.getByRole("link", { name: "C" })).toHaveAttribute("href", "/tags/c")
    expect(screen.getByText("+1")).toBeInTheDocument()
  })
})
