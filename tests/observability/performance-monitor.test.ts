import { describe, it, expect, beforeEach } from "vitest"
import { PerformanceMonitor } from "@/lib/performance-monitor"

describe("PerformanceMonitor Posts 指标", () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  it("聚合文章操作耗时与失败率", async () => {
    monitor.recordPostAction("create", 120, true, { userId: "admin-1" })
    monitor.recordPostAction("delete", 240, false, {
      userId: "admin-1",
      errorCode: "NOT_FOUND",
    })
    monitor.recordPostAction("delete", 180, true, { userId: "admin-1" })

    const report = await monitor.getPerformanceReport(1)
    const { totalActions, failureRate, actions } = report.postActionMetrics

    expect(totalActions).toBe(3)
    expect(failureRate).toBeCloseTo((1 / 3) * 100)

    const deleteStats = actions.find((item) => item.action === "delete")
    expect(deleteStats).toBeDefined()
    expect(deleteStats?.failureCount).toBe(1)
    expect(deleteStats?.successCount).toBe(1)
    expect(deleteStats?.averageDuration).toBeGreaterThan(0)
  })
})
