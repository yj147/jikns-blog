/**
 * 性能监控系统
 * 监控认证请求响应时间、权限验证性能和错误率统计
 */

import { logger } from "./utils/logger"

/**
 * 性能指标类型
 */
export enum MetricType {
  // 认证相关指标
  AUTH_LOGIN_TIME = "AUTH_LOGIN_TIME",
  AUTH_LOGOUT_TIME = "AUTH_LOGOUT_TIME",
  AUTH_SESSION_CHECK_TIME = "AUTH_SESSION_CHECK_TIME",
  AUTH_TOKEN_VALIDATION_TIME = "AUTH_TOKEN_VALIDATION_TIME",

  // OAuth 相关指标
  OAUTH_CALLBACK_TIME = "OAUTH_CALLBACK_TIME",
  OAUTH_TOKEN_EXCHANGE_TIME = "OAUTH_TOKEN_EXCHANGE_TIME",

  // 权限验证指标
  PERMISSION_CHECK_TIME = "PERMISSION_CHECK_TIME",
  ROLE_VALIDATION_TIME = "ROLE_VALIDATION_TIME",
  ADMIN_PERMISSION_TIME = "ADMIN_PERMISSION_TIME",

  // 数据库相关指标
  DB_USER_QUERY_TIME = "DB_USER_QUERY_TIME",
  DB_USER_UPDATE_TIME = "DB_USER_UPDATE_TIME",
  DB_CONNECTION_TIME = "DB_CONNECTION_TIME",

  // API 响应时间
  API_RESPONSE_TIME = "API_RESPONSE_TIME",

  // 错误指标
  ERROR_RATE = "ERROR_RATE",
  FAILURE_RATE = "FAILURE_RATE",

  // 关注与社交操作指标
  FOLLOW_ACTION_DURATION = "FOLLOW_ACTION_DURATION",
  FOLLOW_AUTH_REJECTED = "FOLLOW_AUTH_REJECTED",
  FOLLOW_RATE_LIMITED = "FOLLOW_RATE_LIMITED",
  FOLLOW_ACTION_RATE_LIMIT = "FOLLOW_ACTION_RATE_LIMIT",
  FEED_FOLLOWING_RESULT_COUNT = "FEED_FOLLOWING_RESULT_COUNT",

  // 动态与活动指标
  ACTIVITY_RATE_LIMIT_CHECK = "ACTIVITY_RATE_LIMIT_CHECK",
  ACTIVITY_SEARCH_DURATION = "ACTIVITY_SEARCH_DURATION",

  // 搜索指标
  SEARCH_CONTENT_DURATION = "SEARCH_CONTENT_DURATION",
  SEARCH_SUGGESTION_DURATION = "SEARCH_SUGGESTION_DURATION",
  SEARCH_AUTHOR_CANDIDATE_DURATION = "SEARCH_AUTHOR_CANDIDATE_DURATION",
  SEARCH_REPO_FALLBACK_TRIGGERED = "SEARCH_REPO_FALLBACK_TRIGGERED",

  // 互动（点赞/收藏/评论）限流指标
  LIKE_RATE_LIMIT_CHECK = "LIKE_RATE_LIMIT_CHECK",
  BOOKMARK_RATE_LIMIT_CHECK = "BOOKMARK_RATE_LIMIT_CHECK",
  COMMENT_RATE_LIMIT_CHECK = "COMMENT_RATE_LIMIT_CHECK",

  // 通用自定义指标
  CUSTOM = "CUSTOM",
}

/**
 * 性能指标条目
 */
export interface PerformanceMetric {
  id?: string
  type: MetricType
  value: number
  unit: "ms" | "count" | "percent"
  timestamp: Date
  context?: {
    userId?: string
    method?: string
    endpoint?: string
    userAgent?: string
    ip?: string
    additionalData?: Record<string, any>
  }
  tags?: string[]
}

/**
 * 性能统计信息
 */
