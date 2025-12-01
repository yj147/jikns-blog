import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { count: vi.fn() },
    post: { count: vi.fn() },
    comment: { count: vi.fn() },
    activity: { count: vi.fn() },
  },
}))

const permissionsModule = await import("@/lib/permissions")
const mockValidate = vi.mocked(permissionsModule.validateApiPermissions)
const prismaModule = await import("@/lib/prisma")
const mockPrisma = prismaModule.prisma

describe("GET /api/admin/monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("通过 Prisma $transaction 返回聚合统计", async () => {
    mockValidate.mockResolvedValue({
      success: true,
      error: null,
      user: { id: "admin-1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE" },
    } as any)

    mockPrisma.$transaction.mockResolvedValue([12, 34, 56, 78])

    const { GET } = await import("@/app/api/admin/monitoring/route")
    const response = await GET(new NextRequest("http://localhost/api/admin/monitoring"))

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(4)
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.data).toMatchObject({
      users: 12,
      posts: 34,
      comments: 56,
      activities: 78,
    })
    expect(payload.data.generatedAt).toBeTruthy()
  })

  it("权限不足时返回 403", async () => {
    mockValidate.mockResolvedValue({
      success: false,
      error: { code: "INSUFFICIENT_PERMISSIONS", error: "无权访问", statusCode: 403 },
    } as any)

    const { GET } = await import("@/app/api/admin/monitoring/route")
    const response = await GET(new NextRequest("http://localhost/api/admin/monitoring"))

    expect(response.status).toBe(403)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe("FORBIDDEN")
  })

  it("数据库错误时返回 500", async () => {
    mockValidate.mockResolvedValue({
      success: true,
      error: null,
      user: { id: "admin-1", email: "admin@example.com", role: "ADMIN", status: "ACTIVE" },
    } as any)

    mockPrisma.$transaction.mockRejectedValueOnce(new Error("db unavailable"))

    const { GET } = await import("@/app/api/admin/monitoring/route")
    const response = await GET(new NextRequest("http://localhost/api/admin/monitoring"))

    expect(response.status).toBe(500)
    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error.code).toBe("INTERNAL_ERROR")
  })
})
