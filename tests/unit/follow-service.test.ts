import { describe, it, expect, beforeEach, vi } from "vitest"
import { Prisma } from "@/lib/generated/prisma"
import { decodeFollowCursor } from "@/lib/follow/cursor-utils"

let userFindUnique: ReturnType<typeof vi.fn>
let followCreate: ReturnType<typeof vi.fn>
let followFindUnique: ReturnType<typeof vi.fn>
let followDelete: ReturnType<typeof vi.fn>
let followFindMany: ReturnType<typeof vi.fn>
let transactionFn: ReturnType<typeof vi.fn>

vi.mock("@/lib/prisma", () => {
  userFindUnique = vi.fn()
  followCreate = vi.fn()
  followFindUnique = vi.fn()
  followDelete = vi.fn()
  followFindMany = vi.fn()

  const prismaMock = {
    user: {
      findUnique: userFindUnique,
    },
    follow: {
      create: followCreate,
      findUnique: followFindUnique,
      delete: followDelete,
      findMany: followFindMany,
    },
  }

  transactionFn = vi.fn(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock))

  return {
    prisma: {
      ...prismaMock,
      $transaction: transactionFn,
    },
  }
})

const {
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  getFollowStatusBatch,
  FollowServiceError,
} = await import("@/lib/interactions/follow")

import { prisma } from "@/lib/prisma"

