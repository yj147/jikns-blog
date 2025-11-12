import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PostList } from "@/components/admin/post-list"
import type { Post } from "@/components/admin/post-card"

const basePost: Post = {
  id: "post-1",
  title: "测试文章",
  slug: "test-post",
  content: "",
  tags: ["测试"],
  isPublished: true,
  isPinned: false,
  createdAt: new Date("2025-09-20T00:00:00Z"),
  updatedAt: new Date("2025-09-20T00:00:00Z"),
  author: {
    id: "author-1",
    name: "管理员",
  },
}

describe("Admin PostList", () => {
  it("在无数据时展示错误态并支持重试", () => {
    const onRetry = vi.fn()
    render(<PostList posts={[]} error="服务暂时不可用" onRetry={onRetry} />)

    expect(screen.getByText("文章列表加载失败")).toBeInTheDocument()
    expect(screen.getByText("服务暂时不可用")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "重试加载" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("在已有数据时展示内联错误提示", () => {
    const onRetry = vi.fn()
    render(<PostList posts={[basePost]} error="同步失败" onRetry={onRetry} />)

    expect(screen.getByText("文章数据同步异常")).toBeInTheDocument()
    expect(screen.getByText("同步失败")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "重试加载" })).toHaveLength(1)
  })
})
