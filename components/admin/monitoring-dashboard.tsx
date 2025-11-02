/**
 * 系统监控仪表板组件
 * 显示认证系统的性能指标、错误统计和健康状态
 */

"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { performanceMonitor } from "@/lib/performance-monitor"
import { auditLogger } from "@/lib/audit-log"

/**
 * 监控数据接口
 */
interface MonitoringData {
  healthStatus: "healthy" | "degraded" | "unhealthy"
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

/**
 * 统计卡片组件
 */
const StatCard: React.FC<{
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: "up" | "down" | "stable"
  status?: "good" | "warning" | "error"
  className?: string
}> = ({ title, value, description, icon: Icon, trend, status = "good", className }) => {
  const statusColors = {
    good: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  }

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null

  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <div className="flex items-center space-x-2">
              <p className={cn("text-2xl font-bold", statusColors[status])}>{value}</p>
              {TrendIcon && (
                <TrendIcon
                  className={cn("h-4 w-4", trend === "up" ? "text-green-600" : "text-red-600")}
                />
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div
            className={cn("rounded-full bg-gray-100 p-3 dark:bg-gray-800", statusColors[status])}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 健康状态指示器
 */
const HealthStatus: React.FC<{
  status: "healthy" | "degraded" | "unhealthy"
  uptime: number
}> = ({ status, uptime }) => {
  const statusConfig = {
    healthy: {
      color: "bg-green-500",
      textColor: "text-green-600 dark:text-green-400",
      label: "健康",
      description: "系统运行正常",
    },
    degraded: {
      color: "bg-yellow-500",
      textColor: "text-yellow-600 dark:text-yellow-400",
      label: "降级",
      description: "系统性能下降",
    },
    unhealthy: {
      color: "bg-red-500",
      textColor: "text-red-600 dark:text-red-400",
      label: "异常",
      description: "系统存在问题",
    },
  }

  const config = statusConfig[status]
  const uptimeHours = Math.floor(uptime / 3600)
  const uptimeDays = Math.floor(uptimeHours / 24)

  const formatUptime = () => {
    if (uptimeDays > 0) {
      return `${uptimeDays} 天 ${uptimeHours % 24} 小时`
    } else {
      return `${uptimeHours} 小时 ${Math.floor((uptime % 3600) / 60)} 分钟`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded-full", config.color)} />
          系统健康状态
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className={cn("text-lg font-semibold", config.textColor)}>{config.label}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{config.description}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">运行时间</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatUptime()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 错误分析组件
 */
const ErrorAnalysis: React.FC<{
  errors: Array<{
    type: string
    count: number
    percentage: number
  }>
}> = ({ errors }) => {
  if (errors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            错误统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400">暂无错误记录</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          错误统计
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {errors.slice(0, 5).map((error, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{error.type}</p>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-red-500 transition-all duration-300"
                    style={{ width: `${error.percentage}%` }}
                  />
                </div>
              </div>
              <div className="ml-4 text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {error.count}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {error.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 慢请求分析组件
 */
const SlowEndpointsAnalysis: React.FC<{
  endpoints: Array<{
    endpoint: string
    averageTime: number
    requestCount: number
  }>
}> = ({ endpoints }) => {
  if (endpoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            慢请求分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400">所有请求响应正常</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          慢请求分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {endpoints.slice(0, 5).map((endpoint, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {endpoint.endpoint}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {endpoint.requestCount} 次请求
                </p>
              </div>
              <div className="ml-4 text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {Math.round(endpoint.averageTime)}ms
                </p>
                <Badge variant={endpoint.averageTime > 2000 ? "destructive" : "secondary"}>
                  {endpoint.averageTime > 2000 ? "慢" : "正常"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 监控仪表板主组件
 */
export const MonitoringDashboard: React.FC = () => {
  const [data, setData] = React.useState<MonitoringData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null)

  /**
   * 加载监控数据
   */
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // 获取性能报告
      const report = await performanceMonitor.getPerformanceReport(24)
      const realTimeOverview = await performanceMonitor.getRealTimeOverview()

      // 模拟健康检查数据
      let healthStatus: "healthy" | "degraded" | "unhealthy" = "healthy"

      if (report.summary.errorRate > 5 || report.summary.averageResponseTime > 2000) {
        healthStatus = "degraded"
      }

      if (report.summary.errorRate > 20 || report.summary.averageResponseTime > 5000) {
        healthStatus = "unhealthy"
      }

      const monitoringData: MonitoringData = {
        healthStatus,
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
      }

      setData(monitoringData)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载监控数据失败")
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 初始化和定时刷新
   */
  React.useEffect(() => {
    loadData()

    // 每30秒自动刷新
    const interval = setInterval(loadData, 30000)

    return () => clearInterval(interval)
  }, [loadData])

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">系统监控</h2>
        </div>
        <LoadingIndicator variant="skeleton" size="lg" message="加载监控数据中..." />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">系统监控</h2>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <p className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
                加载监控数据失败
              </p>
              <p className="mb-4 text-gray-500 dark:text-gray-400">{error}</p>
              <Button onClick={loadData} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                重新加载
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">系统监控</h2>
          {lastUpdate && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              最后更新：{lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <LoadingIndicator variant="spinner" size="sm" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          刷新
        </Button>
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总请求数"
          value={data.summary.totalRequests.toLocaleString()}
          description="过去24小时"
          icon={Activity}
          status="good"
        />
        <StatCard
          title="平均响应时间"
          value={`${Math.round(data.summary.averageResponseTime)}ms`}
          description="过去24小时平均值"
          icon={Clock}
          status={data.summary.averageResponseTime > 1000 ? "warning" : "good"}
        />
        <StatCard
          title="错误率"
          value={`${data.summary.errorRate.toFixed(2)}%`}
          description="过去24小时"
          icon={AlertTriangle}
          status={
            data.summary.errorRate > 5 ? "error" : data.summary.errorRate > 1 ? "warning" : "good"
          }
        />
        <StatCard
          title="慢请求率"
          value={`${data.summary.slowRequestsRate.toFixed(2)}%`}
          description=">1秒的请求比例"
          icon={TrendingDown}
          status={
            data.summary.slowRequestsRate > 10
              ? "error"
              : data.summary.slowRequestsRate > 5
                ? "warning"
                : "good"
          }
        />
      </div>

      {/* 健康状态和认证指标 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HealthStatus status={data.healthStatus} uptime={process.uptime ? process.uptime() : 0} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              认证性能指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">用户登录时间</span>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Math.round(data.authMetrics.loginTime.average || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500">
                    P95: {Math.round(data.authMetrics.loginTime.p95 || 0)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">会话检查时间</span>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Math.round(data.authMetrics.sessionCheckTime.average || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500">
                    P95: {Math.round(data.authMetrics.sessionCheckTime.p95 || 0)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">权限验证时间</span>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Math.round(data.authMetrics.permissionCheckTime.average || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500">
                    P95: {Math.round(data.authMetrics.permissionCheckTime.p95 || 0)}ms
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 错误分析和慢请求分析 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorAnalysis errors={data.recentErrors} />
        <SlowEndpointsAnalysis endpoints={data.topSlowEndpoints} />
      </div>
    </div>
  )
}
