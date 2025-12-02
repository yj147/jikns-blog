import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as cronHandler } from "@/app/api/cron/email-queue/route"
import { processEmailQueue } from "@/lib/cron/email-queue"

vi.mock("@/lib/cron/email-queue", () => ({
  processEmailQueue: vi.fn(),
}))

const mockedProcessEmailQueue = vi.mocked(processEmailQueue)
const originalCronSecret = process.env.CRON_SECRET

const buildRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost:3000/api/cron/email-queue", {
    method: "POST",
    headers,
  })

describe("/api/cron/email-queue auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = "test-cron-secret"
  })

  afterAll(() => {
    process.env.CRON_SECRET = originalCronSecret
  })

  it("returns 405 for non-POST requests", async () => {
    const res = await cronHandler(
      new NextRequest("http://localhost:3000/api/cron/email-queue", { method: "GET" })
    )
    const data = await res.json()

    expect(res.status).toBe(405)
    expect(data.error).toBe("Method not allowed")
    expect(mockedProcessEmailQueue).not.toHaveBeenCalled()
  })

  it("returns 401 when x-cron-secret is missing", async () => {
    const res = await cronHandler(buildRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(mockedProcessEmailQueue).not.toHaveBeenCalled()
  })

  it("returns 401 when x-cron-secret is incorrect", async () => {
    const res = await cronHandler(
      buildRequest({
        "x-cron-secret": "wrong-secret",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(mockedProcessEmailQueue).not.toHaveBeenCalled()
  })

  it("allows access when x-vercel-cron header is present", async () => {
    mockedProcessEmailQueue.mockResolvedValue({
      processed: 1,
      sent: 1,
      failed: 0,
    })

    const res = await cronHandler(
      buildRequest({
        "x-vercel-cron": "1",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockedProcessEmailQueue).toHaveBeenCalledTimes(1)
  })

  it("allows access when cron secret is not configured", async () => {
    mockedProcessEmailQueue.mockResolvedValue({
      processed: 0,
      sent: 0,
      failed: 0,
    })
    delete process.env.CRON_SECRET

    const res = await cronHandler(buildRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockedProcessEmailQueue).toHaveBeenCalledTimes(1)
  })

  it("allows access with correct secret", async () => {
    mockedProcessEmailQueue.mockResolvedValue({
      processed: 2,
      sent: 2,
      failed: 0,
    })

    const res = await cronHandler(
      buildRequest({
        "x-cron-secret": "test-cron-secret",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.processed).toBe(2)
    expect(mockedProcessEmailQueue).toHaveBeenCalledTimes(1)
  })

  it("returns 500 when queue processing throws", async () => {
    mockedProcessEmailQueue.mockRejectedValue(new Error("queue failure"))

    const res = await cronHandler(
      buildRequest({
        "x-cron-secret": "test-cron-secret",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe("queue failure")
    expect(mockedProcessEmailQueue).toHaveBeenCalledTimes(1)
  })
})
