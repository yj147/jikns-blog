import { syncViewCountsToDatabase } from "@/lib/services/view-counter"
import { logger } from "@/lib/utils/logger"

/**
 * 定时同步任务入口
 * 可通过 Vercel Cron Jobs 或其他调度器调用
 */
export async function runViewCountSync() {
  logger.info("开始执行浏览量同步任务")

  const result = await syncViewCountsToDatabase()

  if (result.failed > 0) {
    logger.warn("浏览量同步存在失败项", {
      synced: result.synced,
      failed: result.failed,
      errorSample: result.errors.slice(0, 5), // 只记录前 5 个错误
    })
  }

  return result
}
