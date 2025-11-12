import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SearchResultCard } from "@/components/search/search-result-card"

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}))

const basePost = {
  id: "post-1",
  slug: "post-1",
  title: "Test Post",
  excerpt: "A test excerpt",
  coverImage: null,
  published: true,
  publishedAt: new Date(),
  viewCount: 42,
  createdAt: new Date(),
  rank: 0.5,
  author: {
    id: "user-1",
    name: "Tester",
    avatarUrl: null,
  },
  tags: [],
} as const

describe("SearchResultCard relevance显示", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("截断超过100%的相关性显示", () => {
    render(
      <SearchResultCard
        type="post"
        data={{
          ...basePost,
          rank: 1.25,
        }}
        query="test"
      />
    )

    expect(screen.getByText("100%")).toBeInTheDocument()
  })

  it("对负数相关性显示0%", () => {
    render(
      <SearchResultCard
        type="post"
        data={{
          ...basePost,
          rank: -0.4,
        }}
        query="test"
      />
    )

    expect(screen.getByText("0%")).toBeInTheDocument()
  })
})
