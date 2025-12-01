import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { GET } from "@/app/api/users/[userId]/likes/route"
import { prisma } from "@/lib/prisma"
import { ProfileLikesTab } from "@/components/profile/profile-likes-tab"
import { TEST_USERS, createTestRequest } from "../helpers/test-data"

const userId = TEST_USERS.user.id

const jsonResponse = (data: any) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as unknown as Response

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/users/[userId]/likes", () => {
  it("should return empty list when user has no likes", async () => {
    vi.mocked(prisma.like.findMany).mockResolvedValue([])
    vi.mocked(prisma.like.count).mockResolvedValue(0 as any)

    const request = createTestRequest(`/api/users/${userId}/likes`)
    const response = await GET(request as unknown as NextRequest, {
      params: Promise.resolve({ userId }),
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
    expect(body.pagination.hasMore).toBe(false)
  })

  it("should return mixed activity and post likes", async () => {
    const now = new Date("2024-01-10T00:00:00Z")
    const activity = {
      id: "act-1",
      authorId: TEST_USERS.user.id,
      content: "测试动态",
      imageUrls: [],
      isPinned: false,
      likesCount: 3,
      commentsCount: 1,
      viewsCount: 12,
      createdAt: now,
      updatedAt: now,
      author: {
        id: TEST_USERS.user.id,
        name: TEST_USERS.user.name,
        avatarUrl: TEST_USERS.user.avatarUrl,
        role: "USER",
        status: "ACTIVE",
      },
    }

    const post = {
      id: "post-1",
      slug: "post-slug",
      title: "测试文章",
      excerpt: "简介",
      published: true,
      isPinned: false,
      coverImage: null,
      viewCount: 20,
      publishedAt: now,
      createdAt: now,
      content: "正文内容",
      author: {
        id: TEST_USERS.admin.id,
        name: TEST_USERS.admin.name,
        avatarUrl: TEST_USERS.admin.avatarUrl,
      },
      tags: [{ tag: { id: "tag-1", name: "Tag1", slug: "tag1", color: "#000000" } }],
      _count: { comments: 2, likes: 5, bookmarks: 1 },
    }

    vi.mocked(prisma.like.findMany).mockResolvedValue([
      {
        id: "like-1",
        createdAt: now,
        authorId: userId,
        activityId: "act-1",
        postId: null,
        activity,
        post: null,
      },
      {
        id: "like-2",
        createdAt: new Date("2024-01-09T00:00:00Z"),
        authorId: userId,
        activityId: null,
        postId: "post-1",
        activity: null,
        post,
      },
    ] as any)
    vi.mocked(prisma.like.count).mockResolvedValue(2 as any)

    const request = createTestRequest(`/api/users/${userId}/likes`)
    const response = await GET(request as unknown as NextRequest, {
      params: Promise.resolve({ userId }),
    })

    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].type).toBe("activity")
    expect(body.data[1].type).toBe("post")
    expect(body.data[0].activity.content).toBe("测试动态")
    expect(body.data[1].post.title).toBe("测试文章")
  })

  it("should respect pagination params", async () => {
    vi.mocked(prisma.like.findMany).mockResolvedValue([
      {
        id: "like-3",
        createdAt: new Date(),
        authorId: userId,
        activityId: "act-2",
        postId: null,
        activity: {
          id: "act-2",
          authorId: userId,
          content: "分页测试动态",
          imageUrls: [],
          isPinned: false,
          likesCount: 0,
          commentsCount: 0,
          viewsCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: userId,
            name: "分页用户",
            avatarUrl: null,
            role: "USER",
            status: "ACTIVE",
          },
        },
        post: null,
      },
    ] as any)
    vi.mocked(prisma.like.count).mockResolvedValue(3 as any)

    const request = createTestRequest(`/api/users/${userId}/likes?page=2&limit=1`)
    const response = await GET(request as unknown as NextRequest, {
      params: Promise.resolve({ userId }),
    })
    const body = await response.json()

    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(1)
    expect(body.pagination.hasMore).toBe(true)
    expect(prisma.like.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 1 })
    )
  })
})

describe("ProfileLikesTab component", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    ;(global as any).fetch = originalFetch
  })

  it("renders liked items and loads more on demand", async () => {
    const page1 = {
      success: true,
      data: [
        {
          type: "activity" as const,
          likedAt: "2024-01-01T12:00:00Z",
          activity: {
            id: "act-ui-1",
            authorId: userId,
            content: "前端点赞动态",
            imageUrls: [],
            isPinned: false,
            likesCount: 2,
            commentsCount: 0,
            viewsCount: 10,
            createdAt: "2024-01-01T10:00:00Z",
            updatedAt: "2024-01-01T10:00:00Z",
            author: {
              id: userId,
              name: "点赞用户",
              avatarUrl: null,
              role: "USER" as const,
              status: "ACTIVE",
            },
          },
        },
      ],
      pagination: { page: 1, limit: 10, total: 2, hasMore: true },
    }

    const page2 = {
      success: true,
      data: [
        {
          type: "post" as const,
          likedAt: "2024-01-02T12:00:00Z",
          post: {
            id: "post-ui-1",
            slug: "liked-post",
            title: "前端点赞文章",
            excerpt: "简介",
            published: true,
            isPinned: false,
            coverImage: null,
            viewCount: 50,
            publishedAt: "2024-01-02T10:00:00Z",
            createdAt: "2024-01-02T10:00:00Z",
            author: { id: userId, name: "点赞用户", avatarUrl: null },
            tags: [],
            stats: { commentsCount: 1, likesCount: 5, bookmarksCount: 0 },
            contentLength: 1200,
          },
        },
      ],
      pagination: { page: 2, limit: 10, total: 2, hasMore: false },
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url
      if (url.includes("page=1")) {
        return jsonResponse(page1)
      }
      if (url.includes("page=2")) {
        return jsonResponse(page2)
      }
      return jsonResponse(page1)
    }) as unknown as typeof fetch

    ;(global as any).fetch = fetchMock

    render(<ProfileLikesTab userId={userId} />)

    await waitFor(() => expect(screen.getByText("前端点赞动态")).toBeInTheDocument())
    expect(screen.getByText(/点赞于/)).toBeInTheDocument()

    const loadMoreButton = await screen.findByRole("button", { name: "加载更多" })
    const user = userEvent.setup()
    await user.click(loadMoreButton)

    await waitFor(() => expect(screen.getByText("前端点赞文章")).toBeInTheDocument())
    const calledPage2 = fetchMock.mock.calls.some(([arg]) => {
      const url = typeof arg === "string" ? arg : (arg as Request).url
      return url.includes("page=2")
    })
    expect(calledPage2).toBe(true)
  })
})
