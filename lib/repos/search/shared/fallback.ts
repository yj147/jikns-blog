/**
 * 搜索降级策略高阶函数
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { createLogger } from "@/lib/utils/logger"

const searchLogger = createLogger("search-repo")

/**
 * 高阶函数：为搜索函数添加降级策略
 *
 * 当主搜索函数（通常是全文搜索）失败时，自动降级到备用搜索函数（通常是 LIKE 查询）
 *
 * @param mainSearch - 主搜索函数（全文搜索）
 * @param fallbackSearch - 降级搜索函数（LIKE 查询）
 * @param loggerContext - 日志上下文（如 "文章"、"动态"、"用户"）
 * @returns 包装后的搜索函数
 *
 * @example
 * ```typescript
 * export const searchPosts = withFallback(
 *   executeSearchPostsMain,
 *   executeSearchPostsFallback,
 *   "文章"
 * )
 * ```
 */
export function withFallback<TParams, TResult>(
  mainSearch: (params: TParams) => Promise<TResult>,
  fallbackSearch: (params: TParams) => Promise<TResult>,
  loggerContext: string
): (params: TParams) => Promise<TResult> {
  return async (params: TParams): Promise<TResult> => {
    try {
      return await mainSearch(params)
    } catch (error) {
      searchLogger.warn(`${loggerContext}全文搜索失败，降级到 LIKE 查询`, {
        params,
        error: error instanceof Error ? error.message : String(error),
        fallback: "LIKE",
      })
      performanceMonitor.recordMetric({
        type: MetricType.SEARCH_REPO_FALLBACK_TRIGGERED,
        value: 1,
        unit: "count",
        timestamp: new Date(),
        context: {
          additionalData: {
            model: loggerContext,
          },
        },
      })
      return await fallbackSearch(params)
    }
  }
}
