import { MetricType } from "@/lib/generated/prisma"

export type MetricsBucket = "60s" | "5m" | "1h"
export type MetricsCompareWindow = "1h" | "24h"

export interface MetricsQueryParams {
  type?: MetricType
  startTime?: Date
  endTime?: Date
  bucket?: MetricsBucket
  compareWindow?: MetricsCompareWindow
}

export interface MetricsTimeseriesDTO {
  timestamp: string
  avg: number
  p50: number
  p95: number
  count: number
}

export interface MetricsStatsDTO {
  total: number
  min: number
  max: number
  avg: number
  p50: number
  p95: number
}

export interface MetricsQueryResultDTO {
  range: {
    startTime: string
    endTime: string
  }
  timeseries: MetricsTimeseriesDTO[]
  stats: MetricsStatsDTO
  comparison?: {
    range: {
      startTime: string
      endTime: string
    }
    timeseries: MetricsTimeseriesDTO[]
    stats: MetricsStatsDTO
  }
}
