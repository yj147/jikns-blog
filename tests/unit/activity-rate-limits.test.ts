import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/rate-limit/redis-client", () => ({
  getRedisClient: vi.fn(() => null),
}))

import { rateLimitCheck, RATE_LIMITS } from "@/lib/rate-limit/activity-limits"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { getCurrentUser } from "@/lib/auth"

const mockedGetCurrentUser = vi.mocked(getCurrentUser)

function createRequest(ip = "127.0.0.1") {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "GET",
    headers: {
      "x-forwarded-for": ip,
    },
  })
}

describe("activity rate limit metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetCurrentUser.mockResolvedValue({ id: "user-1" } as any)
  })

  it("records follow rate limit metric when allowed", async () => {
    const recordSpy = vi.spyOn(performanceMonitor, "recordMetric")

    const result = await rateLimitCheck(createRequest(), "follow")

    expect(result.success).toBe(true)

    const metricCall = recordSpy.mock.calls.find(
      (call) => call[0].type === MetricType.FOLLOW_ACTION_RATE_LIMIT
    )
    expect(metricCall).toBeDefined()
    expect(metricCall?.[0].context?.additionalData).toMatchObject({
      action: "follow",
      allowed: "true",
    })

    recordSpy.mockRestore()
  })

  it("records follow rate limit metric when denied", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: "user-deny" } as any)
    const recordSpy = vi.spyOn(performanceMonitor, "recordMetric")

    const ip = "10.0.0.1"
    const limit = RATE_LIMITS.follow.maxRequests
    for (let i = 0; i < limit; i += 1) {
      await rateLimitCheck(createRequest(ip), "follow")
    }

    const result = await rateLimitCheck(createRequest(ip), "follow")

    expect(result.success).toBe(false)

    const deniedCall = recordSpy.mock.calls.find(
      (call) =>
        call[0].type === MetricType.FOLLOW_ACTION_RATE_LIMIT &&
        call[0].context?.additionalData?.allowed === "false"
    )

    expect(deniedCall).toBeDefined()
    expect(deniedCall?.[0].context?.additionalData).toMatchObject({
      action: "follow",
      allowed: "false",
    })

    recordSpy.mockRestore()
  })

  it("records follow-status metric", async () => {
    const recordSpy = vi.spyOn(performanceMonitor, "recordMetric")

    const result = await rateLimitCheck(createRequest(), "follow-status")

    expect(result.success).toBe(true)

    const metricCall = recordSpy.mock.calls.find(
      (call) => call[0].type === MetricType.FOLLOW_ACTION_RATE_LIMIT
    )
    expect(metricCall).toBeDefined()
    expect(metricCall?.[0].context?.additionalData).toMatchObject({
      action: "follow-status",
      allowed: "true",
    })

    recordSpy.mockRestore()
  })
})
