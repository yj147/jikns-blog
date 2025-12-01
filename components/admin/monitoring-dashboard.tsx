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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { fetchJson } from "@/lib/api/fetch-json"
import type { ApiResponse } from "@/lib/api/unified-response"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  Radio,
  TrendingUp,
  TrendingDown,
  Users,
  Shield,
  Zap,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { performanceMonitor } from "@/lib/performance-monitor"
import { logger } from "@/lib/utils/logger"
import { useRealtimeDashboard } from "@/hooks/use-realtime-dashboard"
import { MetricsChart } from "@/components/admin/metrics-chart"
import { useMetricsTimeseries } from "@/hooks/use-metrics-timeseries"
import { MetricType } from "@/lib/generated/prisma"
import type { MetricsBucket } from "@/lib/dto/metrics.dto"
import type { MonitoringResponse, PerformanceReport } from "@/types/monitoring"

/**
 * 监控数据接口
 */
interface MonitoringData {
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

type TimeRangeValue = "1h" | "24h" | "7d"

const TIME_RANGE_OPTIONS: Array<{ label: string; value: TimeRangeValue; ms: number }> = [
  { label: "近 1 小时", value: "1h", ms: 60 * 60 * 1000 },
  { label: "近 24 小时", value: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "近 7 天", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
]

const BUCKET_OPTIONS: Array<{ label: string; value: MetricsBucket }> = [
  { label: "1 分钟", value: "60s" },
  { label: "5 分钟", value: "5m" },
  { label: "1 小时", value: "1h" },
]

const METRICS_REFRESH_MS = 30_000

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

const RealtimeStatus: React.FC<{
  state: "realtime" | "polling" | "idle" | "error"
  lastUpdated?: Date | null
}> = ({ state, lastUpdated }) => {
  const config = {
    realtime: { label: "实时更新", color: "bg-emerald-500", text: "text-emerald-600" },
    polling: { label: "轮询模式", color: "bg-amber-500", text: "text-amber-600" },
    idle: { label: "初始化", color: "bg-gray-400", text: "text-gray-600" },
    error: { label: "已降级", color: "bg-red-500", text: "text-red-600" },
  } as const

  const current = config[state]

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn("h-2.5 w-2.5 rounded-full", current.color)} />
      <span className={cn("font-medium", current.text)}>{current.label}</span>
      {lastUpdated && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          更新于 {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
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
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    connectionState,
    lastUpdated: statsUpdatedAt,
    refresh: refreshStats,
  } = useRealtimeDashboard()

  const [performanceData, setPerformanceData] = React.useState<MonitoringData | null>(null)
  const [performanceLoading, setPerformanceLoading] = React.useState(true)
  const [performanceError, setPerformanceError] = React.useState<string | null>(null)
  const [performanceLastUpdate, setPerformanceLastUpdate] = React.useState<Date | null>(null)
  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>("1h")
  const [bucket, setBucket] = React.useState<MetricsBucket>("5m")
  const [compareEnabled, setCompareEnabled] = React.useState(false)
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), METRICS_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  /**
   * 加载监控数据
   */
  const loadPerformanceData = React.useCallback(async () => {
    setPerformanceLoading(true)
    setPerformanceError(null)

    let report: PerformanceReport | null = null
    let warning: string | null = null
    let apiTimestamp: string | undefined
    let uptimeSeconds: number | undefined

    try {
      const response = await fetchJson<ApiResponse<MonitoringResponse>>("/api/admin/monitoring")
      apiTimestamp = response.meta?.timestamp
      const payload = response.data
      report = payload?.performanceReport ?? null
      uptimeSeconds = payload?.uptime
    } catch (err) {
      warning = err instanceof Error ? err.message : "性能接口请求失败，已回退到本地数据"
      logger.warn("获取性能报告接口失败，使用本地回退", { error: err })
    }

    if (!report) {
      try {
        report = await performanceMonitor.getPerformanceReport(24)
      } catch (fallbackError) {
        setPerformanceError(
          fallbackError instanceof Error ? fallbackError.message : "加载监控数据失败"
        )
        setPerformanceLoading(false)
        return
      }
    }

    if (!report) {
      setPerformanceError("性能报告为空")
      setPerformanceLoading(false)
      return
    }

    let healthStatus: "healthy" | "degraded" | "unhealthy" = "healthy"

    if (report.summary.errorRate > 5 || report.summary.averageResponseTime > 2000) {
      healthStatus = "degraded"
    }

    if (report.summary.errorRate > 20 || report.summary.averageResponseTime > 5000) {
      healthStatus = "unhealthy"
    }

    const monitoringData: MonitoringData = {
      healthStatus,
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
    }

    setPerformanceData(monitoringData)
    setPerformanceLastUpdate(apiTimestamp ? new Date(apiTimestamp) : new Date())
    setPerformanceError(warning)
    setPerformanceLoading(false)
  }, [])

  /**
   * 初始化和定时刷新
   */
  React.useEffect(() => {
    loadPerformanceData()

    // 每30秒自动刷新
    const interval = setInterval(loadPerformanceData, METRICS_REFRESH_MS)

    return () => clearInterval(interval)
  }, [loadPerformanceData])

  const rangeDuration = React.useMemo(
    () => TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.ms ?? TIME_RANGE_OPTIONS[0].ms,
    [timeRange]
  )
  const endTime = React.useMemo(() => now, [now])
  const startTime = React.useMemo(
    () => new Date(endTime.getTime() - rangeDuration),
    [endTime, rangeDuration]
  )

  const compareWindow = compareEnabled ? (timeRange === "1h" ? "1h" : "24h") : undefined

  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
    mutate: mutateMetrics,
  } = useMetricsTimeseries({
    type: MetricType.api_response,
    startTime,
    endTime,
    bucket,
    compareWindow,
  })