describe("Follow service", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    userFindUnique.mockReset()
    followCreate.mockReset()
    followFindUnique.mockReset()
    followDelete.mockReset()
    followFindMany.mockReset()
    transactionFn.mockReset()

    transactionFn.mockImplementation(async (cb: any) =>
      cb({
        user: { findUnique: userFindUnique },
        follow: {
          create: followCreate,
          findUnique: followFindUnique,
          delete: followDelete,
          findMany: followFindMany,
        },
      })
    )

    process.env.FOLLOW_CURSOR_SECRET = "test-follow-secret"
    process.env.ALLOW_LEGACY_FOLLOW_CURSOR = "false"
  })

  describe("followUser", () => {
    it("creates a follow record when target is active", async () => {
      const createdAt = new Date("2025-01-01T00:00:00Z")

      userFindUnique.mockResolvedValueOnce({ id: "target", status: "ACTIVE", name: "Target" })
      followFindUnique.mockResolvedValueOnce(null)
      followCreate.mockResolvedValueOnce({
        followerId: "actor",
        followingId: "target",
        createdAt,
      })

      const result = await followUser("actor", "target")

      expect(result).toEqual({
        followerId: "actor",
        followingId: "target",
        createdAt: createdAt.toISOString(),
        wasNew: true,
        targetName: "Target",
      })

      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: "target" },
        select: { id: true, status: true, name: true },
      })
      expect(followFindUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: "actor",
            followingId: "target",
          },
        },
      })
      expect(followCreate).toHaveBeenCalledWith({
        data: { followerId: "actor", followingId: "target" },
      })
    })

    it("returns existing follow when unique constraint appears", async () => {
      const existingCreatedAt = new Date("2025-02-02T00:00:00Z")

      userFindUnique.mockResolvedValueOnce({ id: "target", status: "ACTIVE", name: "Target" })
      followFindUnique.mockResolvedValueOnce(null)

      const uniqueError = new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.0.0",
      })

      followCreate.mockRejectedValueOnce(uniqueError)
      followFindUnique.mockResolvedValueOnce({
        followerId: "actor",
        followingId: "target",
        createdAt: existingCreatedAt,
      })

      const result = await followUser("actor", "target")

      expect(result).toEqual({
        followerId: "actor",
        followingId: "target",
        createdAt: existingCreatedAt.toISOString(),
        wasNew: false,
        targetName: "Target",
      })
    })

    it("throws error when following self", async () => {
      await expect(followUser("user-1", "user-1")).rejects.toMatchObject({
        code: "SELF_FOLLOW",
      })
    })

    it("throws error when target user not found", async () => {
      userFindUnique.mockResolvedValueOnce(null)

      await expect(followUser("actor", "missing")).rejects.toBeInstanceOf(FollowServiceError)
      expect(followCreate).not.toHaveBeenCalled()
    })

    it("throws error when target user inactive", async () => {
      userFindUnique.mockResolvedValueOnce({ id: "target", status: "BANNED" })

      await expect(followUser("actor", "target")).rejects.toMatchObject({
        code: "TARGET_INACTIVE",
      })
    })
  })

  describe("unfollowUser", () => {
    it("deletes follow record when exists", async () => {
      followFindUnique.mockResolvedValueOnce({ followerId: "actor", followingId: "target" })
      followDelete.mockResolvedValueOnce(undefined)

      const result = await unfollowUser("actor", "target")

      expect(result).toEqual({
        followerId: "actor",
        followingId: "target",
        wasDeleted: true,
      })

      expect(followDelete).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: "actor",
            followingId: "target",
          },
        },
      })
    })

    it("returns false when follow record missing", async () => {
      followFindUnique.mockResolvedValueOnce(null)

      const result = await unfollowUser("actor", "target")

      expect(result).toEqual({
        followerId: "actor",
        followingId: "target",
        wasDeleted: false,
      })
      expect(followDelete).not.toHaveBeenCalled()
    })

    it("returns false when delete operation conflicts", async () => {
      followFindUnique.mockResolvedValueOnce({ followerId: "actor", followingId: "target" })
      const p2025 = new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      })
      followDelete.mockRejectedValueOnce(p2025)

      const result = await unfollowUser("actor", "target")

      expect(result).toEqual({
        followerId: "actor",
        followingId: "target",
        wasDeleted: false,
      })
    })
  })

  describe("listFollowers", () => {
    it("returns paginated follower list with mutual flag", async () => {
      const createdAt = new Date("2025-03-01T10:00:00Z")

      followFindMany
        .mockResolvedValueOnce([
          {
            followerId: "user-b",
            followingId: "user-a",
            createdAt,
            follower: {
              id: "user-b",
              name: "User B",
              avatarUrl: "b.png",
              bio: "bio",
              status: "ACTIVE",
            },
          },
          {
            followerId: "user-c",
            followingId: "user-a",
            createdAt,
            follower: {
              id: "user-c",
              name: "User C",
              avatarUrl: null,
              bio: null,
              status: "ACTIVE",
            },
          },
        ] as any)
        .mockResolvedValueOnce([{ followingId: "user-b" }] as any)
        .mockResolvedValueOnce([{ followerId: "user-b" }] as any)

      const result = await listFollowers("user-a", { limit: 1 })

      expect(result.items).toEqual([
        {
          id: "user-b",
          name: "User B",
          avatarUrl: "b.png",
          bio: "bio",
          status: "ACTIVE",
          isMutual: true,
          followedAt: createdAt.toISOString(),
        },
      ])
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBeDefined()
      expect(typeof result.nextCursor).toBe("string")
      expect(decodeFollowCursor(result.nextCursor!)).toMatchObject({
        id: "user-b",
      })
      expect(followFindMany).toHaveBeenCalledTimes(3)
    })

    it("rejects unsigned cursor when legacy support disabled", async () => {
      const legacyCursor = Buffer.from(
        JSON.stringify({ createdAt: new Date().toISOString(), id: "user-z" }),
        "utf-8"
      ).toString("base64")

      await expect(listFollowers("user-a", { cursor: legacyCursor })).rejects.toMatchObject({
        code: "INVALID_CURSOR",
      })

      expect(followFindMany).not.toHaveBeenCalled()
    })

    it("allows unsigned cursor only when ALLOW_LEGACY_FOLLOW_CURSOR enabled", async () => {
      process.env.ALLOW_LEGACY_FOLLOW_CURSOR = "true"

      try {
        const createdAt = new Date("2025-03-05T10:00:00Z")
        const legacyCursor = Buffer.from(
          JSON.stringify({ createdAt: createdAt.toISOString(), id: "user-b" }),
          "utf-8"
        ).toString("base64")

        followFindMany
          .mockResolvedValueOnce([
            {
              followerId: "user-b",
              followingId: "user-a",
              createdAt,
              follower: {
                id: "user-b",
                name: "User B",
                avatarUrl: null,
                bio: null,
                status: "ACTIVE",
              },
            },
          ] as any)
          .mockResolvedValueOnce([{ followingId: "user-b" }] as any)
          .mockResolvedValueOnce([{ followerId: "user-b" }] as any)

        const result = await listFollowers("user-a", { limit: 1, cursor: legacyCursor })

        expect(result).toEqual({
          items: [
            {
              id: "user-b",
              name: "User B",
              avatarUrl: null,
              bio: null,
              status: "ACTIVE",
              isMutual: true,
              followedAt: createdAt.toISOString(),
            },
          ],
          hasMore: false,
          nextCursor: undefined,
        })

        expect(followFindMany).toHaveBeenCalledTimes(3)
      } finally {
        delete process.env.ALLOW_LEGACY_FOLLOW_CURSOR
      }
    })
  })

  describe("listFollowing", () => {
    it("returns following list with mutual data", async () => {
      const createdAt = new Date("2025-03-02T09:00:00Z")

      followFindMany
        .mockResolvedValueOnce([
          {
            followerId: "user-a",
            followingId: "user-b",
            createdAt,
            following: {
              id: "user-b",
              name: "User B",
              avatarUrl: null,
              bio: null,
              status: "ACTIVE",
            },
          },
        ] as any)
        .mockResolvedValueOnce([{ followingId: "user-b" }] as any)
        .mockResolvedValueOnce([{ followerId: "user-b" }] as any)

      const result = await listFollowing("user-a")

      expect(result).toEqual({
        items: [
          {
            id: "user-b",
            name: "User B",
            avatarUrl: null,
            bio: null,
            status: "ACTIVE",
            isMutual: true,
            followedAt: createdAt.toISOString(),
          },
        ],
        hasMore: false,
        nextCursor: undefined,
      })
      expect(followFindMany).toHaveBeenCalledTimes(3)
    })
  })

  describe("getFollowStatusBatch", () => {
    it("returns follow status map with mutual info", async () => {
      followFindMany
        .mockResolvedValueOnce([{ followingId: "user-b" }, { followingId: "user-c" }] as any)
        .mockResolvedValueOnce([{ followerId: "user-b" }] as any)

      const result = await getFollowStatusBatch("actor", ["user-b", "user-c", "actor"])

      // Linus 原则：API 响应格式统一
      // 现在返回键值对结构：{ [userId]: { isFollowing, isMutual } }
      expect(result).toEqual({
        "user-b": { isFollowing: true, isMutual: true },
        "user-c": { isFollowing: true, isMutual: false },
      })
    })

    it("throws when batch exceeds limit", async () => {
      const ids = Array.from({ length: 51 }, (_, idx) => `user-${idx}`)

      await expect(getFollowStatusBatch("actor", ids)).rejects.toMatchObject({
        code: "LIMIT_EXCEEDED",
      })
    })

    it("deduplicates ids and ignores self", async () => {
      followFindMany
        .mockResolvedValueOnce([{ followingId: "user-b" }] as any)
        .mockResolvedValueOnce([{ followerId: "user-b" }] as any)

      const result = await getFollowStatusBatch("actor", ["user-b", "user-b", "actor"])

      expect(result).toEqual({
        "user-b": { isFollowing: true, isMutual: true },
      })
    })
  })
})
