import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as cronHandler } from "@/app/api/cron/email-queue/route"
import { GET as syncCronHandler } from "@/app/api/cron/sync-view-counts/route"
import { processEmailQueue } from "@/lib/cron/email-queue"
import { runViewCountSync } from "@/lib/cron/sync-view-counts"
import { securityLogger } from "@/lib/utils/logger"

vi.mock("@/lib/cron/email-queue", () => ({
  processEmailQueue: vi.fn(),
}))

vi.mock("@/lib/cron/sync-view-counts", () => ({
  runViewCountSync: vi.fn(),
}))

const mockedProcessEmailQueue = vi.mocked(processEmailQueue)
const mockedRunViewCountSync = vi.mocked(runViewCountSync)
const securityLogSpy = () => securityLogger.security as unknown as ReturnType<typeof vi.fn>
const originalCronSecret = process.env.CRON_SECRET
const defaultCronSecret = "test-cron-secret"

const buildEmailRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost:3000/api/cron/email-queue", {
    method: "POST",
    headers,
  })

const buildSyncRequest = (headers?: Record<string, string>) =>
  new NextRequest("http://localhost:3000/api/cron/sync-view-counts", {
    method: "GET",
    headers,
  })

describe("/api/cron/email-queue auth", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = defaultCronSecret
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

  it("returns 401 when Authorization header is missing", async () => {
    const res = await cronHandler(buildEmailRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(mockedProcessEmailQueue).not.toHaveBeenCalled()

    const securitySpy = securityLogSpy()
    expect(securitySpy).toHaveBeenCalledTimes(1)
    expect(securitySpy).toHaveBeenCalledWith(
      "CRON_SECRET_INVALID",
      "high",
      expect.objectContaining({
        path: "/api/cron/email-queue",
        method: "POST",
        hasAuthHeader: false,
      })
    )
  })

  it("returns 401 when Authorization header is incorrect", async () => {
    const res = await cronHandler(
      buildEmailRequest({
        authorization: "Bearer wrong-secret",
      })
    )
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(mockedProcessEmailQueue).not.toHaveBeenCalled()

    const securitySpy = securityLogSpy()
    expect(securitySpy).toHaveBeenCalledTimes(1)
    expect(securitySpy).toHaveBeenCalledWith(
      "CRON_SECRET_INVALID",
      "high",
      expect.objectContaining({
        path: "/api/cron/email-queue",
        method: "POST",
        hasAuthHeader: true,
      })
    )
  })

  it("returns 500 when cron secret is not configured", async () => {
    delete process.env.CRON_SECRET

    const res = await cronHandler(
      buildEmailRequest({
        authorization: `Bearer ${defaultCronSecret}`,
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe("Cron secret is not configured")
    expect(mockedProcessEmailQueue).not.toHaveBeenCalled()

    const securitySpy = securityLogSpy()
    expect(securitySpy).toHaveBeenCalledTimes(1)
    expect(securitySpy).toHaveBeenCalledWith(
      "CRON_SECRET_MISSING",
      "critical",
      expect.objectContaining({
        path: "/api/cron/email-queue",
        method: "POST",
        hasAuthHeader: true,
      })
    )
  })

  it("allows access with correct secret", async () => {
    mockedProcessEmailQueue.mockResolvedValue({
      processed: 2,
      sent: 2,
      failed: 0,
    })

    const res = await cronHandler(
      buildEmailRequest({
        authorization: `Bearer ${defaultCronSecret}`,
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.processed).toBe(2)
    expect(mockedProcessEmailQueue).toHaveBeenCalledTimes(1)

    expect(securityLogSpy()).not.toHaveBeenCalled()
  })

  it("returns 500 when queue processing throws", async () => {
    mockedProcessEmailQueue.mockRejectedValue(new Error("queue failure"))

    const res = await cronHandler(
      buildEmailRequest({
        authorization: `Bearer ${defaultCronSecret}`,
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe("queue failure")
    expect(mockedProcessEmailQueue).toHaveBeenCalledTimes(1)
  })
})

describe("/api/cron/sync-view-counts auth", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = defaultCronSecret
  })

  it("returns 401 when Authorization header is missing", async () => {
    const res = await syncCronHandler(buildSyncRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(mockedRunViewCountSync).not.toHaveBeenCalled()

    const securitySpy = securityLogSpy()
    expect(securitySpy).toHaveBeenCalledTimes(1)
    expect(securitySpy).toHaveBeenCalledWith(
      "CRON_SECRET_INVALID",
      "high",
      expect.objectContaining({
        path: "/api/cron/sync-view-counts",
        method: "GET",
        hasAuthHeader: false,
      })
    )
  })

  it("returns 500 when cron secret is not configured", async () => {
    delete process.env.CRON_SECRET

    const res = await syncCronHandler(
      buildSyncRequest({
        authorization: `Bearer ${defaultCronSecret}`,
      })
    )
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe("Cron secret is not configured")
    expect(mockedRunViewCountSync).not.toHaveBeenCalled()

    const securitySpy = securityLogSpy()
    expect(securitySpy).toHaveBeenCalledTimes(1)
    expect(securitySpy).toHaveBeenCalledWith(
      "CRON_SECRET_MISSING",
      "critical",
      expect.objectContaining({
        path: "/api/cron/sync-view-counts",
        method: "GET",
        hasAuthHeader: true,
      })
    )
  })

  it("allows access with correct secret", async () => {
    mockedRunViewCountSync.mockResolvedValue({
      synced: 1,
      failed: 0,
      errors: [],
    })

    const res = await syncCronHandler(
      buildSyncRequest({
        authorization: `Bearer ${defaultCronSecret}`,
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.synced).toBe(1)
    expect(mockedRunViewCountSync).toHaveBeenCalledTimes(1)

    expect(securityLogSpy()).not.toHaveBeenCalled()
  })
})

afterAll(() => {
  process.env.CRON_SECRET = originalCronSecret
})
