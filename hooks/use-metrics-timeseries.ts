"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { fetchJson } from "@/lib/api/fetch-json"
import type {
  MetricsBucket,
  MetricsCompareWindow,
  MetricsQueryResultDTO,
} from "@/lib/dto/metrics.dto"
import { MetricType } from "@/lib/generated/prisma"

const REFRESH_INTERVAL = 30_000

export interface UseMetricsTimeseriesParams {
  type?: MetricType
  startTime?: Date
  endTime?: Date
  bucket?: MetricsBucket
  compareWindow?: MetricsCompareWindow
}

export function useMetricsTimeseries(params: UseMetricsTimeseriesParams) {
  const serializedParams = useMemo(() => {
    const normalized = {
      type: params.type,
      startTime: params.startTime?.toISOString(),
      endTime: params.endTime?.toISOString(),
      bucket: params.bucket,
      compareWindow: params.compareWindow,
    }
    return JSON.stringify(normalized)
  }, [params.bucket, params.compareWindow, params.endTime, params.startTime, params.type])

  const swrKey = serializedParams ? ["metrics-timeseries", serializedParams] : null

  const { data, error, isLoading, mutate } = useSWR<MetricsQueryResultDTO>(
    swrKey,
    async (key) => {
      const [, serialized] = key as [string, string]
      const query = JSON.parse(serialized)
      return fetchJson<MetricsQueryResultDTO>("/api/admin/metrics", { params: query })
    },
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
    }
  )

  return {
    data,
    isLoading,
    error: (error as Error | null) ?? null,
    mutate,
  }
}

export default useMetricsTimeseries
