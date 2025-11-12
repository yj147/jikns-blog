/**
 * 评论 API 指标收集
 * 提供轻量级的 in-memory 计数和时延直方图
 */

export type Operation = "list" | "create" | "delete" | "update"
export type Status = "success" | "failure"

// 时延桶定义 (毫秒)
const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, Infinity]

interface MetricEntry {
  count: number
  lastUpdated: Date
}

interface LatencyEntry {
  values: number[]
  buckets: Map<number, number>
}

class CommentsMetrics {
  // 操作计数器
  private counters: Map<string, MetricEntry> = new Map()

  // 时延记录
  private latencies: Map<string, LatencyEntry> = new Map()

  // 启动时间
  private readonly startTime = Date.now()

  // 生成计数器键
  private getCounterKey(operation: Operation, status: Status): string {
    return `${operation}_${status}`
  }

  // 生成时延键
  private getLatencyKey(operation: Operation): string {
    return `${operation}_latency`
  }

  /**
   * 增加操作计数
   */
  incrementCounter(operation: Operation, status: Status): void {
    const key = this.getCounterKey(operation, status)
    const current = this.counters.get(key) || { count: 0, lastUpdated: new Date() }

    this.counters.set(key, {
      count: current.count + 1,
      lastUpdated: new Date(),
    })
  }

  /**
   * 记录操作时延
   */
  recordLatency(operation: Operation, durationMs: number): void {
    const key = this.getLatencyKey(operation)

    if (!this.latencies.has(key)) {
      this.latencies.set(key, {
        values: [],
        buckets: new Map(LATENCY_BUCKETS.map((b) => [b, 0])),
      })
    }

    const entry = this.latencies.get(key)!

    // 记录原始值 (保留最近 1000 个)
    entry.values.push(durationMs)
    if (entry.values.length > 1000) {
      entry.values.shift()
    }

    // 更新直方图桶
    for (const bucket of LATENCY_BUCKETS) {
      if (durationMs <= bucket) {
        entry.buckets.set(bucket, (entry.buckets.get(bucket) || 0) + 1)
        break
      }
    }
  }

  /**
   * 获取计数器值
   */
  getCounter(operation: Operation, status: Status): number {
    const key = this.getCounterKey(operation, status)
    return this.counters.get(key)?.count || 0
  }

  /**
   * 计算 QPS (每秒查询数)
   */
  getQPS(operation: Operation): number {
    const successCount = this.getCounter(operation, "success")
    const failureCount = this.getCounter(operation, "failure")
    const totalCount = successCount + failureCount

    const uptimeSeconds = (Date.now() - this.startTime) / 1000
    return uptimeSeconds > 0 ? totalCount / uptimeSeconds : 0
  }

