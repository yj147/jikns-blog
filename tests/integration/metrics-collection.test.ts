import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { performanceMonitor } from "@/lib/performance-monitor"

const originalSampleRate = process.env.METRICS_SAMPLE_RATE

afterEach(() => {
  vi.restoreAllMocks()
  process.env.METRICS_SAMPLE_RATE = originalSampleRate
})

describe("metrics collection pipeline", () => {
  it("middleware attaches CUID request id and trace start", async () => {
    const response = await middleware(new NextRequest("http://localhost:3000/blog"))
    const requestId = response.headers.get("x-request-id")
    const traceStartHeader = response.headers.get("x-trace-start")

    expect(requestId).toMatch(/^c[a-z0-9]{24}$/)
    expect(traceStartHeader).toBeTruthy()

    const traceStart = Number(traceStartHeader)
    expect(Number.isFinite(traceStart)).toBe(true)
    expect(Math.abs(Date.now() - traceStart)).toBeLessThan(60_000)

    const another = await middleware(new NextRequest("http://localhost:3000/blog"))
    expect(another.headers.get("x-request-id")).not.toBe(requestId)
  })

  it("wrapper uses trace-start header to record duration", async () => {
    const traceStart = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(traceStart + 120)
    process.env.METRICS_SAMPLE_RATE = "1"

    const recordSpy = vi
      .spyOn(performanceMonitor, "recordApiResponse")
      .mockImplementation(() => undefined)

    const handler = withApiResponseMetrics(async () => new Response("ok", { status: 201 }))

    const request = new NextRequest("http://localhost:3000/api/test", {
      headers: {
        "x-trace-start": String(traceStart),
        "x-request-id": "c123456789012345678901234",
      },
    })

    await handler(request)

    expect(recordSpy).toHaveBeenCalledWith("/api/test", "GET", 120, true)
  })

  it("applies 0.5 sample rate to roughly half the calls", async () => {
    process.env.METRICS_SAMPLE_RATE = "0.5"

    const randomValues = [0.1, 0.6, 0.3, 0.8]
    let idx = 0
    vi.spyOn(Math, "random").mockImplementation(() => randomValues[idx++ % randomValues.length])

    const recordSpy = vi
      .spyOn(performanceMonitor, "recordApiResponse")
      .mockImplementation(() => undefined)

    const handler = withApiResponseMetrics(async () => new Response("ok"))

    for (let i = 0; i < randomValues.length; i++) {
      await handler(new NextRequest("http://localhost:3000/api/metrics"))
    }

    expect(recordSpy).toHaveBeenCalledTimes(2)
  })

  it("disables recording when sample rate is zero", async () => {
    process.env.METRICS_SAMPLE_RATE = "0"
    vi.spyOn(Math, "random").mockReturnValue(0)

    const recordSpy = vi
      .spyOn(performanceMonitor, "recordApiResponse")
      .mockImplementation(() => undefined)

    const handler = withApiResponseMetrics(async () => new Response("ok"))
    await handler(new NextRequest("http://localhost:3000/api/metrics"))

    expect(recordSpy).not.toHaveBeenCalled()
  })
})
