import { getRedisClient } from "@/lib/rate-limit/redis-client"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
import type { Redis } from "@upstash/redis"

const REDIS_KEY_PREFIX = "activity:views:"
const SYNC_BATCH_SIZE = 100
const REDIS_TTL_DAYS = 7

/**
 * 增加动态浏览量
 * 优先使用 Redis 缓存，降级到直接数据库写入
 */
export async function incrementActivityViewCount(activityId: string): Promise<void> {
  const redis = getRedisClient()

  if (redis) {
    try {
      const key = `${REDIS_KEY_PREFIX}${activityId}`
      await redis.incr(key)
      // 设置 7 天过期，防止 Redis 内存泄漏
      await redis.expire(key, 60 * 60 * 24 * REDIS_TTL_DAYS)
      return
    } catch (error) {
      logger.warn("Redis 浏览量计数失败，降级到数据库", {
        activityId,
        error: error instanceof Error ? error.message : String(error),
      })
      // 降级到数据库写入
    }
  }

  // Redis 不可用或失败，直接写数据库
  try {
    await prisma.activity.update({
      where: { id: activityId },
      data: { viewsCount: { increment: 1 } },
    })
  } catch (error) {
    // 记录错误但不抛出，避免影响主流程
    logger.error(
      "数据库浏览量更新失败",
      {
        activityId,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * 使用 SCAN 迭代 Redis 键，避免阻塞
 * 注意：Upstash Redis 的 scan 方法返回格式与标准 Redis 不同
 */
async function* scanRedisKeys(
  redis: Redis,
  pattern: string,
  count: number = 100
): AsyncGenerator<string[]> {
  let cursor: string | number = 0
  do {
    const result: [string | number, string[]] = await redis.scan(cursor, {
      match: pattern,
      count,
    })
    cursor = typeof result[0] === "string" ? parseInt(result[0]) : result[0]
    const keys = result[1]
    if (keys.length > 0) {
      yield keys
    }
  } while (cursor !== 0)
}

/**
 * 同步 Redis 中的浏览量到数据库
 * 由定时任务调用
 */
export async function syncViewCountsToDatabase(): Promise<{
  synced: number
  failed: number
  errors: Array<{ activityId: string; error: string }>
}> {
  const redis = getRedisClient()
  if (!redis) {
    logger.warn("Redis 不可用，跳过浏览量同步")
    return { synced: 0, failed: 0, errors: [] }
  }

  const startTime = Date.now()
  let synced = 0
  let failed = 0
  const errors: Array<{ activityId: string; error: string }> = []

  try {
    // 使用 SCAN 扫描所有浏览量键（避免阻塞 Redis）
    const allKeys: string[] = []
    for await (const keys of scanRedisKeys(redis, `${REDIS_KEY_PREFIX}*`)) {
      allKeys.push(...keys)
    }

    if (allKeys.length === 0) {
      logger.debug("没有待同步的浏览量数据")
      return { synced: 0, failed: 0, errors: [] }
    }

    const keys = allKeys

    logger.info(`开始同步 ${keys.length} 个动态的浏览量`)

    // 分批处理
    for (let i = 0; i < keys.length; i += SYNC_BATCH_SIZE) {
      const batch = keys.slice(i, i + SYNC_BATCH_SIZE)

      // 批量获取计数
      const counts = (await redis.mget(...batch)) as Array<number | string | null>

      // 构建更新操作
      const updates = batch
        .map((key, index) => {
          const activityId = key.replace(REDIS_KEY_PREFIX, "")
          const rawCount = counts[index]
          const numeric =
            typeof rawCount === "number" ? rawCount : Number.parseInt(String(rawCount ?? "0"), 10)
          const count = Number.isFinite(numeric) ? numeric : 0
          return {
            activityId,
            count,
          }
        })
        .filter((item) => item.count > 0)

      // 批量更新数据库
      for (const { activityId, count } of updates) {
        try {
          await prisma.activity.update({
            where: { id: activityId },
            data: { viewsCount: { increment: count } },
          })

          // 更新成功，删除 Redis 键
          await redis.del(`${REDIS_KEY_PREFIX}${activityId}`)
          synced++
        } catch (error) {
          failed++
          const errorMsg = error instanceof Error ? error.message : String(error)
          errors.push({ activityId, error: errorMsg })

          // 失败时设置 1 小时 TTL，下次同步时重试
          try {
            await redis.expire(`${REDIS_KEY_PREFIX}${activityId}`, 3600)
          } catch (expireError) {
            logger.warn("设置失败键 TTL 失败", { activityId })
          }

          logger.error("同步浏览量失败", {
            activityId,
            count,
            error: errorMsg,
          })
        }
      }
    }

    const duration = Date.now() - startTime
    logger.info("浏览量同步完成", {
      synced,
      failed,
      duration: `${duration}ms`,
      totalKeys: keys.length,
    })

    return { synced, failed, errors }
  } catch (error) {
    logger.error(
      "浏览量同步任务失败",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    )
    return { synced, failed, errors }
  }
}

/**
 * 获取动态的实时浏览量（Redis + 数据库）
 */
export async function getActivityViewCount(activityId: string): Promise<number> {
  const redis = getRedisClient()
  let redisCount = 0

  if (redis) {
    try {
      const cached = await redis.get<number>(`${REDIS_KEY_PREFIX}${activityId}`)
      redisCount = typeof cached === "number" ? cached : parseInt(String(cached) || "0")
    } catch (error) {
      logger.warn("读取 Redis 浏览量失败", { activityId })
    }
  }

  // 从数据库读取基准值
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { viewsCount: true },
  })

  const dbCount = activity?.viewsCount || 0
  return dbCount + redisCount
}
