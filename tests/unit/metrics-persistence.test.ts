import fs from "fs/promises"
import path from "path"
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"
import { MetricsQueue, queryMetrics } from "@/lib/metrics/persistence"
import { MetricType, Prisma } from "@/lib/generated/prisma"
import {
  PerformanceMonitor,
  MetricType as MonitorMetricType,
  type PerformanceMetric,
} from "@/lib/performance-monitor"
import { logger } from "@/lib/utils/logger"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    performanceMetric: {
      createMany: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

const createMetric = (
  overrides: Partial<Prisma.PerformanceMetricCreateManyInput> = {}
): Prisma.PerformanceMetricCreateManyInput => ({
  type: MetricType.api_response,
  value: 120,
  unit: "ms",
  timestamp: new Date("2025-01-01T00:00:00.000Z"),
  tags: [],
  ...overrides,
})

const createMockClient = () => {
  return {
    performanceMetric: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  }
}

const createDeferred = () => {
  let resolve!: () => void
  let _reject!: (error?: any) => void

  const promise = new Promise<void>((res, rej) => {
    resolve = res
    _reject = rej
  })

  return { promise, resolve }
}

describe("MetricsQueue", () => {
  const metricsDir = path.join(process.cwd(), "logs", "metrics")
  const fallbackFile = path.join(metricsDir, `${new Date().toISOString().split("T")[0]}.jsonl`)
  const originalEnv = process.env.NODE_ENV
  let originalWindow: any

  beforeEach(async () => {
    vi.useFakeTimers()
    originalWindow = (globalThis as any).window
    await fs.rm(metricsDir, { recursive: true, force: true })
  })

  afterEach(() => {
    ;(globalThis as any).window = originalWindow
    vi.useRealTimers()
    process.env.NODE_ENV = originalEnv
  })

  it("队列达到 100 条阈值时自动触发批量写入", async () => {
    const client = createMockClient()
    const queue = new MetricsQueue(client as any)

    for (let i = 0; i < 100; i++) {
      await queue.enqueue(createMetric({ value: i }))
    }

    expect(client.performanceMetric.createMany).toHaveBeenCalledTimes(1)
    const args = client.performanceMetric.createMany.mock.calls[0][0]
    expect(args.data).toHaveLength(100)
  })

  it("pending flush 未完成时复用同一 promise 并在完成后继续写入", async () => {
    const deferred = createDeferred()
    const client = {
      performanceMetric: {
        createMany: vi.fn().mockImplementation(() => deferred.promise),
      },
    }
    const queue = new MetricsQueue(client as any)

    await queue.enqueue(createMetric({ value: 1 }))
    const firstFlush = queue.flush()

    await queue.enqueue(createMetric({ value: 2 }))
    const secondFlush = queue.flush()

    expect(client.performanceMetric.createMany).toHaveBeenCalledTimes(1)

    deferred.resolve()
    await firstFlush
    await secondFlush

    expect(client.performanceMetric.createMany).toHaveBeenCalledTimes(2)
    const secondBatch = client.performanceMetric.createMany.mock.calls[1][0].data
    expect(secondBatch).toHaveLength(1)
    expect(secondBatch[0].value).toBe(2)
  })

  it("未达到阈值时 10 秒超时触发写入", async () => {
    const client = createMockClient()
    const queue = new MetricsQueue(client as any)

    await queue.enqueue(createMetric())
    expect(client.performanceMetric.createMany).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(10_000)

    expect(client.performanceMetric.createMany).toHaveBeenCalledTimes(1)
    const args = client.performanceMetric.createMany.mock.calls[0][0]
    expect(args.data).toHaveLength(1)
  })

  it("数据库写入失败时在开发环境回退到本地文件", async () => {
    process.env.NODE_ENV = "development"
    const client = createMockClient()
    client.performanceMetric.createMany.mockRejectedValue(new Error("db down"))
    const queue = new MetricsQueue(client as any)

    const savedWindow = (globalThis as any).window
    // @ts-expect-error - 模拟 Node 环境触发文件回退
    ;(globalThis as any).window = undefined

    await queue.enqueue(createMetric({ requestId: "req-1" }))
    await queue.flush()

    ;(globalThis as any).window = savedWindow

    const exists = await fs
      .access(fallbackFile)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(true)

    const content = await fs.readFile(fallbackFile, "utf8")
    expect(content.trim().length).toBeGreaterThan(0)
    const [firstLine] = content.trim().split("\n")
    const parsed = JSON.parse(firstLine)
    expect(parsed.requestId).toBe("req-1")
  })

  it("浏览器环境或空批次会跳过回退写入", async () => {
    const client = createMockClient()
    const queue = new MetricsQueue(client as any)

    await (queue as any).writeFallback([])
    await (queue as any).writeFallback([createMetric({ requestId: "skip-window" })])

    const exists = await fs
      .access(fallbackFile)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(false)
  })

  it("回退写入失败时记录错误并吞掉异常", async () => {
    process.env.NODE_ENV = "development"
    const client = createMockClient()
    const queue = new MetricsQueue(client as any)
    const savedWindow = (globalThis as any).window
    // @ts-expect-error - 模拟 Node 环境
    ;(globalThis as any).window = undefined

    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {})
    ;(queue as any).getDateKey = () => {
      throw new Error("date broken")
    }

    await queue.enqueue(createMetric({ requestId: "req-error" }))
    await expect(
      (queue as any).writeFallback([createMetric({ requestId: "req-error" })])
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      "性能指标回退写入失败",
      {},
      expect.any(Error)
    )

    errorSpy.mockRestore()
    ;(globalThis as any).window = savedWindow
  })

  it("shutdown 会清空队列并触发最终写入", async () => {
    const client = createMockClient()
    const queue = new MetricsQueue(client as any)

    await queue.enqueue(createMetric({ value: 1 }))
    await queue.shutdown()

    expect(client.performanceMetric.createMany).toHaveBeenCalledTimes(1)

    await queue.flush()
    expect(client.performanceMetric.createMany).toHaveBeenCalledTimes(1)
  })

  it("缺失时间戳和标签时写入批次会自动补全默认值", async () => {
    vi.setSystemTime(new Date("2025-02-02T00:00:00.000Z"))
    const client = createMockClient()
    const queue = new MetricsQueue(client as any)

    await queue.enqueue(
      createMetric({ timestamp: undefined as any, tags: undefined, value: 42, unit: "ms" })
    )
    await queue.flush()

    const written = client.performanceMetric.createMany.mock.calls[0][0].data[0]
    expect(written.timestamp).toEqual(new Date("2025-02-02T00:00:00.000Z"))
    expect(written.tags).toEqual([])
    expect(written.value).toBe(42)
  })
})

