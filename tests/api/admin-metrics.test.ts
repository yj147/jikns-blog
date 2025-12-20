import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { MetricType } from "@/lib/generated/prisma"
import { GET } from "@/app/api/admin/metrics/route"
import * as metricsRepo from "@/lib/repos/metrics-repo"
import { prisma } from "@/lib/prisma"
import type { MetricsQueryResultDTO } from "@/lib/dto/metrics.dto"

const mockValidateApiPermissions = vi.hoisted(() => vi.fn())

vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: mockValidateApiPermissions,
}))

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("GET /api/admin/metrics", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@test.com",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  }

  let repoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateApiPermissions.mockResolvedValue({
      success: true,
      user: adminUser,
    })
    repoSpy = vi.spyOn(metricsRepo, "getMetricsTimeseries")
  })

  afterEach(() => {
    repoSpy.mockRestore()
  })

  it("按时间范围查询并传递到查询层", async () => {
    const mockResult: MetricsQueryResultDTO = {
      range: {
        startTime: "2025-01-01T00:00:00.000Z",
        endTime: "2025-01-01T01:00:00.000Z",
      },
      timeseries: [],
      stats: { total: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0 },
    }
    repoSpy.mockResolvedValue(mockResult)

    const start = "2025-01-01T00:00:00.000Z"
    const end = "2025-01-01T01:00:00.000Z"
    const request = new NextRequest(
      `http://localhost/api/admin/metrics?startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}&bucket=60s`
    )

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(repoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: new Date(start),
        endTime: new Date(end),
        bucket: "60s",
      })
    )
    expect(body.success).toBe(true)
    expect(body.data.range.startTime).toBe(mockResult.range.startTime)
  })

  it("支持按类型过滤与自定义分桶", async () => {
    const mockResult: MetricsQueryResultDTO = {
      range: {
        startTime: "2025-01-02T00:00:00.000Z",
        endTime: "2025-01-02T02:00:00.000Z",
      },
      timeseries: [
        {
          timestamp: "2025-01-02T00:00:00.000Z",
          avg: 120,
          p50: 110,
          p95: 180,
          count: 3,
        },
      ],
      stats: { total: 3, min: 100, max: 180, avg: 120, p50: 110, p95: 180 },
    }
    repoSpy.mockResolvedValue(mockResult)

    const request = new NextRequest(
      "http://localhost/api/admin/metrics?type=api_response&bucket=1h"
    )
    const response = await GET(request)
    await response.json()

    expect(repoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MetricType.api_response,
        bucket: "1h",
      })
    )
  })

  it("非管理员请求返回 403", async () => {
    mockValidateApiPermissions.mockResolvedValue({
      success: false,
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        error: "forbidden",
        statusCode: 403,
      },
    })

    const request = new NextRequest("http://localhost/api/admin/metrics")
    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(repoSpy).not.toHaveBeenCalled()
  })

  it("空数据返回空数组与默认统计", async () => {
    const mockResult: MetricsQueryResultDTO = {
      range: {
        startTime: "2025-01-03T00:00:00.000Z",
        endTime: "2025-01-03T01:00:00.000Z",
      },
      timeseries: [],
      stats: { total: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0 },
    }
    repoSpy.mockResolvedValue(mockResult)

    const request = new NextRequest("http://localhost/api/admin/metrics")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.timeseries).toEqual([])
    expect(body.data.stats.total).toBe(0)
  })
})

describe("metrics-repo getMetricsTimeseries", () => {
  const { getMetricsTimeseries } = metricsRepo
  const startTime = new Date("2025-01-05T00:00:00.000Z")
  const endTime = new Date("2025-01-05T01:00:00.000Z")

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("按时间范围和分桶生成查询", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        bucket_start: startTime,
        avg: 100,
        p50: 90,
        p95: 150,
        count: BigInt(3),
      },
    ])
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { total: BigInt(3), min: 80, max: 150, avg: 110, p50: 90, p95: 150 },
    ])

    await getMetricsTimeseries({ startTime, endTime, bucket: "60s" })

    const firstCallValues = (prisma.$queryRaw as any).mock.calls[0][0].values
    expect(firstCallValues).toContain(60)
    expect(firstCallValues).toContain(startTime)
    expect(firstCallValues).toContain(endTime)
  })

  it("支持类型过滤", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        bucket_start: startTime,
        avg: 50,
        p50: 45,
        p95: 80,
        count: 2,
      },
    ])
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { total: 2, min: 40, max: 80, avg: 50, p50: 45, p95: 80 },
    ])

    await getMetricsTimeseries({ startTime, endTime, type: MetricType.db_query })

    const firstCallValues = (prisma.$queryRaw as any).mock.calls[0][0].values
    expect(firstCallValues).toContain(MetricType.db_query)
  })

  it("生成对比窗口数据", async () => {
    const compareShift = 24 * 60 * 60 * 1000
    const compareStart = new Date(startTime.getTime() - compareShift)
    const compareEnd = new Date(endTime.getTime() - compareShift)

    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        {
          bucket_start: startTime,
          avg: 80,
          p50: 70,
          p95: 120,
          count: 4,
        },
      ])
      .mockResolvedValueOnce([{ total: 4, min: 60, max: 120, avg: 80, p50: 70, p95: 120 }])
      .mockResolvedValueOnce([
        {
          bucket_start: compareStart,
          avg: 60,
          p50: 55,
          p95: 100,
          count: 3,
        },
      ])
      .mockResolvedValueOnce([{ total: 3, min: 50, max: 100, avg: 60, p50: 55, p95: 100 }])

    const result = await getMetricsTimeseries({
      startTime,
      endTime,
      bucket: "5m",
      compareWindow: "24h",
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4)
    expect(result.comparison?.range.startTime).toBe(compareStart.toISOString())
  })

  it("空数据时返回默认统计", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([])
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([])

    const result = await getMetricsTimeseries({ startTime, endTime })

    expect(result.timeseries).toEqual([])
    expect(result.stats).toEqual({
      total: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
    })
  })
})
