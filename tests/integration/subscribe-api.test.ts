import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { EmailSubscriptionStatus } from "@/lib/generated/prisma"
import { POST as subscribeHandler } from "@/app/api/subscribe/route"
import { GET as verifyHandler } from "@/app/api/subscribe/verify/route"
import { GET as unsubscribeHandler } from "@/app/api/subscribe/unsubscribe/route"
import {
  createSubscription,
  verifySubscription,
  unsubscribe,
} from "@/lib/services/email-subscription"
import { applyDistributedRateLimit } from "@/lib/rate-limit/shared"

vi.mock("@/lib/services/email-subscription", () => {
  class MockSubscriptionError extends Error {
    code: any
    status: number
    constructor(message: string, code: any, status = 400) {
      super(message)
      this.code = code
      this.status = status
    }
  }

  return {
    SubscriptionError: MockSubscriptionError,
    createSubscription: vi.fn(),
    verifySubscription: vi.fn(),
    unsubscribe: vi.fn(),
  }
})

vi.mock("@/lib/rate-limit/shared", () => ({
  applyDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    retryAfter: undefined,
    backend: "memory",
    remaining: 0,
    limit: 10,
  })),
}))

const mockedCreate = vi.mocked(createSubscription)
const mockedVerify = vi.mocked(verifySubscription)
const mockedUnsubscribe = vi.mocked(unsubscribe)
const mockedRate = vi.mocked(applyDistributedRateLimit)

describe("Subscribe API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRate.mockResolvedValue({
      allowed: true,
      retryAfter: undefined,
      backend: "memory",
      remaining: 0,
      limit: 10,
    })
  })

  it("handles subscription request", async () => {
    mockedCreate.mockResolvedValue({
      status: "pending",
      subscriber: { email: "api@example.com", status: EmailSubscriptionStatus.PENDING },
    } as any)

    const req = new NextRequest("http://localhost:3000/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: "api@example.com" }),
      headers: { "content-type": "application/json" },
    })

    const res = await subscribeHandler(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockedCreate).toHaveBeenCalledWith("api@example.com", undefined)
  })

  it("returns rate limit error when exceeded", async () => {
    mockedRate.mockResolvedValue({
      allowed: false,
      retryAfter: 3600,
      backend: "memory",
      remaining: 0,
      limit: 10,
    })

    const req = new NextRequest("http://localhost:3000/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ email: "api@example.com" }),
      headers: { "content-type": "application/json" },
    })

    const res = await subscribeHandler(req)
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.success).toBe(false)
  })

  it("verifies subscription via GET", async () => {
    mockedVerify.mockResolvedValue({
      email: "verify@example.com",
      status: EmailSubscriptionStatus.VERIFIED,
    } as any)

    const req = new NextRequest(
      "http://localhost:3000/api/subscribe/verify?token=test-token",
      { method: "GET" }
    )

    const res = await verifyHandler(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.email).toBe("verify@example.com")
    expect(mockedVerify).toHaveBeenCalledWith("test-token")
  })

  it("handles unsubscribe via GET", async () => {
    mockedUnsubscribe.mockResolvedValue({
      email: "bye@example.com",
      status: EmailSubscriptionStatus.UNSUBSCRIBED,
    } as any)

    const req = new NextRequest(
      "http://localhost:3000/api/subscribe/unsubscribe?token=bye-token",
      { method: "GET" }
    )

    const res = await unsubscribeHandler(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.status).toBe(EmailSubscriptionStatus.UNSUBSCRIBED)
    expect(mockedUnsubscribe).toHaveBeenCalledWith("bye-token")
  })
})
