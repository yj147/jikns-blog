/**
 * 性能监控 API 端点
 * 提供详细的性能指标和统计报告
 */

import { NextRequest, NextResponse } from "next/server"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { ErrorHandler } from "@/lib/error-handler"
import { validateApiPermissions } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const validation = await validateApiPermissions(request, "admin")
    if (!validation.success) {
      return NextResponse.json(validation.error, {
        status: validation.error?.statusCode || 403,
      })
    }

    const url = new URL(request.url)
    const hours = parseInt(url.searchParams.get("hours") || "24")
    const metricType = url.searchParams.get("type") as MetricType
    const format = url.searchParams.get("format") || "summary"

    // 验证参数
    if (hours < 1 || hours > 168) {
      // 最多7天
      return NextResponse.json({ error: "时间范围必须在1-168小时之间" }, { status: 400 })
    }

    if (format === "realtime") {
      // 实时数据
      const realTimeData = await performanceMonitor.getRealTimeOverview()

      return NextResponse.json({
        type: "realtime",
        timestamp: new Date().toISOString(),
        data: realTimeData,
      })
    }

    if (metricType) {
      // 特定指标的详细统计
      const now = new Date()
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000)

      const stats = await performanceMonitor.getStats(metricType, {
        start: startTime,
        end: now,
      })

      return NextResponse.json({
        type: "metric-detail",
        metricType,
        timeRange: { hours },
        timestamp: new Date().toISOString(),
        data: stats,
      })
    }

    // 完整性能报告
    const report = await performanceMonitor.getPerformanceReport(hours)

    if (format === "summary") {
      // 摘要格式
      return NextResponse.json({
        type: "summary",
        timeRange: { hours },
        timestamp: new Date().toISOString(),
        summary: report.summary,
        authMetrics: report.authMetrics,
        topIssues: {
          slowEndpoints: report.topSlowEndpoints.slice(0, 5),
          topErrors: report.errorBreakdown.slice(0, 5),
        },
      })
    }

    // 完整格式
    return NextResponse.json({
      type: "full",
      timeRange: { hours },
      timestamp: new Date().toISOString(),
      data: report,
    })
  } catch (error) {
    return await ErrorHandler.handleApiError(error, "performance monitoring")
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const validation = await validateApiPermissions(request, "admin")
    if (!validation.success) {
      return NextResponse.json(validation.error, {
        status: validation.error?.statusCode || 403,
      })
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case "record_metric": {
        const { type, value, unit, context } = params

        if (!type || value === undefined || !unit) {
          return NextResponse.json({ error: "缺少必要参数: type, value, unit" }, { status: 400 })
        }

        performanceMonitor.recordMetric({
          type: type as MetricType,
          value: parseFloat(value),
          unit: unit as "ms" | "count" | "percent",
          timestamp: new Date(),
          context,
        })

        return NextResponse.json({
          success: true,
          message: "指标记录成功",
        })
      }

      case "record_error": {
        const { context } = params

        performanceMonitor.recordError(context)

        return NextResponse.json({
          success: true,
          message: "错误记录成功",
        })
      }

      case "cleanup_metrics": {
        const { hours = 24 } = params

        performanceMonitor.cleanupOldMetrics(hours)

        return NextResponse.json({
          success: true,
          message: `已清理${hours}小时前的指标数据`,
        })
      }

      default:
        return NextResponse.json({ error: `不支持的操作: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return await ErrorHandler.handleApiError(error, "performance monitoring")
  }
}
