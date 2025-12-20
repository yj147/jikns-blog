/**
 * 系统监控仪表板组件
 * 显示认证系统的性能指标、错误统计和健康状态
 */

"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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
import { useRealtimeDashboard } from "@/hooks/use-realtime-dashboard"
// 动态导入 MetricsChart，避免 396KB 的 recharts 被打包到初始 bundle
const MetricsChart = dynamic(
  () => import("@/components/admin/metrics-chart").then((mod) => mod.MetricsChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center">
        <LoadingIndicator size="lg" />
      </div>
    ),
  }
)
import { useMetricsTimeseries } from "@/hooks/use-metrics-timeseries"
import { MetricType } from "@/lib/generated/prisma"
import type { MetricsBucket } from "@/lib/dto/metrics.dto"
import {
  useMonitoringData,
  METRICS_REFRESH_MS,
} from "@/components/admin/monitoring/hooks/use-monitoring-data"
import { StatCard } from "@/components/admin/monitoring/stat-card"
import { HealthStatus } from "@/components/admin/monitoring/health-status"
import { RealtimeStatus } from "@/components/admin/monitoring/realtime-status"

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

  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
    lastUpdated: performanceLastUpdate,
    refresh: refreshPerformance,
  } = useMonitoringData()
  const [timeRange, setTimeRange] = React.useState<TimeRangeValue>("1h")
  const [bucket, setBucket] = React.useState<MetricsBucket>("5m")
  const [compareEnabled, setCompareEnabled] = React.useState(false)
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), METRICS_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const rangeDuration = React.useMemo(
    () =>
      TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.ms ??
      TIME_RANGE_OPTIONS[0].ms,
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
    void Promise.all([refreshStats(), refreshPerformance(), mutateMetrics()])
  }, [mutateMetrics, refreshPerformance, refreshStats])

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
            <p className="text-xs text-red-500 dark:text-red-400">
              计数更新失败：{statsError.message}
            </p>
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
              <label htmlFor="metrics-compare" className="text-sm text-gray-600 dark:text-gray-300">
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
        <HealthStatus status={performanceData.healthStatus} uptime={performanceData.uptime ?? 0} />

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
