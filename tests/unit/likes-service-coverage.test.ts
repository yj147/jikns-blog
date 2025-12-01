import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  toggleLike,
  setLike,
  ensureLiked,
  ensureUnliked,
  getLikeStatus,
  getLikeUsers,
  getBatchLikeStatus,
  getLikeCount,
  clearUserLikes,
} from "@/lib/interactions/likes"
import { prisma } from "@/lib/prisma"
import { InteractionNotAllowedError } from "@/lib/interactions/errors"
import { Role, UserStatus, Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"

const { notifyMock } = vi.hoisted(() => {
  return { notifyMock: vi.fn() }
})

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock("@/lib/services/notification", () => ({
  notify: notifyMock,
}))

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    like: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    post: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    activity: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  }
  return { prisma: mockPrisma, default: mockPrisma }
})

const asAny = (v: any) => v as any

describe("likes service coverage sweep", () => {
  const activeUser = {
    id: "user-1",
    email: "u@example.com",
    role: Role.USER,
    status: UserStatus.ACTIVE,
    name: "u",
  avatarUrl: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any)
    notifyMock.mockReset()
  })

  it("covers like status and batch helpers", async () => {
    vi.mocked(prisma.like.count).mockResolvedValue(2)
    vi.mocked(prisma.like.findFirst).mockResolvedValue({ id: "like-1" } as any)

    const status = await getLikeStatus("post", "p1", "user-1")
    expect(status).toEqual({ isLiked: true, count: 2 })

    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      { id: "a1", likesCount: 3 },
    ] as any)
    vi.mocked(prisma.like.groupBy).mockResolvedValue([{ postId: "p1", _count: { _all: 4 } }] as any)
    vi.mocked(prisma.like.findMany).mockResolvedValue([{ activityId: "a1" }] as any)

    const batch = await getBatchLikeStatus("activity", ["a1"], "user-1")
    expect(batch.get("a1")?.count).toBe(3)
  })

  it("covers getLikeUsers pagination", async () => {
    const now = new Date()
    vi.mocked(prisma.like.findMany).mockResolvedValue([
      {
        id: "l1",
        authorId: "u1",
        activityId: "a1",
        createdAt: now,
        author: { id: "u1", name: "U1", avatarUrl: null },
      },
      {
        id: "l0",
        authorId: "u0",
        activityId: "a1",
        createdAt: new Date(now.getTime() - 1),
        author: { id: "u0", name: "U0", avatarUrl: null },
      },
    ] as any)

    const result = await getLikeUsers("activity", "a1", 1)
    expect(result.users[0].id).toBe("u1")
    expect(result.hasMore).toBe(true)
  })

  it("covers toggle/set like on activity and ensure flows", async () => {
    vi.mocked(prisma.activity.findFirst).mockResolvedValue({
      id: "a1",
      authorId: "author-1",
      deletedAt: null,
      isPinned: false,
      author: { id: "author-1", status: UserStatus.ACTIVE, role: Role.USER },
    } as any)
    vi.mocked(prisma.activity.findUnique).mockResolvedValue({
      authorId: "author-1",
    } as any)
    vi.mocked(prisma.like.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "like-1",
        authorId: activeUser.id,
        activityId: "a1",
      } as any)
    vi.mocked(prisma.like.create).mockResolvedValue({} as any)
    vi.mocked(prisma.like.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.like.count).mockResolvedValue(1)
    vi.mocked(prisma.activity.updateMany).mockResolvedValue({ count: 1 } as any)
    notifyMock.mockResolvedValue(null)

    const liked = await toggleLike("activity", "a1", activeUser.id)
    expect(liked.isLiked).toBe(true)
    expect(notifyMock).toHaveBeenCalledWith("author-1", "LIKE", {
      actorId: activeUser.id,
      activityId: "a1",
    })

    const unliked = await toggleLike("activity", "a1", activeUser.id)
    expect(unliked.isLiked).toBe(false)

    const ensured = await ensureLiked("activity", "a1", activeUser.id)
    expect(ensured.isLiked).toBe(true)

    const ensuredOff = await ensureUnliked("activity", "a1", activeUser.id)
    expect(ensuredOff.isLiked).toBe(false)
  })

  it("covers setLike false path and deleteMany", async () => {
    vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 2 } as any)
    vi.mocked(prisma.like.count).mockResolvedValue(0)

    const res = await setLike("post", "p1", activeUser.id, false)
    expect(res).toEqual({ isLiked: false, count: 0 })
  })

  it("covers clearUserLikes and sync", async () => {
    vi.mocked(prisma.like.findMany).mockResolvedValue([{ activityId: "a1" }] as any)
    vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(prisma.like.count).mockResolvedValue(0)
    vi.mocked(prisma.activity.updateMany).mockResolvedValue({ count: 1 } as any)

    await clearUserLikes(activeUser.id)

    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { authorId: activeUser.id } })
  })

  it("rejects when actor inactive", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...activeUser,
      status: UserStatus.BANNED,
    } as any)
    await expect(toggleLike("post", "p1", activeUser.id)).rejects.toBeInstanceOf(
      InteractionNotAllowedError
    )
  })

  it("handles unique constraint conflict on create (P2002)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any)
    vi.mocked(prisma.post.findFirst).mockResolvedValue({
      id: "p-unique",
      authorId: "author-1",
      author: { id: "author-1", status: UserStatus.ACTIVE, role: Role.USER },
      published: true,
    } as any)
    vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

    const uniqueErr = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "6",
    })
    vi.mocked(prisma.like.create).mockRejectedValue(uniqueErr)
    vi.mocked(prisma.like.count).mockResolvedValue(5)

    const res = await toggleLike("post", "p-unique", activeUser.id)
    expect(res).toEqual({ isLiked: true, count: 5 })
  })

  it("handles delete missing record (P2025) gracefully", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any)
    vi.mocked(prisma.post.findFirst).mockResolvedValue({
      id: "p-del",
      authorId: "author-1",
      author: { id: "author-1", status: UserStatus.ACTIVE, role: Role.USER },
      published: true,
    } as any)
    vi.mocked(prisma.like.findFirst).mockResolvedValue({
      id: "like-del",
      authorId: activeUser.id,
      postId: "p-del",
    } as any)

    const notFoundErr = new Prisma.PrismaClientKnownRequestError("gone", {
      code: "P2025",
      clientVersion: "6",
    })
    vi.mocked(prisma.like.delete).mockRejectedValue(notFoundErr)
    vi.mocked(prisma.like.count).mockResolvedValue(0)

    const res = await toggleLike("post", "p-del", activeUser.id)
    expect(res).toEqual({ isLiked: false, count: 0 })
  })

  it("syncActivityLikeCount via getLikeCount", async () => {
    vi.mocked(prisma.like.count).mockResolvedValue(4)
    vi.mocked(prisma.activity.updateMany).mockResolvedValue({ count: 1 } as any)

    const count = await getLikeCount("activity", "a-sync")
    expect(count).toBe(4)
    expect(prisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: "a-sync" },
      data: { likesCount: 4 },
    })
  })

  it("getLikeUsers uses cursor paging", async () => {
    const now = new Date()
    vi.mocked(prisma.like.findMany).mockResolvedValue([
      {
        id: "l2",
        authorId: "u2",
        postId: "p1",
        createdAt: now,
        author: { id: "u2", name: "U2", avatarUrl: null },
      },
    ] as any)

    await getLikeUsers("post", "p1", 10, "cursor-1")
    expect(prisma.like.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "cursor-1" }, skip: 1 })
    )
  })

  it("getBatchLikeStatus covers post path with user likes", async () => {
    vi.mocked(prisma.like.groupBy).mockResolvedValue([
      { postId: "p1", _count: { _all: 3 } },
    ] as any)
    vi.mocked(prisma.like.findMany).mockResolvedValue([
      { postId: "p1" },
      { postId: "p2" },
    ] as any)

    const res = await getBatchLikeStatus("post", ["p1", "p2"], "user-1")
    expect(res.get("p1")?.count).toBe(3)
    expect(res.get("p1")?.isLiked).toBe(true)
    expect(res.get("p2")?.isLiked).toBe(true)
  })

  it("clearUserLikes aggregates affected activities", async () => {
    vi.mocked(prisma.like.findMany).mockResolvedValue([
      { activityId: "a1" },
      { activityId: "a1" },
      { activityId: "a2" },
    ] as any)
    vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 3 } as any)
    vi.mocked(prisma.like.count).mockResolvedValue(0)
    vi.mocked(prisma.activity.updateMany).mockResolvedValue({ count: 1 } as any)

    await clearUserLikes("user-1")
    expect(prisma.activity.updateMany).toHaveBeenCalledTimes(2)
  })

  it("rejects deleted activity like with validation error", async () => {
    vi.mocked(prisma.activity.findFirst).mockResolvedValue({
      id: "a-del",
      authorId: "author-1",
      deletedAt: new Date(),
      isPinned: false,
      author: { id: "author-1", status: UserStatus.ACTIVE, role: Role.USER },
    } as any)
    vi.mocked(prisma.like.findFirst).mockResolvedValue(null)

    await expect(toggleLike("activity", "a-del", activeUser.id)).rejects.toBeInstanceOf(
      InteractionNotAllowedError
    )
  })
})
