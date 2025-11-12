/**
 * 评论 API 可观测性测试
 * 验证日志和指标是否正确记录
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { commentsMetrics } from "@/lib/metrics/comments-metrics"
import { commentsLogger, logCommentOperation } from "@/lib/utils/logger"

describe("Comments Metrics", () => {
  beforeEach(() => {
    // 重置指标
    commentsMetrics.reset()
  })

  describe("Counter Operations", () => {
    it("应该正确增加操作计数", () => {
      commentsMetrics.incrementCounter("list", "success")
      commentsMetrics.incrementCounter("list", "success")
      commentsMetrics.incrementCounter("list", "failure")

      expect(commentsMetrics.getCounter("list", "success")).toBe(2)
      expect(commentsMetrics.getCounter("list", "failure")).toBe(1)
    })

    it("应该计算正确的 QPS", async () => {
      // 添加一些操作
      for (let i = 0; i < 10; i++) {
        commentsMetrics.incrementCounter("create", "success")
      }

      // 等待一秒
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const qps = commentsMetrics.getQPS("create")
      expect(qps).toBeGreaterThan(0)
      expect(qps).toBeLessThanOrEqual(10) // 最多10个操作
    })
  })

  describe("Latency Operations", () => {
    it("应该正确记录时延", () => {
      commentsMetrics.recordLatency("list", 50)
      commentsMetrics.recordLatency("list", 100)
      commentsMetrics.recordLatency("list", 150)

      const avg = commentsMetrics.getAverageLatency("list")
      expect(avg).toBe(100)
    })

    it("应该计算正确的百分位数", () => {
      // 添加测试数据
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      for (const latency of latencies) {
        commentsMetrics.recordLatency("create", latency)
      }

      const p50 = commentsMetrics.getP50("create")
      const p95 = commentsMetrics.getP95("create")

      expect(p50).toBeGreaterThanOrEqual(50)
      expect(p50).toBeLessThanOrEqual(60)
      expect(p95).toBeGreaterThanOrEqual(90)
      expect(p95).toBeLessThanOrEqual(100)
    })

    it("应该正确分布到直方图桶", () => {
      commentsMetrics.recordLatency("delete", 5) // <= 10ms
      commentsMetrics.recordLatency("delete", 15) // <= 25ms
      commentsMetrics.recordLatency("delete", 30) // <= 50ms
      commentsMetrics.recordLatency("delete", 200) // <= 250ms
      commentsMetrics.recordLatency("delete", 1500) // <= 2500ms

      const distribution = commentsMetrics.getLatencyDistribution("delete")

      expect(distribution?.get(10)).toBe(1)
      expect(distribution?.get(25)).toBe(1)
      expect(distribution?.get(50)).toBe(1)
      expect(distribution?.get(250)).toBe(1)
      expect(distribution?.get(2500)).toBe(1)
    })
  })

  describe("Summary Operations", () => {
    it("应该生成完整的摘要", () => {
      // 添加一些测试数据
      commentsMetrics.incrementCounter("list", "success")
      commentsMetrics.incrementCounter("create", "failure")
      commentsMetrics.recordLatency("list", 50)
      commentsMetrics.recordLatency("create", 100)

      const summary = commentsMetrics.getSummary()

      expect(summary).toHaveProperty("uptime")
      expect(summary).toHaveProperty("counters")
      expect(summary).toHaveProperty("qps")
      expect(summary).toHaveProperty("latencies")

      expect(summary.counters.list.success).toBe(1)
      expect(summary.counters.create.failure).toBe(1)
    })
  })

  describe("Prometheus Format", () => {
    it("应该导出 Prometheus 格式的指标", () => {
      commentsMetrics.incrementCounter("list", "success")
      commentsMetrics.recordLatency("list", 50)

      const prometheus = commentsMetrics.toPrometheusFormat()

      expect(prometheus).toContain("# HELP comments_operations_total")
      expect(prometheus).toContain("# TYPE comments_operations_total counter")
      expect(prometheus).toContain('comments_operations_total{operation="list",status="success"} 1')
      expect(prometheus).toContain("# HELP comments_operation_duration_milliseconds")
      expect(prometheus).toContain("# TYPE comments_operation_duration_milliseconds histogram")
    })
  })
})

describe("Comments Logger", () => {
  let logSpy: any

  beforeEach(() => {
    // Mock console methods
    logSpy = {
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("logCommentOperation", () => {
    it("应该记录成功的操作", () => {
      logCommentOperation("list", "user123", "post:456", "success", 50.5, { extra: "data" })

      expect(logSpy.info).toHaveBeenCalled()
      const call = logSpy.info.mock.calls[0][0]
      expect(call).toContain("Comment list: success")
      expect(call).toContain("user123")
      expect(call).toContain("post:456")
    })

    it("应该记录失败的操作", () => {
      logCommentOperation("create", undefined, "activity:789", "failure", 100.2, {
        error: "Rate limited",
      })

      expect(logSpy.error).toHaveBeenCalled()
      const call = logSpy.error.mock.calls[0][0]
      expect(call).toContain("Comment create: failure")
      expect(call).toContain("anonymous")
      expect(call).toContain("activity:789")
    })

    it("应该包含所有必要的字段", () => {
      logCommentOperation("delete", "admin", "comment:999", "success", 25.7)

      expect(logSpy.info).toHaveBeenCalled()
      const call = logSpy.info.mock.calls[0][0]

      // 验证包含的字段
      expect(call).toContain("operation")
      expect(call).toContain("actor")
      expect(call).toContain("target")
      expect(call).toContain("status")
      expect(call).toContain("duration")
    })
  })

  describe("Comments Logger Context", () => {
    it("应该包含模块信息", () => {
      commentsLogger.info("Test message")

      expect(logSpy.info).toHaveBeenCalled()
      const call = logSpy.info.mock.calls[0][0]
      expect(call).toContain("comments")
    })

    it("应该支持结构化日志", () => {
      commentsLogger.debug("Operation started", {
        requestId: "req-123",
        operation: "list",
        targetType: "post",
        targetId: "456",
      })

      expect(logSpy.debug).toHaveBeenCalled()
      const call = logSpy.debug.mock.calls[0][0]
      expect(call).toContain("req-123")
      expect(call).toContain("list")
      expect(call).toContain("post")
      expect(call).toContain("456")
    })
  })
})

describe("measureOperation Helper", () => {
  it("应该测量同步操作", async () => {
    const { measureOperation } = await import("@/lib/metrics/comments-metrics")

    const result = measureOperation("list", () => {
      // 模拟一些工作
      let sum = 0
      for (let i = 0; i < 1000; i++) {
        sum += i
      }
      return sum
    })

    expect(result).toBe(499500)
    expect(commentsMetrics.getCounter("list", "success")).toBe(1)

    const latency = commentsMetrics.getAverageLatency("list")
    expect(latency).toBeGreaterThan(0)
  })

  it("应该测量异步操作", async () => {
    const { measureOperation } = await import("@/lib/metrics/comments-metrics")

    const result = await measureOperation("create", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { id: "123", content: "test" }
    })

    expect(result).toEqual({ id: "123", content: "test" })
    expect(commentsMetrics.getCounter("create", "success")).toBe(1)

    const latency = commentsMetrics.getAverageLatency("create")
    expect(latency).toBeGreaterThanOrEqual(10)
  })

  it("应该处理失败的操作", async () => {
    const { measureOperation } = await import("@/lib/metrics/comments-metrics")

    await expect(
      measureOperation("delete", async () => {
        throw new Error("Not found")
      })
    ).rejects.toThrow("Not found")

    expect(commentsMetrics.getCounter("delete", "failure")).toBe(1)
    expect(commentsMetrics.getCounter("delete", "success")).toBe(0)

    const latency = commentsMetrics.getAverageLatency("delete")
    expect(latency).toBeGreaterThan(0)
  })
})
