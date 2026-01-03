"use client"

import * as React from "react"
import { fetchJson } from "@/lib/api/fetch-json"
import type { ApiResponse } from "@/lib/api/unified-response"
import { logger } from "@/lib/utils/logger"
import type { MonitoringResponse, PerformanceReport } from "@/types/monitoring"

export type MonitoringRange = "1h" | "24h" | "7d"

export interface MonitoringData {
  healthStatus: "healthy" | "degraded" | "unhealthy"
  uptime: number
  summary: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    slowRequestsRate: number
  }
  authMetrics: {
    loginTime: {
      average: number
      p95: number
    }
    sessionCheckTime: {
      average: number
      p95: number
    }
    permissionCheckTime: {
      average: number
      p95: number
    }
  }
  recentErrors: Array<{
    type: string
    count: number
    percentage: number
  }>
  topSlowEndpoints: Array<{
    endpoint: string
    averageTime: number
    requestCount: number
  }>
}

export const METRICS_REFRESH_MS = 30_000

const buildHealthStatus = (report: PerformanceReport) => {
  if (report.summary.errorRate > 20 || report.summary.averageResponseTime > 5000) {
    return "unhealthy" as const
  }

  if (report.summary.errorRate > 5 || report.summary.averageResponseTime > 2000) {
    return "degraded" as const
  }

  return "healthy" as const
}

const mapReportToMonitoringData = (
  report: PerformanceReport,
  uptimeSeconds?: number
): MonitoringData => ({
  healthStatus: buildHealthStatus(report),
  uptime: uptimeSeconds ?? 0,
  summary: report.summary,
  authMetrics: {
    loginTime: {
      average: report.authMetrics.loginTime.average,
      p95: report.authMetrics.loginTime.p95,
    },
    sessionCheckTime: {
      average: report.authMetrics.sessionCheckTime.average,
      p95: report.authMetrics.sessionCheckTime.p95,
    },
    permissionCheckTime: {
      average: report.authMetrics.permissionCheckTime.average,
      p95: report.authMetrics.permissionCheckTime.p95,
    },
  },
  recentErrors: report.errorBreakdown,
  topSlowEndpoints: report.topSlowEndpoints,
})

export const useMonitoringData = (range: MonitoringRange = "24h") => {
  const [data, setData] = React.useState<MonitoringData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const loadMonitoringData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    let report: PerformanceReport | null = null
    let apiTimestamp: string | undefined
    let uptimeSeconds: number | undefined

    try {
      const url = `/api/admin/monitoring?range=${encodeURIComponent(range)}`
      const response = await fetchJson<ApiResponse<MonitoringResponse>>(url)
      apiTimestamp = response.meta?.timestamp
      const payload = response.data
      report = payload?.performanceReport ?? null
      uptimeSeconds = payload?.uptime
    } catch (err) {
      setError(err instanceof Error ? err.message : "性能接口请求失败")
      logger.warn("获取性能报告接口失败", { error: err })
      setIsLoading(false)
      return
    }

    if (!report) {
      setError("性能报告为空")
      setIsLoading(false)
      return
    }

    const monitoringData = mapReportToMonitoringData(report, uptimeSeconds)

    setData(monitoringData)
    setLastUpdated(apiTimestamp ? new Date(apiTimestamp) : new Date())
    setError(null)
    setIsLoading(false)
  }, [range])

  React.useEffect(() => {
    loadMonitoringData()

    const interval = setInterval(loadMonitoringData, METRICS_REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadMonitoringData])

  return { data, isLoading, error, lastUpdated, refresh: loadMonitoringData }
}
