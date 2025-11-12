import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/users/follow/status/route"
import * as interactions from "@/lib/interactions"
import * as authSession from "@/lib/auth/session"
import * as auditLog from "@/lib/audit-log"
import * as rateLimit from "@/lib/rate-limit/activity-limits"
import * as perfMonitor from "@/lib/performance-monitor"
import { ErrorCode } from "@/lib/api/unified-response"
import { AuthError } from "@/lib/error-handling/auth-error"

vi.mock("@/lib/interactions", async () => {
  const actual = await vi.importActual<typeof interactions>("@/lib/interactions")
  return {
    ...actual,
    getFollowStatusBatch: vi.fn(),
  }
})

vi.mock("@/lib/auth/session", () => ({
  assertPolicy: vi.fn(),
  generateRequestId: vi.fn(() => "req-status-test"),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  RATE_LIMITS: {
    follow: {
      windowMs: 60_000,
      maxRequests: 30,
      message: "关注操作过于频繁，请稍后再试",
    },
    "follow-status": {
      windowMs: 60_000,
      maxRequests: 20,
      message: "关注状态查询过于频繁，请稍后再试",
    },
  },
  rateLimitCheck: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  },
  MetricType: {
    FOLLOW_ACTION_DURATION: "FOLLOW_ACTION_DURATION",
  },
}))

const mockedInteractions = vi.mocked(interactions)
const mockedSession = vi.mocked(authSession)
const mockedAudit = vi.mocked(auditLog)
const mockedRateLimit = vi.mocked(rateLimit)
const mockedPerformance = vi.mocked(perfMonitor)

const mockUser = {
  id: "user-1",
  email: "user@example.com",
  status: "ACTIVE",
  role: "USER",
}

describe("follow status batch route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSession.assertPolicy.mockResolvedValue([mockUser as any, null])
    mockedRateLimit.rateLimitCheck.mockResolvedValue({ success: true } as any)
  })

  it("returns follow statuses in map format", async () => {
    // Linus 原则：API 响应格式统一
    // 现在返回键值对结构：{ [userId]: { isFollowing, isMutual } }
    mockedInteractions.getFollowStatusBatch.mockResolvedValueOnce({
      "user-2": { isFollowing: true, isMutual: false },
    })

    const request = new NextRequest("http://localhost:3000/api/users/follow/status", {
      method: "POST",
      body: JSON.stringify({ targetIds: ["user-2"] }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual({
      "user-2": { isFollowing: true, isMutual: false },
    })
    expect(body.meta).toHaveProperty("timestamp")
    expect(body.meta).toHaveProperty("requestId")
    expect(mockedInteractions.getFollowStatusBatch).toHaveBeenCalledWith("user-1", ["user-2"])
  })

  it("returns 400 when batch exceeds limit", async () => {
    const ids = Array.from({ length: 51 }, (_, idx) => `user-${idx}`)
    const request = new NextRequest("http://localhost:3000/api/users/follow/status", {
      method: "POST",
      body: JSON.stringify({ targetIds: ids }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe("LIMIT_EXCEEDED")
    expect(mockedInteractions.getFollowStatusBatch).not.toHaveBeenCalled()
  })

  it("returns 400 when targetIds contains non-string elements", async () => {
    // Linus 原则：Never break userspace
    // 严格校验数组元素类型，避免非字符串值导致 Prisma 500
    const request = new NextRequest("http://localhost:3000/api/users/follow/status", {
      method: "POST",
      body: JSON.stringify({ targetIds: [123, null, {}, "user-2"] }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(body.error.message).toContain("非空字符串")
    expect(mockedInteractions.getFollowStatusBatch).not.toHaveBeenCalled()
  })

  it("returns 400 when targetIds contains empty strings", async () => {
    // Linus 原则：Never break userspace
    // 空字符串也会导致 Prisma 查询异常，必须在 400 层面拦截
    const request = new NextRequest("http://localhost:3000/api/users/follow/status", {
      method: "POST",
      body: JSON.stringify({ targetIds: ["user-1", "", "  ", "user-2"] }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(body.error.message).toContain("非空字符串")
    expect(mockedInteractions.getFollowStatusBatch).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    const fixedNow = 1_700_000_000_000
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(fixedNow)
    const resetTime = new Date(fixedNow + 45_000)

    mockedRateLimit.rateLimitCheck.mockResolvedValueOnce({
      success: false,
      message: "too many",
      resetTime,
      backend: "memory",
    } as any)

    const request = new NextRequest("http://localhost:3000/api/users/follow/status", {
      method: "POST",
      body: JSON.stringify({ targetIds: ["user-2"] }),
      headers: { "Content-Type": "application/json" },
    })

    try {
      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
      expect(response.headers.get("Retry-After")).toBe("45")
      expect(response.headers.get("X-RateLimit-Limit")).toBe("20")
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0")
      expect(response.headers.get("X-RateLimit-Backend")).toBe("memory")
      expect(response.headers.get("X-RateLimit-Reset")).toBe(resetTime.toISOString())
    } finally {
      nowSpy.mockRestore()
    }
  })

  it("returns auth error when policy fails", async () => {
    const authError = new AuthError("Unauthorized", "UNAUTHORIZED", 401)
    mockedSession.assertPolicy.mockResolvedValueOnce([null, authError])

    const request = new NextRequest("http://localhost:3000/api/users/follow/status", {
      method: "POST",
      body: JSON.stringify({ targetIds: ["user-2"] }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED)
    expect(mockedInteractions.getFollowStatusBatch).not.toHaveBeenCalled()
  })
})
