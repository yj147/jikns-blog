/**
 * 性能监控配置
 * 统一管理性能阈值，避免硬编码
 *
 * Linus 原则：配置化而非硬编码
 * 之前在 likes.ts 和 bookmarks.ts 中硬编码 100ms，现在统一到这里
 *
 * 稳健性设计：
 * - 配置错误时降级到默认值，不抛出异常
 * - 记录警告日志，便于排查问题
 * - Never break userspace：配置错误不应导致应用启动失败
 */

import { logger } from "@/lib/utils/logger"

/**
 * 默认性能阈值（单位：毫秒）
 */
const DEFAULT_THRESHOLDS = {
  DATABASE_OPERATION: 100,
  API_REQUEST: 500,
  TRIGGER_EXECUTION: 100,
} as const

/**
 * 安全解析环境变量为性能阈值
 * 如果解析失败，返回默认值并记录警告
 *
 * @param envVar - 环境变量值
 * @param defaultValue - 默认值
 * @param name - 阈值名称（用于日志）
 * @returns 解析后的阈值或默认值
 */
function parseThreshold(envVar: string | undefined, defaultValue: number, name: string): number {
  if (!envVar) {
    return defaultValue
  }

  const parsed = parseInt(envVar, 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    logger.warn("性能阈值配置无效，使用默认值", {
      name,
      invalidValue: envVar,
      defaultValue,
      reason: !Number.isInteger(parsed) ? "非整数" : "非正数",
    })
    return defaultValue
  }

  return parsed
}

/**
 * 性能阈值配置（单位：毫秒）
 *
 * 从环境变量读取，解析失败时使用默认值：
 * - DATABASE_OPERATION: 100ms (PERF_THRESHOLD_DB_MS)
 * - API_REQUEST: 500ms (PERF_THRESHOLD_API_MS)
 * - TRIGGER_EXECUTION: 100ms (PERF_THRESHOLD_TRIGGER_MS)
 */
export const PERFORMANCE_THRESHOLDS = {
  /**
   * 数据库操作性能阈值
   * 超过此阈值的操作会记录警告日志
   */
  DATABASE_OPERATION: parseThreshold(
    process.env.PERF_THRESHOLD_DB_MS,
    DEFAULT_THRESHOLDS.DATABASE_OPERATION,
    "DATABASE_OPERATION"
  ),

  /**
   * API 请求性能阈值
   * 超过此阈值的请求会记录警告日志
   */
  API_REQUEST: parseThreshold(
    process.env.PERF_THRESHOLD_API_MS,
    DEFAULT_THRESHOLDS.API_REQUEST,
    "API_REQUEST"
  ),

  /**
   * 触发器执行性能阈值
   * 超过此阈值的触发器执行会记录警告日志
   */
  TRIGGER_EXECUTION: parseThreshold(
    process.env.PERF_THRESHOLD_TRIGGER_MS,
    DEFAULT_THRESHOLDS.TRIGGER_EXECUTION,
    "TRIGGER_EXECUTION"
  ),
} as const
