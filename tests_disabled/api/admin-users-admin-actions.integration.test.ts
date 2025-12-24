import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest"
import type { Mock } from "vitest"
import { NextRequest } from "next/server"
import {
  realPrisma,
  cleanupTestData,
  createTestUser,
  disconnectRealDb,
} from "../integration/setup-real-db"

vi.unmock("@/lib/prisma")
const adminRef: { current: any } = { current: null }

vi.mock("@/lib/api/unified-auth", () => ({
  withApiAuth: (_request: NextRequest, _policy: string, handler: any) =>
    handler({ user: adminRef.current, requestId: "test-admin-action" }),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  getClientIP: () => "127.0.0.1",
  getClientUserAgent: () => "vitest",
}))

vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: vi.fn(),
}))

const permissionsModule = await import("@/lib/permissions")
const mockValidate = vi.mocked(permissionsModule.validateApiPermissions)
const auditModule = await import("@/lib/audit-log")
const logEventMock = auditModule.auditLogger.logEvent as Mock

describe("管理员用户操作 API", () => {
  beforeEach(async () => {
    await cleanupTestData()
    const admin = await createTestUser({ role: "ADMIN" })
    adminRef.current = admin
    mockValidate.mockResolvedValue({ success: true, error: null, user: admin })
  })

  afterEach(async () => {
    await cleanupTestData()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await disconnectRealDb()
  })

  it("支持封禁用户", async () => {
    const target = await createTestUser({ email: "target@example.com" })
    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "BANNED" }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ userId: target.id }) })
    expect(response.status).toBe(200)

    const record = await realPrisma.users.findUniqueOrThrow({ where: { id: target.id } })
    expect(record.status).toBe("BANNED")
  })

  it("支持解除封禁并写入审计日志", async () => {
    const target = await createTestUser({
      email: "banned@example.com",
      status: "BANNED",
    })
    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ACTIVE" }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ userId: target.id }) })
    expect(response.status).toBe(200)

    const record = await realPrisma.users.findUniqueOrThrow({ where: { id: target.id } })
    expect(record.status).toBe("ACTIVE")

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_PERMISSION_UPDATE",
        resource: `user:${target.id}`,
        success: true,
        details: expect.objectContaining({
          newStatus: "ACTIVE",
        }),
      })
    )
  })

  it("支持角色切换", async () => {
    const target = await createTestUser({
      email: "role@example.com",
      role: "USER",
    })
    const { PATCH } = await import("@/app/api/admin/users/[userId]/route")

    const request = new NextRequest(`http://localhost:3000/api/admin/users/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "ADMIN" }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ userId: target.id }) })
    expect(response.status).toBe(200)

    const record = await realPrisma.users.findUniqueOrThrow({ where: { id: target.id } })
    expect(record.role).toBe("ADMIN")

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_PERMISSION_UPDATE",
        resource: `user:${target.id}`,
        success: true,
        details: expect.objectContaining({
          newRole: "ADMIN",
        }),
      })
    )
  })

  it("获取用户列表包含统计数据", async () => {
    await createTestUser({ email: "active@example.com", status: "ACTIVE" })
    const { GET } = await import("@/app/api/admin/users/route")

    const response = await GET(new NextRequest("http://localhost:3000/api/admin/users"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.summary.totalUsers).toBeGreaterThan(0)
  })
})
