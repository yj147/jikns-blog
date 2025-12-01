import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MonitoringDashboard } from "@/components/admin/monitoring-dashboard"
import type { MonitoringStats } from "@/types/monitoring"

const mockUseRealtimeDashboard = vi.hoisted(() => vi.fn())
const performanceMonitorMock = vi.hoisted(() => ({
  getPerformanceReport: vi.fn(),
  getRealTimeOverview: vi.fn(),
}))
const mockUseMetricsTimeseries = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-realtime-dashboard", () => ({
  useRealtimeDashboard: (...args: any[]) => mockUseRealtimeDashboard(...args),
}))

vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: performanceMonitorMock,
}))

vi.mock("@/hooks/use-metrics-timeseries", () => ({
  useMetricsTimeseries: (params: any) => mockUseMetricsTimeseries(params),
}))

vi.mock("recharts", () => {
  const Stub: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>
  return {
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    CartesianGrid: Stub,
    XAxis: Stub,
    YAxis: Stub,
    Tooltip: Stub,
    Legend: Stub,
    Area: Stub,
    Line: Stub,
  }
})

vi.mock("@/components/ui/select", () => {
  const SelectItem: React.FC<{ value: string; children: React.ReactNode }> = ({ value, children }) => (
    <option value={value}>{children}</option>
  )

  const flattenOptions = (children: React.ReactNode): React.ReactNode[] =>
    React.Children.toArray(children).flatMap((child: any) => {
      if (child?.type === SelectItem) return [child]
      if (child?.props?.children) return flattenOptions(child.props.children)
      return []
    })

  const Select: React.FC<{
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    ["aria-label"]?: string
  }> = ({ value, onValueChange, children, ...props }) => (
    <select
      aria-label={(props as any)["aria-label"]}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      data-testid="mock-select"
    >
      {flattenOptions(children)}
    </select>
  )

  const SelectTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>
  const SelectContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>
  const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => <>{placeholder}</>

  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
})

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    ["aria-label"]?: string
  }) => (
    <input
      type="checkbox"
      aria-label={(props as any)["aria-label"]}
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      data-testid="mock-switch"
    />
  ),
}))

describe("MonitoringDashboard", () => {
  const counters: MonitoringStats = {
    users: 10,
    posts: 20,
    comments: 30,
    activities: 40,
    generatedAt: new Date("2025-11-30T12:00:00Z").toISOString(),
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-11-30T12:00:00Z"))
    mockUseRealtimeDashboard.mockReturnValue({
      data: counters,
      isLoading: false,
      error: null,
      connectionState: "idle",
      isRealtimeConnected: false,
      isPollingFallback: false,
      lastUpdated: new Date("2025-11-30T12:00:00Z"),
      refresh: vi.fn(),
    })

    performanceMonitorMock.getPerformanceReport.mockResolvedValue({
      summary: {
        totalRequests: 100,
        averageResponseTime: 120,
        errorRate: 1.2,
        slowRequestsRate: 0.5,
      },
      authMetrics: {
        loginTime: { average: 100, p95: 150 } as any,
        sessionCheckTime: { average: 90, p95: 120 } as any,
        permissionCheckTime: { average: 95, p95: 130 } as any,
      },
      errorBreakdown: [],
      topSlowEndpoints: [],
    })
    performanceMonitorMock.getRealTimeOverview.mockResolvedValue({})

    mockUseMetricsTimeseries.mockImplementation((params: any) => ({
      data: {
        range: {
          startTime: params.startTime?.toISOString() ?? "",
          endTime: params.endTime?.toISOString() ?? "",
        },
        timeseries: [
          {
            timestamp: params.startTime?.toISOString() ?? new Date().toISOString(),
            avg: 80,
            p50: 70,
            p95: 110,
            count: 5,
          },
        ],
        stats: {
          total: 5,
          min: 60,
          max: 120,
          avg: 80,
          p50: 70,
          p95: 110,
        },
      },
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("切换时间范围会触发新的查询参数", async () => {
    render(<MonitoringDashboard />)

    await waitFor(() => expect(performanceMonitorMock.getPerformanceReport).toHaveBeenCalled())
    await waitFor(() => expect(mockUseMetricsTimeseries).toHaveBeenCalled())

    const firstCall = mockUseMetricsTimeseries.mock.calls[0][0]
    expect(firstCall.bucket).toBe("5m")
    expect(firstCall.compareWindow).toBeUndefined()
    expect(firstCall.endTime.getTime() - firstCall.startTime.getTime()).toBe(60 * 60 * 1000)

    const rangeSelect = (await screen.findByLabelText("选择时间范围")) as HTMLSelectElement
    fireEvent.change(rangeSelect, { target: { value: "24h" } })

    await waitFor(() => {
      const lastCall = mockUseMetricsTimeseries.mock.calls.at(-1)?.[0]
      expect(lastCall?.endTime.getTime() - lastCall?.startTime.getTime()).toBe(24 * 60 * 60 * 1000)
      expect(lastCall?.compareWindow).toBeUndefined()
    })
  })

  it("渲染性能趋势图表", async () => {
    render(<MonitoringDashboard />)

    await waitFor(() => expect(mockUseMetricsTimeseries).toHaveBeenCalled())

    expect(await screen.findByTestId("area-chart")).toBeInTheDocument()
  })
})
