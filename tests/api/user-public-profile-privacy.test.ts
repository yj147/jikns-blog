import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// vi.hoisted 确保变量在 vi.mock 之前初始化
const { mockPrisma, mockGetOptionalViewer } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    follow: {
      findUnique: vi.fn(),
    },
  },
  mockGetOptionalViewer: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/auth/session", () => ({
  getOptionalViewer: mockGetOptionalViewer,
  generateRequestId: () => "test-request-id",
}))
vi.mock("@/lib/storage/signed-url", () => ({
  signAvatarUrl: vi.fn(async (url?: string | null) => (url ? `signed:${url}` : null)),
}))
vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: { recordApiResponse: vi.fn() },
}))
vi.mock("@/lib/utils/logger", () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { GET } from "@/app/api/users/[userId]/public/route"

const baseUser = {
  id: "target-user",
  name: "Target",
  avatarUrl: "avatar.png",
  bio: "bio",
  status: "ACTIVE",
  privacySettings: { profileVisibility: "public" },
  _count: { posts: 1, activities: 2, followers: 3, following: 4 },
}

function buildRequest() {
  return new NextRequest("http://localhost:3000/api/users/target-user/public")
}

describe("/api/users/[userId]/public privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockReset()
    mockPrisma.follow.findUnique.mockReset()
    mockGetOptionalViewer.mockReset()
  })

  it("denies followers-only profile for anonymous user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...baseUser,
      privacySettings: { profileVisibility: "followers" },
    })
    mockGetOptionalViewer.mockResolvedValueOnce(null)

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ userId: "target-user" }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.success).toBe(false)
    expect(mockPrisma.follow.findUnique).not.toHaveBeenCalled()
  })

  it("allows followers-only profile for follower", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...baseUser,
      privacySettings: { profileVisibility: "followers" },
    })
    mockGetOptionalViewer.mockResolvedValueOnce({
      id: "viewer-1",
      role: "USER",
      status: "ACTIVE",
    })
    mockPrisma.follow.findUnique.mockResolvedValueOnce({ followerId: "viewer-1" })

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ userId: "target-user" }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.id).toBe("target-user")
  })

  it("denies private profile for non-owner", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...baseUser,
      privacySettings: { profileVisibility: "private" },
    })
    mockGetOptionalViewer.mockResolvedValueOnce({
      id: "stranger",
      role: "USER",
      status: "ACTIVE",
    })

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ userId: "target-user" }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.success).toBe(false)
  })

  it("allows private profile for owner", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...baseUser,
      privacySettings: { profileVisibility: "private" },
    })
    mockGetOptionalViewer.mockResolvedValueOnce({
      id: "target-user",
      role: "USER",
      status: "ACTIVE",
    })

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ userId: "target-user" }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
