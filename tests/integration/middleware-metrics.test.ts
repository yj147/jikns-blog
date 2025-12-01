import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "../../middleware"

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => mockSupabaseClient,
}))

beforeAll(() => {
  process.env.DISABLE_RATE_LIMIT = "1"
})

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
})

describe("middleware metrics headers", () => {
  it("injects metrics headers for api routes", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/api/archive"))
    const response = await middleware(request)

    expect(response.headers.get("x-metrics-sample")).toBe("1")
    expect(response.headers.get("x-request-id")).toBeTruthy()
    expect(response.headers.get("x-trace-start")).toMatch(/^\d+$/)
  })

  it("reuses existing trace context when provided", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/api/archive"), {
      headers: {
        "x-request-id": "existing-id",
        "x-trace-start": "123456",
        "x-metrics-sample": "0",
      },
    })

    const response = await middleware(request)

    expect(response.headers.get("x-request-id")).toBe("existing-id")
    expect(response.headers.get("x-trace-start")).toBe("123456")
    expect(response.headers.get("x-metrics-sample")).toBe("0")
  })

  it("skips monitoring endpoints to avoid loops", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin", email: "admin@test.com" } },
      error: null,
    })

    const request = new NextRequest(new URL("http://localhost:3000/api/admin/metrics"))
    const response = await middleware(request)

    expect(response.headers.has("x-metrics-sample")).toBe(false)
    expect(response.headers.get("x-request-id")).toBeTruthy()
  })
})
