import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/activities/route"
import { ActivityPermissions } from "@/lib/permissions/activity-permissions"
import { Role, UserStatus } from "@/lib/generated/prisma"

const mockUser = {
  id: "user-1",
  role: Role.USER,
  status: UserStatus.ACTIVE,
  name: "测试用户",
  avatarUrl: null,
  email: "user@example.com",
} as any

const prismaMocks = vi.hoisted(() => ({
  activityCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaMocks.transaction,
  },
}))

const getCurrentUser = vi.hoisted(() => vi.fn())
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    getCurrentUser,
  }
})

const rateLimitCheck = vi.hoisted(() => vi.fn())
vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheck,
  rateLimitCheckForAction: rateLimitCheck,
}))

const extractActivityHashtags = vi.hoisted(() => vi.fn())
const syncActivityTags = vi.hoisted(() => vi.fn())
vi.mock("@/lib/services/activity-tags", () => ({
  extractActivityHashtags,
  syncActivityTags,
}))

const auditLogger = vi.hoisted(() => ({ logEvent: vi.fn() }))
const getClientIP = vi.hoisted(() => vi.fn(() => "127.0.0.1"))
const getClientUserAgent = vi.hoisted(() => vi.fn(() => "vitest"))
vi.mock("@/lib/audit-log", () => ({
  auditLogger,
  getClientIP,
  getClientUserAgent,
}))

describe("POST /api/activities - 置顶权限校验", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUser.mockResolvedValue(mockUser)
    rateLimitCheck.mockResolvedValue({ success: true })
    extractActivityHashtags.mockReturnValue(["hashtag"])
    syncActivityTags.mockResolvedValue({ tagIds: [] })
    prismaMocks.transaction.mockImplementation(async (handler: any) =>
      handler({ activity: { create: prismaMocks.activityCreate } })
    )
    prismaMocks.activityCreate.mockResolvedValue({
      id: "activity-1",
      authorId: mockUser.id,
      content: "测试内容",
      imageUrls: [],
      isPinned: true,
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: {
        id: mockUser.id,
        name: "测试用户",
        avatarUrl: null,
        role: mockUser.role,
        status: mockUser.status,
      },
    })
  })

  it("作者请求置顶时应该成功保留 isPinned", async () => {
    const request = new NextRequest("http://localhost:3000/api/activities", {
      method: "POST",
      body: JSON.stringify({ content: "测试内容", imageUrls: [], isPinned: true }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.isPinned).toBe(true)
    expect(prismaMocks.activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPinned: true }),
      })
    )
    expect(auditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_ACTIVITY",
        success: true,
        details: expect.objectContaining({ pinGranted: true }),
      })
    )
  })

  it("无置顶权限时应忽略 isPinned 并记录审计", async () => {
    const spy = vi.spyOn(ActivityPermissions, "canPin").mockReturnValue(false)

    prismaMocks.activityCreate.mockResolvedValueOnce({
      id: "activity-2",
      authorId: mockUser.id,
      content: "测试内容",
      imageUrls: [],
      isPinned: false,
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: {
        id: mockUser.id,
        name: "测试用户",
        avatarUrl: null,
        role: mockUser.role,
        status: mockUser.status,
      },
    })

    const request = new NextRequest("http://localhost:3000/api/activities", {
      method: "POST",
      body: JSON.stringify({ content: "测试内容", imageUrls: [], isPinned: true }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.isPinned).toBe(false)
    expect(prismaMocks.activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPinned: false }),
      })
    )
    expect(auditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PIN_ACTIVITY_DENIED",
        success: false,
        resource: expect.stringContaining("activity"),
      })
    )
    spy.mockRestore()
  })
})