export interface PerformanceStats {
  metricType: MetricType
  count: number
  average: number
  min: number
  max: number
  p50: number // 中位数
  p90: number
  p95: number
  p99: number
  errorRate: number
  timeRange: {
    start: Date
    end: Date
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, { start: number; context?: any }> = new Map()
  private isFlushingMetrics = false

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * 开始计时
   */
  startTimer(id: string, context?: any): void {
    this.timers.set(id, {
      start: performance.now(),
      context,
    })
  }

  /**
   * 结束计时并记录指标
   */
  endTimer(id: string, type: MetricType, additionalContext?: any): number | null {
    const timer = this.timers.get(id)
    if (!timer) {
      logger.warn("计时器不存在", { module: "PerformanceMonitor", id })
      return null
    }

    const duration = performance.now() - timer.start
    this.timers.delete(id)

    this.recordMetric({
      type,
      value: duration,
      unit: "ms",
      timestamp: new Date(),
      context: {
        ...timer.context,
        ...additionalContext,
      },
    })

    return duration
  }

  /**
   * 记录性能指标
   */
  recordMetric(metric: Omit<PerformanceMetric, "id">): void {
    const metricWithId: PerformanceMetric = {
      id: this.generateMetricId(),
      ...metric,
    }

    this.metrics.push(metricWithId)

    // 定期刷新指标到存储
    if (this.metrics.length >= 100) {
      this.flushMetrics()
    }
  }

  /**
   * 记录错误率指标
   */
  recordError(context?: {
    type?: string
    endpoint?: string
    userId?: string
    errorCode?: string
  }): void {
    this.recordMetric({
      type: MetricType.ERROR_RATE,
      value: 1,
      unit: "count",
      timestamp: new Date(),
      context,
    })
  }

  /**
   * 记录 API 响应时间
   */
  recordApiResponse(
    endpoint: string,
    method: string,
    duration: number,
    success: boolean,
    userId?: string
  ): void {
    this.recordMetric({
      type: MetricType.API_RESPONSE_TIME,
      value: duration,
      unit: "ms",
      timestamp: new Date(),
      context: {
        endpoint,
        method,
        userId,
        // success: success.toString() // 移除此属性避免类型错误
        additionalData: { success: success.toString() },
      },
      tags: [success ? "success" : "failure"],
    })
  }

  /**
   * 获取性能统计
   */
  async getStats(
    metricType: MetricType,
    timeRange: { start: Date; end: Date }
  ): Promise<PerformanceStats> {
    const filteredMetrics = this.metrics.filter(
      (metric) =>
        metric.type === metricType &&
        metric.timestamp >= timeRange.start &&
        metric.timestamp <= timeRange.end
    )

    if (filteredMetrics.length === 0) {
      return {
        metricType,
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        errorRate: 0,
        timeRange,
      }
    }

    const values = filteredMetrics.map((m) => m.value).sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((a, b) => a + b, 0)

    // 计算百分位数
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1
      return values[Math.max(0, index)]
    }

    // 计算错误率
    const errorCount = filteredMetrics.filter(
      (m) => m.context?.additionalData?.success === "false" || m.tags?.includes("failure")
    ).length
    const errorRate = count > 0 ? (errorCount / count) * 100 : 0

    return {
      metricType,
      count,
      average: sum / count,
      min: Math.min(...values),
      max: Math.max(...values),
      p50: getPercentile(50),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99),
      errorRate,
      timeRange,
    }
  }

  /**
   * 获取实时性能概览
   */
  async getRealTimeOverview(): Promise<{
    activeTimers: number
    totalMetrics: number
    recentErrors: number
    averageResponseTime: number
    slowRequests: number
  }> {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    const recentMetrics = this.metrics.filter((m) => m.timestamp >= fiveMinutesAgo)

    const recentErrors = recentMetrics.filter((m) => m.type === MetricType.ERROR_RATE).length

    const apiResponseMetrics = recentMetrics.filter((m) => m.type === MetricType.API_RESPONSE_TIME)

    const averageResponseTime =
      apiResponseMetrics.length > 0
        ? apiResponseMetrics.reduce((sum, m) => sum + m.value, 0) / apiResponseMetrics.length
        : 0

    const slowRequests = apiResponseMetrics.filter(
      (m) => m.value > 1000 // 大于 1 秒的请求
    ).length

    return {
      activeTimers: this.timers.size,
      totalMetrics: this.metrics.length,
      recentErrors,
      averageResponseTime,
      slowRequests,
    }
  }

  /**
   * 获取性能报告
   */
  async getPerformanceReport(hours: number = 24): Promise<{
    summary: {
      totalRequests: number
      averageResponseTime: number
      errorRate: number
      slowRequestsRate: number
    }
    authMetrics: {
      loginTime: PerformanceStats
      sessionCheckTime: PerformanceStats
      permissionCheckTime: PerformanceStats
    }
    topSlowEndpoints: Array<{
      endpoint: string
      averageTime: number
      requestCount: number
    }>
    errorBreakdown: Array<{
      type: string
      count: number
      percentage: number
    }>
  }> {
    const now = new Date()
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000)
    const timeRange = { start: startTime, end: now }

    // 获取各类指标的统计
    const [loginStats, sessionStats, permissionStats] = await Promise.all([
      this.getStats(MetricType.AUTH_LOGIN_TIME, timeRange),
      this.getStats(MetricType.AUTH_SESSION_CHECK_TIME, timeRange),
      this.getStats(MetricType.PERMISSION_CHECK_TIME, timeRange),
    ])

    // 获取 API 响应时间统计
    const apiMetrics = this.metrics.filter(
      (m) => m.type === MetricType.API_RESPONSE_TIME && m.timestamp >= startTime
    )

    const totalRequests = apiMetrics.length
    const averageResponseTime =
      totalRequests > 0 ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / totalRequests : 0

    const slowRequests = apiMetrics.filter((m) => m.value > 1000).length
    const slowRequestsRate = totalRequests > 0 ? (slowRequests / totalRequests) * 100 : 0

    const errorMetrics = this.metrics.filter(
      (m) => m.type === MetricType.ERROR_RATE && m.timestamp >= startTime
    )
    const errorRate = totalRequests > 0 ? (errorMetrics.length / totalRequests) * 100 : 0

    // 统计最慢的端点
    const endpointStats = new Map<string, { total: number; count: number }>()
    apiMetrics.forEach((m) => {
      const endpoint = m.context?.endpoint || "unknown"
      const current = endpointStats.get(endpoint) || { total: 0, count: 0 }
      endpointStats.set(endpoint, {
        total: current.total + m.value,
        count: current.count + 1,
      })
    })

    const topSlowEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.total / stats.count,
        requestCount: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)

    // 错误类型分析
    const errorTypeMap = new Map<string, number>()
    errorMetrics.forEach((m) => {
      const errorType = m.context?.additionalData?.type || "unknown"
      errorTypeMap.set(errorType, (errorTypeMap.get(errorType) || 0) + 1)
    })

    const totalErrors = errorMetrics.length
    const errorBreakdown = Array.from(errorTypeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    return {
      summary: {
        totalRequests,
        averageResponseTime,
        errorRate,
        slowRequestsRate,
      },
      authMetrics: {
        loginTime: loginStats,
        sessionCheckTime: sessionStats,
        permissionCheckTime: permissionStats,
      },
      topSlowEndpoints,
      errorBreakdown,
    }
  }

  /**
   * 刷新指标到存储
   */
  private async flushMetrics(): Promise<void> {
    if (this.isFlushingMetrics || this.metrics.length === 0) {
      return
    }

    this.isFlushingMetrics = true

    try {
      const metricsToFlush = [...this.metrics]
      this.metrics = []

      // 在开发环境下输出到控制台
      if (process.env.NODE_ENV === "development") {
        metricsToFlush.forEach((metric) => {
          logger.debug("性能指标", {
            type: metric.type,
            value: metric.value,
            unit: metric.unit,
            timestamp: metric.timestamp.toISOString(),
          })
        })
      }

      // 在生产环境下，应该将指标发送到监控系统
      await this.persistMetrics(metricsToFlush)
    } catch (error) {
      logger.error("性能指标刷新失败", {}, error)
    } finally {
      this.isFlushingMetrics = false
    }
  }

  /**
   * 持久化指标数据
   */
  private async persistMetrics(metrics: PerformanceMetric[]): Promise<void> {
    try {
      // 仅在服务端环境中进行文件操作
      if (typeof window === "undefined") {
        // 这里应该将指标发送到时序数据库或监控系统
        // 目前写入到文件作为备用方案

        const fs = await import("fs/promises")
        const path = await import("path")

        const metricsDir = path.join(process.cwd(), "logs", "metrics")
        const metricsFile = path.join(
          metricsDir,
          `metrics-${new Date().toISOString().split("T")[0]}.json`
        )

        // 确保目录存在
        await fs.mkdir(metricsDir, { recursive: true })

        // 追加指标数据
        const metricsData = metrics.map((m) => JSON.stringify(m)).join("\n") + "\n"
        await fs.appendFile(metricsFile, metricsData, "utf8")
      } else {
        // 客户端环境：可以发送指标到API端点
      }
    } catch (error) {
      logger.error("性能指标持久化失败", {}, error)
    }
  }

  /**
   * 生成指标 ID
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 清理旧指标（用于内存管理）
   */
  cleanupOldMetrics(hoursToKeep: number = 24): void {
    const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000)
    this.metrics = this.metrics.filter((m) => m.timestamp > cutoffTime)
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance()