  const refreshAll = React.useCallback(() => {
    const currentNow = new Date()
    setNow(currentNow)
    void Promise.all([refreshStats(), loadPerformanceData(), mutateMetrics()])
  }, [loadPerformanceData, mutateMetrics, refreshStats])

  const isInitialLoading = performanceLoading && !performanceData
  const blockingError = performanceError && !performanceData

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">系统监控</h2>
        </div>
        <LoadingIndicator variant="skeleton" size="lg" message="加载监控数据中..." />
      </div>
    )
  }

  if (blockingError) {
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
              <p className="mb-4 text-gray-500 dark:text-gray-400">
                {performanceError || statsError?.message}
              </p>
              <Button onClick={refreshAll} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                重新加载
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!performanceData) {
    return null
  }

  const counters = stats ?? {
    users: 0,
    posts: 0,
    comments: 0,
    activities: 0,
    generatedAt: new Date().toISOString(),
  }

  const counterUpdatedAt = statsUpdatedAt ?? new Date(counters.generatedAt)

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">系统监控</h2>
          {performanceLastUpdate && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              性能数据更新：{performanceLastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <RealtimeStatus state={connectionState} lastUpdated={counterUpdatedAt} />
          <Button
            onClick={refreshAll}
            variant="outline"
            size="sm"
            disabled={performanceLoading || statsLoading}
          >
            {performanceLoading || statsLoading ? (
              <LoadingIndicator variant="spinner" size="sm" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            刷新
          </Button>
        </div>
      </div>

      {performanceError && performanceData && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-200">
          性能数据接口暂不可用，已使用本地回退：{performanceError}
        </div>
      )}

      {/* 基础计数 */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-600" />
            实时基础计数
          </CardTitle>
          {statsError && (
            <p className="text-xs text-red-500 dark:text-red-400">计数更新失败：{statsError.message}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="用户总数" value={counters.users.toLocaleString()} icon={Users} />
            <StatCard title="文章总数" value={counters.posts.toLocaleString()} icon={FileText} />
            <StatCard
              title="评论总数"
              value={counters.comments.toLocaleString()}
              icon={MessageSquare}
            />
            <StatCard
              title="动态总数"
              value={counters.activities.toLocaleString()}
              icon={Activity}
            />
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            数据时间：{counterUpdatedAt.toLocaleTimeString()}
            {connectionState === "polling" && "（轮询中）"}
          </p>
        </CardContent>
      </Card>

      {/* 性能趋势 */}
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            性能趋势
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">时间范围</span>
              <Select
                aria-label="选择时间范围"
                value={timeRange}
                onValueChange={(value) => setTimeRange(value as TimeRangeValue)}
              >
                <SelectTrigger aria-label="选择时间范围" className="w-32">
                  <SelectValue placeholder="选择时间范围" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">分桶</span>
              <Select
                aria-label="选择分桶"
                value={bucket}
                onValueChange={(value) => setBucket(value as MetricsBucket)}
              >
                <SelectTrigger aria-label="选择分桶" className="w-28">
                  <SelectValue placeholder="分桶" />
                </SelectTrigger>
                <SelectContent>
                  {BUCKET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="metrics-compare"
                checked={compareEnabled}
                onCheckedChange={setCompareEnabled}
                aria-label="开启趋势对比"
              />
              <label
                htmlFor="metrics-compare"
                className="text-sm text-gray-600 dark:text-gray-300"
              >
                趋势对比
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {metricsError && (
            <p className="text-sm text-red-500 dark:text-red-400">
              性能数据加载失败：{metricsError.message || metricsError.toString()}
            </p>
          )}
          <MetricsChart
            data={metricsData}
            isLoading={metricsLoading}
            error={metricsError?.message}
            showComparison={compareEnabled && !!metricsData?.comparison}
            height={340}
          />
        </CardContent>
      </Card>

      {/* 概览统计 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总请求数"
          value={performanceData.summary.totalRequests.toLocaleString()}
          description="过去24小时"
          icon={Activity}
          status="good"
        />
        <StatCard
          title="平均响应时间"
          value={`${Math.round(performanceData.summary.averageResponseTime)}ms`}
          description="过去24小时平均值"
          icon={Clock}
          status={performanceData.summary.averageResponseTime > 1000 ? "warning" : "good"}
        />
        <StatCard
          title="错误率"
          value={`${performanceData.summary.errorRate.toFixed(2)}%`}
          description="过去24小时"
          icon={AlertTriangle}
          status={
            performanceData.summary.errorRate > 5
              ? "error"
              : performanceData.summary.errorRate > 1
                ? "warning"
                : "good"
          }
        />
        <StatCard
          title="慢请求率"
          value={`${performanceData.summary.slowRequestsRate.toFixed(2)}%`}
          description=">1秒的请求比例"
          icon={TrendingDown}
          status={
            performanceData.summary.slowRequestsRate > 10
              ? "error"
              : performanceData.summary.slowRequestsRate > 5
                ? "warning"
                : "good"
          }
        />
      </div>

      {/* 健康状态和认证指标 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HealthStatus
          status={performanceData.healthStatus}
          uptime={performanceData.uptime ?? 0}
        />

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
                    {Math.round(performanceData.authMetrics.loginTime.average || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500">
                    P95: {Math.round(performanceData.authMetrics.loginTime.p95 || 0)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">会话检查时间</span>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Math.round(performanceData.authMetrics.sessionCheckTime.average || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500">
                    P95: {Math.round(performanceData.authMetrics.sessionCheckTime.p95 || 0)}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">权限验证时间</span>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {Math.round(performanceData.authMetrics.permissionCheckTime.average || 0)}ms
                  </p>
                  <p className="text-xs text-gray-500">
                    P95: {Math.round(performanceData.authMetrics.permissionCheckTime.p95 || 0)}ms
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 错误分析和慢请求分析 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorAnalysis errors={performanceData.recentErrors} />
        <SlowEndpointsAnalysis endpoints={performanceData.topSlowEndpoints} />
      </div>
    </div>
  )
}
