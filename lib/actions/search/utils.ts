import "server-only"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import type { ApiError } from "@/types/api"

export type PerformanceTimer = (additionalContext?: Record<string, any>) => void

export function createPerformanceTimer(metricType: MetricType, context?: Record<string, any>) {
  const timerId = `${metricType}-${crypto.randomUUID()}`
  let stopped = false

  performanceMonitor.startTimer(timerId, context)

  return (additionalContext?: Record<string, any>) => {
    if (stopped) {
      return
    }
    performanceMonitor.endTimer(timerId, metricType, additionalContext)
    stopped = true
  }
}

export function createSearchApiError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return {
    code,
    type: code,
    message,
    details,
    timestamp: Date.now(),
    requestId: crypto.randomUUID(),
  }
}
