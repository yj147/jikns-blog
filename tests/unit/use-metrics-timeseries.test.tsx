import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SWRConfig } from "swr"
import { useMetricsTimeseries } from "@/hooks/use-metrics-timeseries"
import type { UseMetricsTimeseriesParams } from "@/hooks/use-metrics-timeseries"
import type { MetricsQueryResultDTO } from "@/lib/dto/metrics.dto"
import { MetricType } from "@/lib/generated/prisma"
import type React from "react"

vi.mock("@/lib/api/fetch-json", () => ({
  fetchJson: vi.fn(),
}))

const fetchJsonMock = vi.mocked((await import("@/lib/api/fetch-json")).fetchJson)

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, retryOnError: false }}>
    {children}
  </SWRConfig>
)

const baseResponse: MetricsQueryResultDTO = {
  range: {
    startTime: new Date("2025-11-30T10:00:00Z").toISOString(),
    endTime: new Date("2025-11-30T11:00:00Z").toISOString(),
  },
  timeseries: [
    {
      timestamp: new Date("2025-11-30T10:00:00Z").toISOString(),
      avg: 120,
      p50: 100,
      p95: 160,
      count: 12,
    },
  ],
  stats: {
    total: 12,
    min: 80,
    max: 200,
    avg: 120,
    p50: 100,
    p95: 160,
  },
}

describe("useMetricsTimeseries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    fetchJsonMock.mockReset()
  })

  it("returns loading then success data", async () => {
    fetchJsonMock.mockResolvedValueOnce(baseResponse)
    const params: UseMetricsTimeseriesParams = {
      type: MetricType.api_response,
      startTime: new Date("2025-11-30T10:00:00Z"),
      endTime: new Date("2025-11-30T11:00:00Z"),
      bucket: "5m",
    }

    const { result } = renderHook(() => useMetricsTimeseries(params), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.data).toEqual(baseResponse)
    })
    expect(result.current.error).toBeNull()
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/admin/metrics", {
      params: {
        bucket: "5m",
        endTime: params.endTime?.toISOString(),
        startTime: params.startTime?.toISOString(),
        type: MetricType.api_response,
      },
    })
  })

  it("surfaces error state when request fails", async () => {
    const failure = new Error("network down")
    fetchJsonMock.mockRejectedValueOnce(failure)

    const { result } = renderHook(
      () =>
        useMetricsTimeseries({
          type: MetricType.api_response,
          startTime: new Date("2025-11-30T10:00:00Z"),
          endTime: new Date("2025-11-30T11:00:00Z"),
          bucket: "60s",
        }),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.error).toBe(failure)
    })
    expect(result.current.data).toBeUndefined()
  })

  it("re-requests data when params change", async () => {
    fetchJsonMock.mockResolvedValue(baseResponse)
    const { rerender } = renderHook(
      (props: UseMetricsTimeseriesParams) => useMetricsTimeseries(props),
      {
        initialProps: {
          type: MetricType.api_response,
          startTime: new Date("2025-11-30T09:00:00Z"),
          endTime: new Date("2025-11-30T10:00:00Z"),
          bucket: "5m",
        },
        wrapper,
      }
    )

    await waitFor(() => {
      expect(fetchJsonMock).toHaveBeenCalledTimes(1)
    })

    rerender({
      type: MetricType.api_response,
      startTime: new Date("2025-11-30T00:00:00Z"),
      endTime: new Date("2025-12-01T00:00:00Z"),
      bucket: "1h",
      compareWindow: "24h",
    })

    await waitFor(() => {
      expect(fetchJsonMock).toHaveBeenCalledTimes(2)
    })

    const lastCall = fetchJsonMock.mock.calls.at(-1)?.[1]
    expect(lastCall?.params).toMatchObject({
      bucket: "1h",
      compareWindow: "24h",
    })
  })
})
