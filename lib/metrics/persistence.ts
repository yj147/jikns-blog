import { prisma } from "@/lib/prisma"
import { MetricType as DbMetricType, Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"

const BATCH_SIZE = 100
const MAX_QUEUE_SIZE = 200
const FLUSH_INTERVAL_MS = 10_000

type MetricInput = Prisma.PerformanceMetricCreateManyInput

export class MetricsQueue {
  private queue: MetricInput[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private pendingFlush: Promise<void> | null = null

  constructor(private readonly client = prisma) {}

  async enqueue(metric: MetricInput): Promise<void> {
    this.queue.push(this.normalizeMetric(metric))

    if (this.queue.length >= MAX_QUEUE_SIZE || this.queue.length >= BATCH_SIZE) {
      await this.flush()
      return
    }

    this.ensureTimer()
  }

  async flush(): Promise<void> {
    if (this.pendingFlush) {
      return this.pendingFlush.then(() => this.flush())
    }

    if (this.queue.length === 0) {
      this.clearTimer()
      return
    }

    const batch = [...this.queue]
    this.queue = []
    this.clearTimer()

    this.pendingFlush = this.client.performanceMetric
      .createMany({
        data: batch,
      })
      .then(() => {})
      .catch(async (error) => {
        logger.error("性能指标批量写入失败", { count: batch.length }, error as Error)
        if (process.env.NODE_ENV === "development") {
          await this.writeFallback(batch)
        }
      })
      .finally(() => {
        this.pendingFlush = null
      })

    return this.pendingFlush
  }

  async shutdown(): Promise<void> {
    this.clearTimer()
    await this.flush()
  }

  private normalizeMetric(metric: MetricInput): MetricInput {
    return {
      ...metric,
      timestamp: metric.timestamp ?? new Date(),
      tags: metric.tags ?? [],
    }
  }

  private ensureTimer() {
    if (this.flushTimer) {
      return
    }

    this.flushTimer = setTimeout(() => {
      void this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  private clearTimer() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private async writeFallback(batch: MetricInput[]): Promise<void> {
    if (!batch.length || typeof window !== "undefined") {
      return
    }

    try {
      const fs = await import("fs/promises")
      const path = await import("path")
      const metricsDir = path.join(process.cwd(), "logs", "metrics")
      await fs.mkdir(metricsDir, { recursive: true })
      const filePath = path.join(metricsDir, `${this.getDateKey()}.jsonl`)
      const payload = batch.map((item) => JSON.stringify(item)).join("\n") + "\n"
      await fs.appendFile(filePath, payload, "utf8")
    } catch (error) {
      logger.error("性能指标回退写入失败", {}, error as Error)
    }
  }

  private getDateKey(): string {
    return new Date().toISOString().split("T")[0]
  }
}

export interface AggregatedMetricsResult {
  count: number
  sum: number
  min: number
  max: number
}

/**
 * 按时间范围聚合数据库中的性能指标
 */
export async function queryMetrics(
  type: DbMetricType,
  startTime: Date,
  endTime: Date,
  client = prisma
): Promise<AggregatedMetricsResult> {
  try {
    const result = await client.performanceMetric.aggregate({
      where: {
        type,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      _count: { _all: true },
      _sum: { value: true },
      _min: { value: true },
      _max: { value: true },
      _avg: { value: true },
    })

    const count = result._count?._all ?? 0
    const sum = result._sum?.value ?? 0

    return {
      count,
      sum,
      min: count > 0 ? result._min?.value ?? 0 : 0,
      max: count > 0 ? result._max?.value ?? 0 : 0,
    }
  } catch (error) {
    logger.warn("数据库性能指标聚合查询失败，使用空结果回退", {
      type,
      startTime,
      endTime,
      error,
    })
    return { count: 0, sum: 0, min: 0, max: 0 }
  }
}

export const metricsQueue = new MetricsQueue()
