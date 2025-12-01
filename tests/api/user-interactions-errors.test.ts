import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/user/interactions/route"

const validatePermissionsMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions")
  return {
    ...actual,
    validateApiPermissions: validatePermissionsMock,
    createPermissionError: vi.fn(),
  }
})

// prisma 调用在参数校验前不会执行，这里保持最小 mock
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
    activity: { findUnique: vi.fn() },
    like: { findFirst: vi.fn() },
    bookmark: { findFirst: vi.fn() },
    follow: { findFirst: vi.fn() },
  },
}))

const buildRequest = (body: any) =>
  new NextRequest("http://localhost:3000/api/user/interactions", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

describe("API /api/user/interactions error cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validatePermissionsMock.mockResolvedValue({
      success: true,
      user: { id: "u-1", email: "u@example.com", role: "USER", status: "ACTIVE" },
    })
  })

  it("returns 400 when required params missing", async () => {
    const res = await POST(buildRequest({ type: "like", targetType: "POST" }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe("INVALID_PARAMETERS")
  })

  it("returns 400 for unsupported targetType", async () => {
    const res = await POST(
      buildRequest({ type: "like", targetType: "COMMENT", targetId: "c1", action: "like" })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error.code).toBe("UNSUPPORTED_TARGET_TYPE")
  })

  it("handles malformed JSON body gracefully", async () => {
    const req = buildRequest("{not-json")
    await expect(POST(req)).rejects.toThrow()
  })

  it("unauthorized user gets 401", async () => {
    validatePermissionsMock.mockResolvedValue({
      success: false,
      error: { statusCode: 401, error: "Unauthorized" },
    })

    const res = await POST(
      buildRequest({ type: "like", targetType: "POST", targetId: "p1", action: "like" })
    )
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.success).toBe(false)
  })
})