describe("queryMetrics", () => {
  it("使用 Prisma aggregate 聚合指标", async () => {
    const start = new Date("2025-01-01T00:00:00.000Z")
    const end = new Date("2025-01-02T00:00:00.000Z")
    const aggregate = vi.fn().mockResolvedValue({
      _count: { _all: 3 },
      _sum: { value: 30 },
      _min: { value: 5 },
      _max: { value: 15 },
      _avg: { value: 10 },
    })
    const client = { performanceMetric: { aggregate } }

    const result = await queryMetrics(MetricType.api_response, start, end, client as any)

    expect(aggregate).toHaveBeenCalledWith({
      where: { type: MetricType.api_response, timestamp: { gte: start, lte: end } },
      _count: { _all: true },
      _sum: { value: true },
      _min: { value: true },
      _max: { value: true },
      _avg: { value: true },
    })
    expect(result).toEqual({ count: 3, sum: 30, min: 5, max: 15 })
  })

  it("无记录时返回 0 并忽略最小/最大占位", async () => {
    const aggregate = vi.fn().mockResolvedValue({
      _count: { _all: 0 },
      _sum: { value: null },
      _min: { value: 5 },
      _max: { value: 10 },
    })
    const client = { performanceMetric: { aggregate } }

    const result = await queryMetrics(
      MetricType.api_response,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-01-02T00:00:00.000Z"),
      client as any
    )

    expect(result).toEqual({ count: 0, sum: 0, min: 0, max: 0 })
  })

  it("查询失败时返回空聚合结果", async () => {
    const aggregate = vi.fn().mockRejectedValue(new Error("db down"))
    const client = { performanceMetric: { aggregate } }

    const result = await queryMetrics(
      MetricType.api_response,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-01-02T00:00:00.000Z"),
      client as any
    )

    expect(result).toEqual({ count: 0, sum: 0, min: 0, max: 0 })
  })
})

describe("PerformanceMonitor 混合数据源", () => {
  const now = new Date("2025-11-30T12:00:00.000Z")
  let monitor: PerformanceMonitor

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    monitor = new PerformanceMonitor()
    ;(monitor as any).metrics = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("合并 DB 与内存指标并按 id 去重（内存优先）", async () => {
    const timestamp = new Date(now.getTime() - 10 * 60 * 1000)

    const memoryMetrics: PerformanceMetric[] = [
      {
        id: "m1",
        type: MonitorMetricType.API_RESPONSE_TIME,
        value: 100,
        unit: "ms",
        timestamp,
        context: { endpoint: "/api/mem" },
      },
    ]

    const dbMetrics: PerformanceMetric[] = [
      {
        id: "m1",
        type: MonitorMetricType.API_RESPONSE_TIME,
        value: 300,
        unit: "ms",
        timestamp,
        context: { endpoint: "/api/db" },
      },
      {
        id: "m2",
        type: MonitorMetricType.API_RESPONSE_TIME,
        value: 400,
        unit: "ms",
        timestamp,
        context: { endpoint: "/api/db2" },
      },
      {
        id: "m3",
        type: MonitorMetricType.PERMISSION_CHECK_TIME,
        value: 50,
        unit: "ms",
        timestamp,
      },
    ]

    ;(monitor as any).metrics = memoryMetrics
    ;(monitor as any).fetchDbMetrics = vi.fn().mockResolvedValue(dbMetrics)

    const report = await monitor.getPerformanceReport(1)

    expect(report.summary.totalRequests).toBe(2)
    expect(report.summary.averageResponseTime).toBe(250)
    expect(report.topSlowEndpoints[0].endpoint).toBe("/api/db2")
    expect(report.authMetrics.permissionCheckTime.average).toBe(50)
  })

  it("数据库查询失败时回退到内存数据", async () => {
    const timestamp = new Date(now.getTime() - 5 * 60 * 1000)
    ;(monitor as any).metrics = [
      {
        id: "m1",
        type: MonitorMetricType.API_RESPONSE_TIME,
        value: 120,
        unit: "ms",
        timestamp,
      },
    ]
    ;(monitor as any).fetchDbMetrics = vi.fn().mockRejectedValue(new Error("db down"))

    const report = await monitor.getPerformanceReport(1)

    expect(report.summary.totalRequests).toBe(1)
    expect(report.summary.averageResponseTime).toBe(120)
  })
})