  /**
   * 计算时延百分位数
   */
  getPercentile(operation: Operation, percentile: number): number | null {
    const key = this.getLatencyKey(operation)
    const entry = this.latencies.get(key)

    if (!entry || entry.values.length === 0) {
      return null
    }

    const sorted = [...entry.values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * 获取 P50 (中位数)
   */
  getP50(operation: Operation): number | null {
    return this.getPercentile(operation, 50)
  }

  /**
   * 获取 P95
   */
  getP95(operation: Operation): number | null {
    return this.getPercentile(operation, 95)
  }

  /**
   * 获取 P99
   */
  getP99(operation: Operation): number | null {
    return this.getPercentile(operation, 99)
  }

  /**
   * 获取平均时延
   */
  getAverageLatency(operation: Operation): number | null {
    const key = this.getLatencyKey(operation)
    const entry = this.latencies.get(key)

    if (!entry || entry.values.length === 0) {
      return null
    }

    const sum = entry.values.reduce((acc, val) => acc + val, 0)
    return sum / entry.values.length
  }

  /**
   * 获取时延分布
   */
  getLatencyDistribution(operation: Operation): Map<number, number> | null {
    const key = this.getLatencyKey(operation)
    const entry = this.latencies.get(key)

    return entry ? new Map(entry.buckets) : null
  }

  /**
   * 获取所有指标摘要
   */
  getSummary(): Record<string, any> {
    const operations: Operation[] = ["list", "create", "delete", "update"]
    const summary: Record<string, any> = {
      uptime: `${((Date.now() - this.startTime) / 1000).toFixed(1)}s`,
      counters: {},
      qps: {},
      latencies: {},
    }

    for (const op of operations) {
      // 计数器
      summary.counters[op] = {
        success: this.getCounter(op, "success"),
        failure: this.getCounter(op, "failure"),
      }

      // QPS
      summary.qps[op] = parseFloat(this.getQPS(op).toFixed(2))

      // 时延
      const p50 = this.getP50(op)
      const p95 = this.getP95(op)
      const p99 = this.getP99(op)
      const avg = this.getAverageLatency(op)

      if (p50 !== null) {
        summary.latencies[op] = {
          p50: p50.toFixed(2),
          p95: p95?.toFixed(2) || "N/A",
          p99: p99?.toFixed(2) || "N/A",
          avg: avg?.toFixed(2) || "N/A",
        }
      }
    }

    return summary
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    this.counters.clear()
    this.latencies.clear()
  }

  /**
   * 导出 Prometheus 格式指标
   */
  toPrometheusFormat(): string {
    const lines: string[] = []
    const operations: Operation[] = ["list", "create", "delete", "update"]

    // 计数器
    lines.push("# HELP comments_operations_total Total number of comment operations")
    lines.push("# TYPE comments_operations_total counter")
    for (const op of operations) {
      for (const status of ["success", "failure"] as Status[]) {
        const count = this.getCounter(op, status)
        lines.push(`comments_operations_total{operation="${op}",status="${status}"} ${count}`)
      }
    }

    // 时延直方图
    lines.push("")
    lines.push(
      "# HELP comments_operation_duration_milliseconds Comment operation duration in milliseconds"
    )
    lines.push("# TYPE comments_operation_duration_milliseconds histogram")
    for (const op of operations) {
      const distribution = this.getLatencyDistribution(op)
      if (distribution) {
        for (const [bucket, count] of distribution) {
          if (bucket === Infinity) {
            lines.push(
              `comments_operation_duration_milliseconds_bucket{operation="${op}",le="+Inf"} ${count}`
            )
          } else {
            lines.push(
              `comments_operation_duration_milliseconds_bucket{operation="${op}",le="${bucket}"} ${count}`
            )
          }
        }

        const entry = this.latencies.get(this.getLatencyKey(op))
        if (entry) {
          const sum = entry.values.reduce((acc, val) => acc + val, 0)
          lines.push(`comments_operation_duration_milliseconds_sum{operation="${op}"} ${sum}`)
          lines.push(
            `comments_operation_duration_milliseconds_count{operation="${op}"} ${entry.values.length}`
          )
        }
      }
    }

    return lines.join("\n")
  }
}

// 单例实例
export const commentsMetrics = new CommentsMetrics()

// 便捷函数：计时器
export function measureOperation<T>(
  operation: Operation,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now()

  try {
    const result = fn()

    // 处理 Promise
    if (result instanceof Promise) {
      return result
        .then((value) => {
          const duration = performance.now() - start
          commentsMetrics.recordLatency(operation, duration)
          commentsMetrics.incrementCounter(operation, "success")
          return value
        })
        .catch((error) => {
          const duration = performance.now() - start
          commentsMetrics.recordLatency(operation, duration)
          commentsMetrics.incrementCounter(operation, "failure")
          throw error
        })
    }

    // 同步结果
    const duration = performance.now() - start
    commentsMetrics.recordLatency(operation, duration)
    commentsMetrics.incrementCounter(operation, "success")
    return result
  } catch (error) {
    const duration = performance.now() - start
    commentsMetrics.recordLatency(operation, duration)
    commentsMetrics.incrementCounter(operation, "failure")
    throw error
  }
}

// 导出类型
export type { MetricEntry, LatencyEntry }
