import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

import { EMPTY_QUICK_STATS, getQuickStats } from "@/lib/profile/stats"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"

const fixedNow = new Date("2024-05-15T12:00:00Z")

let postCountMock: ReturnType<typeof vi.fn>
let postAggregateMock: ReturnType<typeof vi.fn>
let likeCountMock: ReturnType<typeof vi.fn>
let commentCountMock: ReturnType<typeof vi.fn>

beforeAll(() => {
  vi.useFakeTimers()
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.setSystemTime(fixedNow)

  postCountMock = vi.fn()
  postAggregateMock = vi.fn()
  likeCountMock = vi.fn()
  commentCountMock = vi.fn()

  ;(prisma.post as any).count = postCountMock
  ;(prisma.post as any).aggregate = postAggregateMock
  ;(prisma.like as any).count = likeCountMock
  ;(prisma.comment as any).count = commentCountMock

  vi.mocked(logger.error).mockReset()
})

describe("getQuickStats", () => {
  it("应该返回正确的聚合数据", async () => {
    postCountMock.mockResolvedValue(12)
    postAggregateMock.mockResolvedValue({ _sum: { viewCount: 4567 } })
    likeCountMock.mockResolvedValue(89)
    commentCountMock.mockResolvedValue(34)

    const stats = await getQuickStats("user-1")

    expect(stats).toEqual({
      monthlyPosts: 12,
      totalViews: 4567,
      totalLikes: 89,
      totalComments: 34,
    })

    const countArgs = postCountMock.mock.calls[0]?.[0]
    expect(countArgs?.where?.authorId).toBe("user-1")
    expect(countArgs?.where?.publishedAt?.gte).toBeInstanceOf(Date)
  })

  it("无数据用户应该返回 0", async () => {
    postCountMock.mockResolvedValue(0)
    postAggregateMock.mockResolvedValue({ _sum: { viewCount: null } })
    likeCountMock.mockResolvedValue(0)
    commentCountMock.mockResolvedValue(0)

    const stats = await getQuickStats("new-user")

    expect(stats).toEqual({
      monthlyPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
    })
  })

  it("数据库错误时应该优雅降级并记录日志", async () => {
    postCountMock.mockRejectedValue(new Error("db down"))
    postAggregateMock.mockResolvedValue({ _sum: { viewCount: 0 } })
    likeCountMock.mockResolvedValue(0)
    commentCountMock.mockResolvedValue(0)

    await expect(getQuickStats("user-error")).resolves.toEqual(EMPTY_QUICK_STATS)
    expect(logger.error).toHaveBeenCalled()
  })

  it("应处理大数据量且不丢失精度", async () => {
    postCountMock.mockResolvedValue(5000)
    postAggregateMock.mockResolvedValue({ _sum: { viewCount: 1_234_567 } })
    likeCountMock.mockResolvedValue(98_765)
    commentCountMock.mockResolvedValue(12_345)

    const stats = await getQuickStats("power-user")

    expect(stats.monthlyPosts).toBe(5000)
    expect(stats.totalViews).toBe(1_234_567)
    expect(stats.totalLikes).toBe(98_765)
    expect(stats.totalComments).toBe(12_345)
  })
})
