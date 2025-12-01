import { beforeEach, describe, expect, it, vi } from "vitest"

import { prisma } from "@/lib/prisma"
import { listActivities } from "@/lib/repos/activity-repo"
import { listComments } from "@/lib/interactions/comments"
import { UserStatus } from "@/lib/generated/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    follow: {
      findMany: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

const mockedFindMany = vi.mocked(prisma.activity.findMany)
const mockedCount = vi.mocked(prisma.activity.count)
const mockedFollowFindMany = vi.mocked(prisma.follow.findMany)
const mockedCommentFindMany = vi.mocked(prisma.comment.findMany)
const mockedCommentCount = vi.mocked(prisma.comment.count)
const mockedCommentGroupBy = vi.mocked(prisma.comment.groupBy)

const baseAuthor = {
  id: "author-1",
  name: "Author 1",
  avatarUrl: null,
  role: "USER",
  status: "ACTIVE",
}

const makeActivity = (id: string, iso: string, overrides: Record<string, unknown> = {}) => ({
  id,
  content: `Activity ${id}`,
  imageUrls: overrides.imageUrls ?? [],
  isPinned: overrides.isPinned ?? false,
  likesCount: overrides.likesCount ?? 0,
  commentsCount: overrides.commentsCount ?? 0,
  viewsCount: overrides.viewsCount ?? 0,
  createdAt: new Date(iso),
  updatedAt: new Date(iso),
  authorId: overrides.authorId ?? baseAuthor.id,
  author: overrides.author ?? baseAuthor,
  deletedAt: null,
})

const makeComment = (id: string, createdAt: Date, overrides: Record<string, unknown> = {}) => ({
  id,
  content: `Comment ${id}`,
  createdAt,
  updatedAt: createdAt,
  parentId: null,
  postId: "post-1",
  activityId: null,
  authorId: baseAuthor.id,
  ...overrides,
})

describe("listActivities pagination & filters", () => {
  beforeEach(() => {
    mockedFindMany.mockReset()
    mockedCount.mockReset()
    mockedFollowFindMany.mockReset()
    mockedCommentFindMany.mockReset()
    mockedCommentCount.mockReset()
    mockedCommentGroupBy.mockReset()
  })

  it("returns ID-based nextCursor and trims to limit", async () => {
    const now = Date.now()
    mockedFindMany.mockResolvedValueOnce([
      makeActivity("act-1", new Date(now).toISOString()),
      makeActivity("act-2", new Date(now - 1000).toISOString()),
      makeActivity("act-3", new Date(now - 2000).toISOString()),
    ])
    mockedCount.mockResolvedValueOnce(3)

    const result = await listActivities({ limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe("act-2")
    expect(result.totalCount).toBe(3)
    expect(result.appliedFilters).toEqual({
      searchTerm: undefined,
      tags: undefined,
      publishedFrom: undefined,
      publishedTo: undefined,
    })
  })

  it("passes ID cursor back to Prisma when fetching next page", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    await listActivities({ limit: 10, cursor: "act-9" })

    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "act-9" },
        skip: 1,
      })
    )
  })

  it("applies hasImages=true filter via server-side where clause", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    await listActivities({ hasImages: true })

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({ imageUrls: { isEmpty: false } }),
      ])
    )
  })

  it("applies hasImages=false filter including empty arrays", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    await listActivities({ hasImages: false })

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({ imageUrls: { isEmpty: true } }),
      ])
    )
  })

  it("normalizes tag filters and applies relational query", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    const result = await listActivities({ tags: [" React  ", "Next.js"] })

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({
          tags: {
            some: {
              tag: { slug: "react" },
            },
          },
        }),
        expect.objectContaining({
          tags: {
            some: {
              tag: { slug: "next-js" },
            },
          },
        }),
      ])
    )

    expect(result.appliedFilters?.tags).toEqual(["React", "Next.js"])
  })

  it("applies isPinned filter when provided", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    await listActivities({ isPinned: true })

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({ isPinned: true }),
      ])
    )
  })

  it("filters to followed authors when orderBy=following", async () => {
    mockedFindMany.mockResolvedValueOnce([
      makeActivity("act-1", new Date().toISOString(), { authorId: "author-1" }),
    ])
    mockedCount.mockResolvedValueOnce(1)

    const result = await listActivities({ orderBy: "following", followingUserId: "user-123" })

    expect(mockedFollowFindMany).not.toHaveBeenCalled()

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({
          author: expect.objectContaining({
            followers: expect.objectContaining({ some: { followerId: "user-123" } }),
          }),
        }),
      ])
    )
    expect(result.totalCount).toBe(1)
    expect(result.appliedFilters).toEqual({
      searchTerm: undefined,
      tags: undefined,
      publishedFrom: undefined,
      publishedTo: undefined,
    })
  })

  it("returns empty result when following feed has no authors", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    const result = await listActivities({ orderBy: "following", followingUserId: "user-123" })

    expect(mockedFollowFindMany).not.toHaveBeenCalled()
    expect(result.items).toHaveLength(0)
    expect(result.totalCount).toBe(0)
    expect(result.hasMore).toBe(false)
    expect(result.appliedFilters).toEqual({
      searchTerm: undefined,
      tags: undefined,
      publishedFrom: undefined,
      publishedTo: undefined,
    })
  })

  it("applies searchTerm using Prisma full-text search operator", async () => {
    mockedFindMany.mockResolvedValueOnce([
      makeActivity("act-10", new Date().toISOString()),
      makeActivity("act-20", new Date().toISOString()),
    ])
    mockedCount.mockResolvedValueOnce(2)

    const result = await listActivities({ searchTerm: "frontend" })

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({
          content: { contains: "frontend", mode: "insensitive" },
        }),
      ])
    )
    expect(result.appliedFilters).toEqual({
      searchTerm: "frontend",
      tags: undefined,
      publishedFrom: undefined,
      publishedTo: undefined,
    })
  })

  it("still performs query when searchTerm has no matches", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    const result = await listActivities({ searchTerm: "missing" })

    expect(mockedFindMany).toHaveBeenCalled()
    expect(result.items).toHaveLength(0)
    expect(result.totalCount).toBe(0)
    expect(result.appliedFilters?.searchTerm).toBe("missing")
  })

  it("applies date range filter when provided", async () => {
    mockedFindMany.mockResolvedValueOnce([])
    mockedCount.mockResolvedValueOnce(0)

    const from = new Date("2025-09-01T00:00:00.000Z")
    const to = new Date("2025-09-30T23:59:59.999Z")

    const result = await listActivities({ publishedFrom: from, publishedTo: to })

    const callArgs = mockedFindMany.mock.calls[0]?.[0]
    expect(callArgs?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          author: expect.objectContaining({
            status: expect.objectContaining({ not: UserStatus.BANNED }),
          }),
        }),
        expect.objectContaining({
          createdAt: expect.objectContaining({ gte: from, lte: to }),
        }),
      ])
    )

    expect(result.appliedFilters).toEqual({
      searchTerm: undefined,
      tags: undefined,
      publishedFrom: from.toISOString(),
      publishedTo: to.toISOString(),
    })
  })
})

