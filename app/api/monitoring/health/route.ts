/**
 * 系统健康检查 API 端点
 * 提供系统运行状态和性能指标概览
 */

import { NextRequest, NextResponse } from "next/server"
import { performanceMonitor } from "@/lib/performance-monitor"
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

    // 获取健康检查数据
    const healthData = {
      status: "healthy" as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "unknown",
    }

    // 获取实时性能概览
    const performanceOverview = await performanceMonitor.getRealTimeOverview()

    // 获取24小时性能报告
    const performanceReport = await performanceMonitor.getPerformanceReport(24)

    // 判断系统健康状态
    let status: "healthy" | "degraded" | "unhealthy" = "healthy"

    // 内存使用率检查
    const memoryUsagePercent = (healthData.memory.heapUsed / healthData.memory.heapTotal) * 100

    // 性能指标检查
    const avgResponseTime = performanceReport.summary.averageResponseTime
    const errorRate = performanceReport.summary.errorRate

    if (
      memoryUsagePercent > 90 ||
      avgResponseTime > 5000 ||
      errorRate > 20 ||
      performanceOverview.slowRequests > 10
    ) {
      status = "unhealthy"
    } else if (
      memoryUsagePercent > 75 ||
      avgResponseTime > 2000 ||
      errorRate > 5 ||
      performanceOverview.slowRequests > 5
    ) {
      status = "degraded"
    }

    const response = {
      status,
      timestamp: healthData.timestamp,
      uptime: healthData.uptime,
      system: {
        nodeVersion: healthData.nodeVersion,
        platform: healthData.platform,
        environment: healthData.environment,
        memory: {
          used: healthData.memory.heapUsed,
          total: healthData.memory.heapTotal,
          usagePercent: memoryUsagePercent,
          external: healthData.memory.external,
          rss: healthData.memory.rss,
        },
      },
      performance: {
        activeTimers: performanceOverview.activeTimers,
        totalMetrics: performanceOverview.totalMetrics,
        recentErrors: performanceOverview.recentErrors,
        averageResponseTime: performanceOverview.averageResponseTime,
        slowRequests: performanceOverview.slowRequests,
      },
      summary: performanceReport.summary,
      checks: {
        memory: memoryUsagePercent < 75 ? "pass" : memoryUsagePercent < 90 ? "warn" : "fail",
        responseTime: avgResponseTime < 1000 ? "pass" : avgResponseTime < 2000 ? "warn" : "fail",
        errorRate: errorRate < 1 ? "pass" : errorRate < 5 ? "warn" : "fail",
      },
    }

    // 根据健康状态设置 HTTP 状态码
    const httpStatus = status === "healthy" ? 200 : status === "degraded" ? 200 : 503

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": status,
        "X-Response-Time": performanceOverview.averageResponseTime.toString(),
      },
    })
  } catch (error) {
    return await ErrorHandler.handleApiError(error, "health check")
  }
}

/**
 * 简化的健康检查端点（用于负载均衡器等）
 */
export async function HEAD(request: NextRequest) {
  try {
    const performanceOverview = await performanceMonitor.getRealTimeOverview()
    const memoryUsage = process.memoryUsage()
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    // 简单的健康检查
    const isHealthy =
      memoryUsagePercent < 90 &&
      performanceOverview.averageResponseTime < 5000 &&
      performanceOverview.recentErrors < 10

    return new Response(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        "X-Health-Status": isHealthy ? "healthy" : "unhealthy",
        "X-Uptime": process.uptime().toString(),
        "X-Memory-Usage": memoryUsagePercent.toFixed(2),
        "X-Response-Time": performanceOverview.averageResponseTime.toString(),
      },
    })
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        "X-Health-Status": "unhealthy",
        "X-Error": "Health check failed",
      },
    })
  }
}
