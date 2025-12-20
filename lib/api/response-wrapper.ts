import type { NextRequest } from "next/server"
import { performanceMonitor } from "@/lib/performance-monitor"
import { generateRequestId } from "@/lib/utils/request-id"

type ApiHandler<R extends Request = NextRequest> = (
  request: R,
  ...args: any[]
) => Promise<Response> | Response

const clampSampleRate = (value?: number): number => {
  if (!Number.isFinite(value as number)) return 1
  return Math.min(Math.max(Number(value), 0), 1)
}

const resolveSampleRate = (override?: number): number => {
  const envRate = Number.parseFloat(process.env.METRICS_SAMPLE_RATE ?? "")
  return clampSampleRate(override ?? envRate ?? 1)
}

const resolveTraceStart = (headerValue: string | null): number => {
  const parsed = headerValue ? Number(headerValue) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

export function withApiResponseMetrics<
  R extends Request = NextRequest,
  Handler extends ApiHandler<R> = ApiHandler<R>,
>(handler: Handler, options?: { sampleRate?: number }): Handler {
  return (async (request: R | undefined, ...args: any[]) => {
    // 在测试或直接调用时可能没有传入 request，对齐 Next.js 行为创建安全的占位对象
    const safeRequest: R =
      request ??
      (new Request("http://localhost/health", {
        method: "GET",
        headers: new Headers(),
      }) as R)

    const headers = safeRequest.headers ?? new Headers()
    const requestId = headers.get("x-request-id") ?? generateRequestId()
    const traceStart = resolveTraceStart(headers.get("x-trace-start"))
    const sampleRate = resolveSampleRate(options?.sampleRate)
    const metricsSampleHeader = headers.get("x-metrics-sample")
    const allowRecording = metricsSampleHeader !== "0"
    const shouldRecord = allowRecording && sampleRate > 0 && Math.random() < sampleRate

    const recordMetric = (success: boolean) => {
      if (!shouldRecord) return
      const duration = Math.max(Date.now() - traceStart, 0)
      const endpoint = (safeRequest as any).nextUrl?.pathname ?? new URL(safeRequest.url).pathname
      const method = (safeRequest as any).method ?? "GET"
      performanceMonitor.recordApiResponse(endpoint, method, duration, success)
    }

    try {
      const response = await handler(safeRequest, ...args)

      if (!response.headers.has("x-request-id")) {
        response.headers.set("x-request-id", requestId)
      }
      if (!response.headers.has("x-trace-start")) {
        response.headers.set("x-trace-start", String(traceStart))
      }

      recordMetric(response.ok)
      return response
    } catch (error) {
      recordMetric(false)
      throw error
    }
  }) as Handler
}
