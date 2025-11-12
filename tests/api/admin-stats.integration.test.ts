import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  realPrisma,
  cleanupTestData,
  createTestUser,
  createTestPost,
  createTestActivity,
  createTestComment,
  disconnectRealDb,
} from "../integration/setup-real-db"

vi.unmock("@/lib/prisma")
vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: vi.fn(),
}))

const permissionsModule = await import("@/lib/permissions")
const mockValidate = vi.mocked(permissionsModule.validateApiPermissions)

describe("GET /api/admin/stats", () => {
  beforeEach(async () => {
    await cleanupTestData()
    const admin = await createTestUser({ role: "ADMIN" })
    const author = await createTestUser({ role: "USER" })

    const post = await createTestPost({
      authorId: author.id,
      title: "集成测试文章",
      slug: `test-post-${Date.now()}`,
      content: "内容",
    })

    await createTestActivity({ authorId: author.id, content: "测试动态" })
    await createTestComment({ authorId: author.id, postId: post.id, content: "测试评论" })

    mockValidate.mockResolvedValue({ success: true, error: null, user: admin })
  })

  afterEach(async () => {
    await cleanupTestData()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await disconnectRealDb()
  })

  it("返回管理看板统计数据", async () => {
    const { GET } = await import("@/app/api/admin/stats/route")
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/stats"))

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.success).toBe(true)
    expect(payload.data.totals.users).toBeGreaterThan(0)
    expect(payload.data.recentActivities.length).toBeGreaterThan(0)
  })
})