/**
 * 性能监控装饰器 - 自动监控函数执行时间
 */
export function withPerformanceMonitoring(
  metricType: MetricType,
  getContext?: (args: any[], result: any) => Record<string, any>
) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!

    descriptor.value = async function (...args: T): Promise<R> {
      const timerId = `${target.constructor.name}.${propertyName}_${Date.now()}`
      const monitor = PerformanceMonitor.getInstance()

      monitor.startTimer(timerId)

      try {
        const result = await method.apply(this, args)

        monitor.endTimer(timerId, metricType, {
          ...getContext?.(args, result),
          success: true,
        })

        return result
      } catch (error) {
        monitor.endTimer(timerId, metricType, {
          ...getContext?.(args, undefined),
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })

        // 记录错误
        monitor.recordError({
          type: metricType,
          errorCode: error instanceof Error ? error.constructor.name : "UnknownError",
        })

        throw error
      }
    }
  }
}

/**
 * 性能监控中间件 - 用于 API 路由
 */
export function createPerformanceMiddleware() {
  return async function (request: Request, next: () => Promise<Response>): Promise<Response> {
    const startTime = performance.now()
    const url = new URL(request.url)
    const endpoint = url.pathname
    const method = request.method

    let success = true
    let response: Response

    try {
      response = await next()
      success = response.ok
      return response
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = performance.now() - startTime

      performanceMonitor.recordApiResponse(endpoint, method, duration, success)
    }
  }
}

/**
 * 健康检查端点数据
 */
export async function getHealthCheckData(): Promise<{
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  uptime: number
  performance: {
    averageResponseTime: number
    errorRate: number
    slowRequestsCount: number
  }
  metrics: {
    totalRequests: number
    activeTimers: number
    memoryUsage: NodeJS.MemoryUsage
  }
}> {
  const overview = await performanceMonitor.getRealTimeOverview()
  const report = await performanceMonitor.getPerformanceReport(1) // 最近 1 小时

  // 健康状态判断
  let status: "healthy" | "degraded" | "unhealthy" = "healthy"

  if (report.summary.errorRate > 5 || report.summary.averageResponseTime > 2000) {
    status = "degraded"
  }

  if (report.summary.errorRate > 20 || report.summary.averageResponseTime > 5000) {
    status = "unhealthy"
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    performance: {
      averageResponseTime: report.summary.averageResponseTime,
      errorRate: report.summary.errorRate,
      slowRequestsCount: overview.slowRequests,
    },
    metrics: {
      totalRequests: report.summary.totalRequests,
      activeTimers: overview.activeTimers,
      memoryUsage: process.memoryUsage(),
    },
  }
}
