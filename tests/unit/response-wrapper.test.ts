import { describe, it, expect, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { performanceMonitor } from "@/lib/performance-monitor"

const createRequest = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/test", {
    method: "GET",
    headers: new Headers(headers),
  })

describe("withApiResponseMetrics", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("x-metrics-sample=0 时跳过指标记录", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const recordSpy = vi
      .spyOn(performanceMonitor, "recordApiResponse")
      .mockImplementation(() => {})
    const handler = vi.fn(async () => new Response("ok"))

    const wrapped = withApiResponseMetrics(handler)
    const request = createRequest({ "x-metrics-sample": "0" })

    const response = await wrapped(request)

    expect(response.headers.get("x-request-id")).toBeTruthy()
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it("处理器抛错时记录失败并向上抛出", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1)
    vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const recordSpy = vi
      .spyOn(performanceMonitor, "recordApiResponse")
      .mockImplementation(() => {})

    const handler = vi.fn(() => {
      throw new Error("boom")
    })

    const wrapped = withApiResponseMetrics(handler)
    const request = createRequest()

    await expect(wrapped(request)).rejects.toThrow("boom")

    expect(recordSpy).toHaveBeenCalledTimes(1)
    const [endpoint, method, duration, success] = recordSpy.mock.calls[0]
    expect(endpoint).toBe("/api/test")
    expect(method).toBe("GET")
    expect(duration).toBe(0)
    expect(success).toBe(false)
  })

  it("自定义采样率与 trace 起点会参与耗时计算", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2)
    vi.spyOn(Date, "now").mockReturnValue(1_500)
    const recordSpy = vi
      .spyOn(performanceMonitor, "recordApiResponse")
      .mockImplementation(() => {})

    const handler = vi.fn(async () => new Response("ok"))
    const wrapped = withApiResponseMetrics(handler, { sampleRate: 0.3 })
    const request = createRequest({ "x-trace-start": "1000" })

    const response = await wrapped(request)

    expect(response.headers.get("x-trace-start")).toBe("1000")
    expect(recordSpy).toHaveBeenCalledWith("/api/test", "GET", 500, true)
  })
})
