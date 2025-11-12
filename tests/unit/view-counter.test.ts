import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock dependencies
vi.mock("@/lib/rate-limit/redis-client", () => ({
  getRedisClient: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activity: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  incrementActivityViewCount,
  syncViewCountsToDatabase,
  getActivityViewCount,
} from "@/lib/services/view-counter"
import { getRedisClient } from "@/lib/rate-limit/redis-client"
import { prisma } from "@/lib/prisma"

describe("View Counter Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("incrementActivityViewCount", () => {
    it("应该使用 Redis 增加浏览量", async () => {
      const mockRedis = {
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)

      await incrementActivityViewCount("activity-1")

      expect(mockRedis.incr).toHaveBeenCalledWith("activity:views:activity-1")
      expect(mockRedis.expire).toHaveBeenCalledWith("activity:views:activity-1", 60 * 60 * 24 * 7)
      expect(prisma.activity.update).not.toHaveBeenCalled()
    })

    it("Redis 失败时应该降级到数据库", async () => {
      const mockRedis = {
        incr: vi.fn().mockRejectedValue(new Error("Redis error")),
        expire: vi.fn(),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)
      vi.mocked(prisma.activity.update).mockResolvedValue({} as any)

      await incrementActivityViewCount("activity-1")

      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: "activity-1" },
        data: { viewsCount: { increment: 1 } },
      })
    })

    it("Redis 不可用时应该直接使用数据库", async () => {
      vi.mocked(getRedisClient).mockReturnValue(null)
      vi.mocked(prisma.activity.update).mockResolvedValue({} as any)

      await incrementActivityViewCount("activity-1")

      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: "activity-1" },
        data: { viewsCount: { increment: 1 } },
      })
    })

    it("数据库更新失败时不应该抛出错误", async () => {
      vi.mocked(getRedisClient).mockReturnValue(null)
      vi.mocked(prisma.activity.update).mockRejectedValue(new Error("Database error"))

      // 不应该抛出错误
      await expect(incrementActivityViewCount("activity-1")).resolves.toBeUndefined()
    })
  })

  describe("syncViewCountsToDatabase", () => {
    it("Redis 不可用时应该返回空结果", async () => {
      vi.mocked(getRedisClient).mockReturnValue(null)

      const result = await syncViewCountsToDatabase()

      expect(result).toEqual({ synced: 0, failed: 0, errors: [] })
    })

    it("没有待同步数据时应该返回空结果", async () => {
      const mockRedis = {
        scan: vi.fn().mockResolvedValue([0, []]),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)

      const result = await syncViewCountsToDatabase()

      expect(result).toEqual({ synced: 0, failed: 0, errors: [] })
    })

    it("应该批量同步 Redis 计数到数据库", async () => {
      const mockRedis = {
        scan: vi
          .fn()
          .mockResolvedValueOnce([1, ["activity:views:act-1"]])
          .mockResolvedValueOnce([0, ["activity:views:act-2"]]),
        mget: vi.fn().mockResolvedValue([5, 10]),
        del: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)
      vi.mocked(prisma.activity.update).mockResolvedValue({} as any)

      const result = await syncViewCountsToDatabase()

      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)
      expect(prisma.activity.update).toHaveBeenCalledTimes(2)
      expect(mockRedis.del).toHaveBeenCalledTimes(2)
    })

    it("应该处理数据库更新失败的情况", async () => {
      const mockRedis = {
        scan: vi
          .fn()
          .mockResolvedValueOnce([1, ["activity:views:act-1"]])
          .mockResolvedValueOnce([0, ["activity:views:act-2"]]),
        mget: vi.fn().mockResolvedValue([5, 10]),
        del: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)
      vi.mocked(prisma.activity.update)
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error("Database error"))

      const result = await syncViewCountsToDatabase()

      expect(result.synced).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].activityId).toBe("act-2")
    })

    it("应该过滤掉计数为 0 的项", async () => {
      const mockRedis = {
        scan: vi
          .fn()
          .mockResolvedValueOnce([1, ["activity:views:act-1"]])
          .mockResolvedValueOnce([0, ["activity:views:act-2"]]),
        mget: vi.fn().mockResolvedValue([5, 0]),
        del: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(true),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)
      vi.mocked(prisma.activity.update).mockResolvedValue({} as any)

      const result = await syncViewCountsToDatabase()

      expect(result.synced).toBe(1)
      expect(prisma.activity.update).toHaveBeenCalledTimes(1)
      expect(prisma.activity.update).toHaveBeenCalledWith({
        where: { id: "act-1" },
        data: { viewsCount: { increment: 5 } },
      })
    })
  })

  describe("getActivityViewCount", () => {
    it("应该返回 Redis + 数据库的总浏览量", async () => {
      const mockRedis = {
        get: vi.fn().mockResolvedValue(5),
      }
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as any)
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({
        viewsCount: 100,
      } as any)

      const count = await getActivityViewCount("activity-1")

      expect(count).toBe(105)
    })

    it("Redis 不可用时应该只返回数据库浏览量", async () => {
      vi.mocked(getRedisClient).mockReturnValue(null)
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({
        viewsCount: 100,
      } as any)

      const count = await getActivityViewCount("activity-1")

      expect(count).toBe(100)
    })

    it("动态不存在时应该返回 0", async () => {
      vi.mocked(getRedisClient).mockReturnValue(null)
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(null)

      const count = await getActivityViewCount("non-existent")

      expect(count).toBe(0)
    })
  })
})
