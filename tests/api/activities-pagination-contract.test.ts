import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/activities/route"

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/repos/activity-repo", () => ({
  listActivities: vi.fn(),
}))

vi.mock("@/lib/interactions/likes", () => ({
  getBatchLikeStatus: vi.fn(),
}))

vi.mock("@/lib/fixtures/activity-fixture", () => ({
  getActivityFixture: vi.fn(() => ({
    items: [],
    hasMore: false,
    nextCursor: null,
    totalCount: 0,
  })),
  shouldUseFixtureExplicitly: vi.fn(() => false),
}))

import { getCurrentUser } from "@/lib/auth"
import { listActivities } from "@/lib/repos/activity-repo"
import { getBatchLikeStatus } from "@/lib/interactions/likes"
import { getActivityFixture } from "@/lib/fixtures/activity-fixture"

const minimalAuthor = {
  id: "author-1",
  name: "Author 1",
  avatarUrl: null,
  role: "USER",
  status: "ACTIVE",
}

const makeItem = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  authorId: overrides.authorId ?? minimalAuthor.id,
  content: `Activity ${id}`,
  imageUrls: overrides.imageUrls ?? (overrides.hasImages ? ["https://example.com/img.jpg"] : []),
  isPinned: overrides.isPinned ?? false,
  likesCount: overrides.likesCount ?? 0,
  commentsCount: overrides.commentsCount ?? 0,
  viewsCount: overrides.viewsCount ?? 0,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  author: overrides.author ?? minimalAuthor,
})

describe("Activity API pagination contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("handles second page via nextCursor without duplicating items", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const firstPageItems = [makeItem("act-1"), makeItem("act-2")]
    const secondPageItems = [makeItem("act-3"), makeItem("act-4")]

    vi.mocked(listActivities)
      .mockResolvedValueOnce({
        items: firstPageItems,
        hasMore: true,
        nextCursor: "act-2",
        totalCount: 4,
        appliedFilters: {
          searchTerm: undefined,
          tags: undefined,
          publishedFrom: undefined,
          publishedTo: undefined,
        },
      })
      .mockResolvedValueOnce({
        items: secondPageItems,
        hasMore: false,
        nextCursor: null,
        totalCount: 4,
        appliedFilters: {
          searchTerm: undefined,
          tags: undefined,
          publishedFrom: undefined,
          publishedTo: undefined,
        },
      })

    const firstResponse = await GET(new NextRequest("http://localhost:3000/api/activities?limit=2"))
    expect(firstResponse.status).toBe(200)
    const firstData = await firstResponse.json()
    const cursor = firstData.meta?.pagination?.nextCursor
    expect(cursor).toBe("act-2")

    const secondResponse = await GET(
      new NextRequest(`http://localhost:3000/api/activities?cursor=${cursor}&limit=2`)
    )
    expect(secondResponse.status).toBe(200)
    const secondData = await secondResponse.json()

    expect(listActivities).toHaveBeenNthCalledWith(1, expect.objectContaining({ limit: 2 }))
    expect(listActivities).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "act-2" }))

    const combinedIds = [
      ...firstData.data.map((item: any) => item.id),
      ...secondData.data.map((item: any) => item.id),
    ]
    expect(new Set(combinedIds).size).toBe(combinedIds.length)
  })

  it("forwards server-side filters for isPinned and hasImages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(getBatchLikeStatus).mockResolvedValue(new Map())

    const filteredItems = [
      makeItem("act-10", { isPinned: true, hasImages: true }),
      makeItem("act-11", { isPinned: true, hasImages: true }),
    ]

    vi.mocked(listActivities).mockResolvedValueOnce({
      items: filteredItems,
      hasMore: false,
      nextCursor: null,
      totalCount: filteredItems.length,
      appliedFilters: {
        searchTerm: undefined,
        tags: undefined,
        publishedFrom: undefined,
        publishedTo: undefined,
      },
    })

    const response = await GET(
      new NextRequest("http://localhost:3000/api/activities?isPinned=true&hasImages=true")
    )

    expect(response.status).toBe(200)
    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        isPinned: true,
        hasImages: true,
      })
    )

    const data = await response.json()
    expect(data.data.every((item: any) => item.isPinned)).toBe(true)
    expect(data.data.every((item: any) => Array.isArray(item.imageUrls))).toBe(true)
  })

  it("requires authentication for following feed", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const response = await GET(
      new NextRequest("http://localhost:3000/api/activities?orderBy=following")
    )

    expect(response.status).toBe(401)
    expect(listActivities).not.toHaveBeenCalled()
    const payload = await response.json()
    expect(payload.success).toBe(false)
  })

  it("passes followingUserId to repository when user is authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-123" } as any)
    vi.mocked(getBatchLikeStatus).mockResolvedValue(new Map())
    vi.mocked(listActivities).mockResolvedValueOnce({
      items: [makeItem("act-100")],
      hasMore: false,
      nextCursor: null,
      totalCount: 1,
      appliedFilters: {
        searchTerm: undefined,
        tags: undefined,
        publishedFrom: undefined,
        publishedTo: undefined,
      },
    })

    const response = await GET(
      new NextRequest("http://localhost:3000/api/activities?orderBy=following")
    )

    expect(response.status).toBe(200)
    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({ followingUserId: "user-123" })
    )
    const payload = await response.json()
    expect(payload.meta?.pagination?.total).toBe(1)
  })

  it("includes banned authors for admin users", async () => {
    const bannedAuthor = {
      id: "author-banned",
      name: "封禁用户",
      avatarUrl: null,
      role: "USER",
      status: "BANNED",
    }

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "admin-1", role: "ADMIN" } as any)
    vi.mocked(getBatchLikeStatus).mockResolvedValue(new Map())
    vi.mocked(listActivities).mockResolvedValueOnce({
      items: [makeItem("act-banned", { author: bannedAuthor })],
      hasMore: false,
      nextCursor: null,
      totalCount: 1,
      appliedFilters: {
        searchTerm: undefined,
        tags: undefined,
        publishedFrom: undefined,
        publishedTo: undefined,
      },
    })

    const response = await GET(new NextRequest("http://localhost:3000/api/activities"))

    expect(response.status).toBe(200)
    expect(listActivities).toHaveBeenCalledWith(
      expect.objectContaining({ includeBannedAuthors: true })
    )

    const payload = await response.json()
    expect(payload.data?.[0]?.author?.status).toBe("BANNED")
  })

  it("forwards searchTerm via q parameter", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(getBatchLikeStatus).mockResolvedValue(new Map())
    vi.mocked(listActivities).mockResolvedValueOnce({
      items: [makeItem("act-210")],
      hasMore: false,
      nextCursor: null,
      totalCount: 1,
      appliedFilters: {
        searchTerm: "design",
        tags: undefined,
        publishedFrom: undefined,
        publishedTo: undefined,
      },
    })

    const response = await GET(new NextRequest("http://localhost:3000/api/activities?q=design"))

    expect(response.status).toBe(200)
    expect(listActivities).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: "design" }))
    const payload = await response.json()
    expect(payload.meta?.filters?.searchTerm).toBe("design")
  })

  it("rejects too short search keyword", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/activities?q=a"))
    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.error?.code).toBeDefined()
  })

  it("does not fallback to fixtures when repository throws", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(listActivities).mockRejectedValueOnce(new Error("db-down"))

    const response = await GET(new NextRequest("http://localhost:3000/api/activities"))

    expect(response.status).toBe(500)
    expect(listActivities).toHaveBeenCalledTimes(1)
    expect(getActivityFixture).not.toHaveBeenCalled()
  })
})
