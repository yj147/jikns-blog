"use client"

import { useId, useMemo } from "react"
import { format } from "date-fns"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetricsQueryResultDTO, MetricsTimeseriesDTO } from "@/lib/dto/metrics.dto"

interface MetricsChartProps {
  data?: MetricsQueryResultDTO | null
  isLoading?: boolean
  error?: string | null
  showComparison?: boolean
  height?: number
}

type ChartDatum = {
  time: number
  p50?: number
  p95?: number
  count?: number
  p50Compare?: number
  p95Compare?: number
  countCompare?: number
}

const formatTick = (value: number, withDate: boolean) =>
  format(new Date(value), withDate ? "MM-dd HH:mm" : "HH:mm")

function buildChartData(
  timeseries: MetricsTimeseriesDTO[] = [],
  comparison: MetricsTimeseriesDTO[] = [],
  shiftMs: number
): ChartDatum[] {
  const map = new Map<number, ChartDatum>()

  timeseries.forEach((point) => {
    const time = new Date(point.timestamp).getTime()
    map.set(time, {
      time,
      p50: point.p50,
      p95: point.p95,
      count: point.count,
    })
  })

  comparison.forEach((point) => {
    const time = new Date(point.timestamp).getTime() + shiftMs
    const existing = map.get(time) ?? { time }
    map.set(time, {
      ...existing,
      p50Compare: point.p50,
      p95Compare: point.p95,
      countCompare: point.count,
    })
  })

  return Array.from(map.values()).sort((a, b) => a.time - b.time)
}

type TooltipProps = {
  active?: boolean
  payload?: any[]
  label?: number
  withDate: boolean
}

const formatMetric = (value?: number) => (value ?? null) !== null ? `${Math.round(value ?? 0)} ms` : "-"
const formatCount = (value?: number) => (value ?? null) !== null ? `${value ?? 0} 次` : "-"

function TooltipContent({ active, payload, label, withDate }: TooltipProps) {
  if (!active || !payload?.length || typeof label !== "number") return null
  const datum = payload[0].payload as ChartDatum
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-sm">
      <p className="mb-2 font-medium text-foreground">{formatTick(label, withDate)}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">P50</span>
        <span>{formatMetric(datum.p50)}</span>
        <span className="text-muted-foreground">P95</span>
        <span>{formatMetric(datum.p95)}</span>
        <span className="text-muted-foreground">请求数</span>
        <span>{formatCount(datum.count)}</span>
        {datum.p50Compare !== undefined && (
          <>
            <span className="text-muted-foreground">对比 P50</span>
            <span>{formatMetric(datum.p50Compare)}</span>
          </>
        )}
        {datum.p95Compare !== undefined && (
          <>
            <span className="text-muted-foreground">对比 P95</span>
            <span>{formatMetric(datum.p95Compare)}</span>
          </>
        )}
        {datum.countCompare !== undefined && (
          <>
            <span className="text-muted-foreground">对比请求数</span>
            <span>{formatCount(datum.countCompare)}</span>
          </>
        )}
      </div>
    </div>
  )
}

export function MetricsChart({
  data,
  isLoading = false,
  error = null,
  showComparison = false,
  height = 360,
}: MetricsChartProps) {
  const gradientId = useId()

  const rangeDuration = useMemo(() => {
    if (data?.range) {
      return new Date(data.range.endTime).getTime() - new Date(data.range.startTime).getTime()
    }
    return 0
  }, [data?.range])

  const comparisonShift = useMemo(() => {
    if (showComparison && data?.comparison?.range && data.range) {
      const currentStart = new Date(data.range.startTime).getTime()
      const compareStart = new Date(data.comparison.range.startTime).getTime()
      return currentStart - compareStart
    }
    return 0
  }, [data?.comparison?.range, data?.range, showComparison])

  const chartData = useMemo(
    () =>
      buildChartData(
        data?.timeseries,
        showComparison ? data?.comparison?.timeseries ?? [] : [],
        comparisonShift
      ),
    [comparisonShift, data?.comparison?.timeseries, data?.timeseries, showComparison]
  )

  const hasData = chartData.length > 0
  const withDate = rangeDuration > 24 * 60 * 60 * 1000

  if (isLoading && !hasData) {
    return (
      <div data-testid="metrics-chart">
        <Skeleton className="h-[240px] w-full" />
      </div>
    )
  }

  if (error && !hasData) {
    return (
      <div
        data-testid="metrics-chart"
        className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      >
        <AlertTriangle className="h-4 w-4" />
        <span>加载失败：{error}</span>
      </div>
    )
  }

  return (
    <div data-testid="metrics-chart" className="w-full">
      {!hasData ? (
        <p className="text-sm text-muted-foreground">暂无数据</p>
      ) : (
        <div className="h-full w-full" style={{ minHeight: height }}>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`${gradientId}-p95`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`${gradientId}-p95-compare`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="text-muted-foreground/50" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => formatTick(value, withDate)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value: number) => `${Math.round(value)}ms`}
                tickLine={false}
                axisLine={false}
                width={70}
                domain={[0, "auto"]}
              />
              <Tooltip content={<TooltipContent withDate={withDate} />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="p95"
                name="P95"
                stroke="#fb923c"
                fill={`url(#${gradientId}-p95)`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="p50"
                name="P50"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {showComparison && (
                <>
                  <Area
                    type="monotone"
                    dataKey="p95Compare"
                    name="对比 P95"
                    stroke="#a855f7"
                    fill={`url(#${gradientId}-p95-compare)`}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="p50Compare"
                    name="对比 P50"
                    stroke="#7c3aed"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default MetricsChart
