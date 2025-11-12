/**
 * 中间件性能观测模块
 * 提供响应时间、认证失败率、API P95等关键指标
 */

import { NextRequest } from "next/server"
import { logger } from "@/lib/utils/logger"

// 存储性能指标的内存缓存（生产环境应使用持久化存储）
class PerformanceMetrics {
  private metrics: Map<string, number[]> = new Map()
  private authFailures: number = 0
  private authAttempts: number = 0
  private apiLatencies: number[] = []
  private publicPageLatencies: number[] = []

  // 记录响应时间
  recordResponseTime(path: string, duration: number) {
    const key = this.getPathCategory(path)

    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }

    const times = this.metrics.get(key)!
    times.push(duration)

    // 保留最近1000条记录避免内存溢出
    if (times.length > 1000) {
      times.shift()
    }

    // 分类记录
    if (path.startsWith("/api/")) {
      this.apiLatencies.push(duration)
      if (this.apiLatencies.length > 1000) {
        this.apiLatencies.shift()
      }
    } else {
      this.publicPageLatencies.push(duration)
      if (this.publicPageLatencies.length > 1000) {
        this.publicPageLatencies.shift()
      }
    }
  }

  // 记录认证结果
  recordAuthResult(success: boolean) {
    this.authAttempts++
    if (!success) {
      this.authFailures++
    }
  }

  // 获取路径分类
  private getPathCategory(path: string): string {
    if (path.startsWith("/api/")) return "api"
    if (path.startsWith("/admin/")) return "admin"
    if (path.startsWith("/blog/")) return "blog"
    if (path.startsWith("/auth/")) return "auth"
    return "public"
  }

  // 计算P95延迟
  private calculateP95(latencies: number[]): number {
    if (latencies.length === 0) return 0

    const sorted = [...latencies].sort((a, b) => a - b)
    const index = Math.floor(sorted.length * 0.95)
    return sorted[index] || 0
  }

  // 获取当前指标
  getMetrics() {
    const authFailureRate =
      this.authAttempts > 0 ? ((this.authFailures / this.authAttempts) * 100).toFixed(2) : "0.00"

    return {
      publicPageAvgTime: this.calculateAverage(this.publicPageLatencies),
      apiAvgTime: this.calculateAverage(this.apiLatencies),
      apiP95: this.calculateP95(this.apiLatencies),
      authFailureRate: parseFloat(authFailureRate),
      authAttempts: this.authAttempts,
      authFailures: this.authFailures,
      categorizedMetrics: this.getCategorizedMetrics(),
    }
  }

  // 计算平均值
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    const sum = values.reduce((acc, val) => acc + val, 0)
    return Math.round((sum / values.length) * 100) / 100
  }

  // 获取分类指标
  private getCategorizedMetrics() {
    const result: Record<string, any> = {}

    for (const [category, times] of this.metrics.entries()) {
      result[category] = {
        count: times.length,
        avg: this.calculateAverage(times),
        p95: this.calculateP95(times),
        min: Math.min(...times),
        max: Math.max(...times),
      }
    }

    return result
  }

  // 重置指标（用于测试或定期清理）
  reset() {
    this.metrics.clear()
    this.authFailures = 0
    this.authAttempts = 0
    this.apiLatencies = []
    this.publicPageLatencies = []
  }
}

// 单例实例
export const performanceMetrics = new PerformanceMetrics()

/**
 * 中间件观测装饰器
 * 自动记录请求处理时间和状态
 */
export function observeMiddleware(
  request: NextRequest,
  handler: () => Promise<Response>
): Promise<Response> {
  const startTime = performance.now()
  const pathname = request.nextUrl.pathname

  return handler()
    .then((response) => {
      const duration = performance.now() - startTime
      performanceMetrics.recordResponseTime(pathname, duration)

      // 记录认证相关的响应
      if (pathname.startsWith("/api/") && response.status === 401) {
        performanceMetrics.recordAuthResult(false)
      } else if (pathname.startsWith("/api/auth/") && response.status === 200) {
        performanceMetrics.recordAuthResult(true)
      }

      // 在开发环境输出性能日志
      if (process.env.NODE_ENV === "development" && duration > 100) {
        logger.warn("Slow request detected", { pathname, duration: duration.toFixed(2) })
      }

      return response
    })
    .catch((error) => {
      const duration = performance.now() - startTime
      performanceMetrics.recordResponseTime(pathname, duration)
      throw error
    })
}

/**
 * 获取观测报告
 */
export function getObservabilityReport() {
  const metrics = performanceMetrics.getMetrics()

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      "公开页响应时间(ms)": metrics.publicPageAvgTime,
      "API响应时间(ms)": metrics.apiAvgTime,
      "API P95延迟(ms)": metrics.apiP95,
      "认证失败率(%)": metrics.authFailureRate,
      认证尝试次数: metrics.authAttempts,
      认证失败次数: metrics.authFailures,
    },
    details: metrics.categorizedMetrics,
    summary: generateSummary(metrics),
  }
}

/**
 * 生成性能摘要
 */
function generateSummary(metrics: ReturnType<typeof performanceMetrics.getMetrics>) {
  const warnings: string[] = []

  if (metrics.publicPageAvgTime > 500) {
    warnings.push(`⚠️ 公开页面响应较慢: ${metrics.publicPageAvgTime}ms`)
  }

  if (metrics.apiP95 > 1000) {
    warnings.push(`⚠️ API P95延迟过高: ${metrics.apiP95}ms`)
  }

  if (metrics.authFailureRate > 10) {
    warnings.push(`⚠️ 认证失败率偏高: ${metrics.authFailureRate}%`)
  }

  return {
    status: warnings.length === 0 ? "✅ 正常" : "⚠️ 需要关注",
    warnings,
  }
}

/**
 * 导出性能指标到控制台（用于调试）
 */
export function logPerformanceMetrics() {
  const report = getObservabilityReport()

  logger.info("中间件性能报告", {
    timestamp: report.timestamp,
    metrics: report.metrics,
    status: report.summary.status,
    warnings: report.summary.warnings,
  })
}

// 定期输出性能报告（开发环境）
if (process.env.NODE_ENV === "development") {
  setInterval(() => {
    const metrics = performanceMetrics.getMetrics()
    // 只有在有数据时才输出
    if (metrics.authAttempts > 0 || metrics.apiAvgTime > 0) {
      logPerformanceMetrics()
    }
  }, 60000) // 每分钟输出一次
}
