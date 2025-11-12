import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { prisma } from "@/lib/prisma"
import { searchActivities } from "@/lib/repos/search/activities"
import { searchUsers } from "@/lib/repos/search/users"
import { searchTags as searchTagsRepo } from "@/lib/repos/search/tags"

describe("search visibility safeguards", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("falls back to LIKE search when activity tsquery fails", async () => {
    const transactionMock = vi
      .spyOn(prisma, "$transaction")
      .mockRejectedValueOnce(new Error("force fallback"))
      .mockResolvedValueOnce([
        [
          {
            id: "activity-1",
            content: "hello",
            imageUrls: [],
            isPinned: false,
            likesCount: 0,
            commentsCount: 0,
            viewsCount: 0,
            createdAt: new Date(),
            rank: 0,
            authorId: "user-1",
          },
        ],
        [{ total: BigInt(1) }],
      ] as unknown)
    vi.spyOn(prisma.user, "findMany").mockResolvedValue([
      { id: "user-1", name: "Tester", avatarUrl: null, role: "USER" },
    ])

    const result = await searchActivities({ query: "hello" })

    expect(transactionMock).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(1)
    expect(result.items[0].rank).toBe(0)
  })

  it("filters out non-active users during fallback search", async () => {
    vi.spyOn(prisma, "$transaction").mockRejectedValue(new Error("force fallback"))
    const findManyMock = vi.spyOn(prisma.user, "findMany").mockResolvedValue([
      {
        id: "user-1",
        name: "Tester",
        avatarUrl: null,
        bio: null,
        role: "USER",
      },
    ])
    vi.spyOn(prisma.user, "count").mockResolvedValue(1)

    await searchUsers({ query: "tester" })

    const call = findManyMock.mock.calls[0][0]
    expect(call?.where).toMatchObject({ status: "ACTIVE" })
  })

  it("matches tag descriptions when searching tags", async () => {
    const findManyMock = vi.spyOn(prisma.tag, "findMany").mockResolvedValue([])
    vi.spyOn(prisma.tag, "count").mockResolvedValue(0)

    await searchTagsRepo({ query: "database" })

    const call = findManyMock.mock.calls[0][0]
    const orConditions = call?.where?.OR ?? []
    const hasDescriptionCondition = orConditions.some(
      (condition: Record<string, unknown>) => "description" in condition
    )
    expect(hasDescriptionCondition).toBe(true)
  })
})
