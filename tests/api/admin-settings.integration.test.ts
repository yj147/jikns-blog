import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest"
import { NextRequest } from "next/server"
import { realPrisma, cleanupTestData, createTestUser, disconnectRealDb } from "../integration/setup-real-db"

vi.unmock("@/lib/prisma")
vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: vi.fn(),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  getClientIP: () => "127.0.0.1",
  getClientUserAgent: () => "vitest",
}))

const permissionsModule = await import("@/lib/permissions")
const mockValidate = vi.mocked(permissionsModule.validateApiPermissions)

describe("/api/admin/settings", () => {
  beforeEach(async () => {
    await cleanupTestData()
    const admin = await createTestUser({ role: "ADMIN" })
    mockValidate.mockResolvedValue({ success: true, error: null, user: admin })
  })

  afterEach(async () => {
    await cleanupTestData()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await disconnectRealDb()
  })

  it("保存并读取系统设置", async () => {
    const body = { key: "site.general", value: { name: "测试站点" } }
    const { POST, GET } = await import("@/app/api/admin/settings/route")

    const saveResponse = await POST(
      new NextRequest("http://localhost:3000/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(body),
      })
    )

    expect(saveResponse.status).toBe(200)

    const fetchResponse = await GET(new NextRequest("http://localhost:3000/api/admin/settings"))
    const payload = await fetchResponse.json()

    expect(payload.success).toBe(true)
    expect(payload.data.settings["site.general"].name).toBe("测试站点")
  })
})