describe("listComments pagination", () => {
  beforeEach(() => {
    mockedCommentFindMany.mockReset()
    mockedCommentCount.mockReset()
    mockedCommentGroupBy.mockReset()
    mockedCommentCount.mockResolvedValue(0)
    mockedCommentGroupBy.mockResolvedValue([])
  })

  it("returns deterministic cursor when multiple comments share timestamp", async () => {
    const now = new Date()
    mockedCommentCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0)
    mockedCommentFindMany
      .mockResolvedValueOnce([
        makeComment("c-1", now),
        makeComment("c-2", now),
        makeComment("c-3", new Date(now.getTime() - 1_000)),
      ])
      .mockResolvedValueOnce([
        makeComment("c-2", now),
        makeComment("c-3", new Date(now.getTime() - 1_000)),
      ])

    const first = await listComments({ targetType: "post", targetId: "post-1", limit: 2 })

    expect(first.hasMore).toBe(true)
    expect(first.nextCursor).toBe("c-2")
    expect(first.totalCount).toBe(3)

    const firstCallArgs = mockedCommentFindMany.mock.calls[0]?.[0]
    expect(firstCallArgs?.where).toMatchObject({ parentId: null })
    expect(firstCallArgs?.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }])

    await listComments({ targetType: "post", targetId: "post-1", limit: 2, cursor: "c-2" })

    const secondCallArgs = mockedCommentFindMany.mock.calls[1]?.[0]
    expect(secondCallArgs?.cursor).toEqual({ id: "c-2" })
    expect(secondCallArgs?.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }])
    expect(mockedCommentCount).toHaveBeenCalledTimes(4)
    expect(mockedCommentCount).toHaveBeenNthCalledWith(1, {
      where: {
        postId: "post-1",
        deletedAt: null,
        parentId: null,
      },
    })
    expect(mockedCommentCount).toHaveBeenNthCalledWith(2, {
      where: {
        postId: "post-1",
        deletedAt: null,
        parentId: { not: null },
        parent: {
          postId: "post-1",
          deletedAt: null,
        },
      },
    })
  })

  it("attaches replies when includeReplies is true", async () => {
    const now = new Date()
    mockedCommentCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    mockedCommentFindMany
      .mockResolvedValueOnce([
        makeComment("top-1", now),
        makeComment("top-2", new Date(now.getTime() - 500)),
      ])
      .mockResolvedValueOnce([
        makeComment("reply-1", new Date(now.getTime() - 100), { parentId: "top-1" }),
        makeComment("reply-2", new Date(now.getTime() - 200), { parentId: "top-2" }),
      ])

    const result = await listComments({
      targetType: "post",
      targetId: "post-1",
      includeReplies: true,
    })

    expect(result.comments).toHaveLength(2)
    expect(result.comments[0].replies?.[0].id).toBe("reply-1")
    expect(result.comments[1].replies?.[0].id).toBe("reply-2")
    expect(result.totalCount).toBe(2)

    const repliesCallArgs = mockedCommentFindMany.mock.calls[1]?.[0]
    expect(repliesCallArgs?.where).toMatchObject({ parentId: { in: ["top-1", "top-2"] } })
    expect(repliesCallArgs?.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }])
  })
})
