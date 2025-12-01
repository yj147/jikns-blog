/**
 * 关注列表隐私集成测试
 * 覆盖匿名/粉丝/非粉丝/本人在三档隐私下的访问控制
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  realPrisma,
  cleanupTestData,
  disconnectRealDb,
} from "./setup-real-db"

vi.unmock("@/lib/prisma")

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

vi.mock("@/lib/rate-limit/activity-limits", () => ({
  rateLimitCheck: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
  },
  MetricType: {
    FEED_FOLLOWING_RESULT_COUNT: "FEED_FOLLOWING_RESULT_COUNT",
  },
}))

vi.mock("@/lib/auth/session", () => ({
  getOptionalViewer: vi.fn(),
  generateRequestId: vi.fn(() => "req-follow-privacy"),
}))

import * as authSession from "@/lib/auth/session"
import type { GET as FollowersHandler } from "@/app/api/users/[userId]/followers/route"
import type { GET as FollowingHandler } from "@/app/api/users/[userId]/following/route"

const mockedGetOptionalViewer = vi.mocked(authSession.getOptionalViewer)

let getFollowers: typeof FollowersHandler
let getFollowing: typeof FollowingHandler

let publicUserId: string
let followersOnlyUserId: string
let privateUserId: string
let followerId: string
let strangerId: string
let adminId: string

describe("follow list privacy (real db)", () => {
  beforeAll(async () => {
    ;({ GET: getFollowers } = await import("@/app/api/users/[userId]/followers/route"))
    ;({ GET: getFollowing } = await import("@/app/api/users/[userId]/following/route"))

    await cleanupTestData()

    const publicUser = await realPrisma.user.create({
      data: {
        email: "public@example.com",
        name: "Public",
        privacySettings: { profileVisibility: "public" },
      },
    })

    const followersOnlyUser = await realPrisma.user.create({
      data: {
        email: "followers-only@example.com",
        name: "FollowersOnly",
        privacySettings: { profileVisibility: "followers" },
      },
    })

    const privateUser = await realPrisma.user.create({
      data: {
        email: "private@example.com",
        name: "Private",
        privacySettings: { profileVisibility: "private" },
      },
    })

    const follower = await realPrisma.user.create({
      data: {
        email: "follower@example.com",
        name: "Follower",
      },
    })

    const stranger = await realPrisma.user.create({
      data: {
        email: "stranger@example.com",
        name: "Stranger",
      },
    })

    const admin = await realPrisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: "ADMIN",
      },
    })

    publicUserId = publicUser.id
    followersOnlyUserId = followersOnlyUser.id
    privateUserId = privateUser.id
    followerId = follower.id
    strangerId = stranger.id
    adminId = admin.id
  })

  beforeEach(async () => {
    await realPrisma.follow.deleteMany()
    await realPrisma.follow.create({
      data: {
        followerId,
        followingId: followersOnlyUserId,
      },
    })
    mockedGetOptionalViewer.mockReset()
  })

  afterAll(async () => {
    await cleanupTestData()
    await disconnectRealDb()
  })

  it("public list → anonymous user can access", async () => {
    mockedGetOptionalViewer.mockResolvedValueOnce(null as any)

    const request = new NextRequest(`http://localhost:3000/api/users/${publicUserId}/followers`)
    const response = await getFollowers(request, { params: Promise.resolve({ userId: publicUserId }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("followers-only list → follower can access", async () => {
    mockedGetOptionalViewer.mockResolvedValueOnce({
      id: followerId,
      role: "USER",
      status: "ACTIVE",
    } as any)

    const request = new NextRequest(
      `http://localhost:3000/api/users/${followersOnlyUserId}/followers`
    )
    const response = await getFollowers(request, {
      params: Promise.resolve({ userId: followersOnlyUserId }),
    })

    expect(response.status).toBe(200)
  })

  it("followers-only list → non-follower gets 403", async () => {
    mockedGetOptionalViewer.mockResolvedValueOnce({
      id: strangerId,
      role: "USER",
      status: "ACTIVE",
    } as any)

    await realPrisma.follow.deleteMany({
      where: { followerId: strangerId, followingId: followersOnlyUserId },
    })

    const request = new NextRequest(
      `http://localhost:3000/api/users/${followersOnlyUserId}/followers`
    )
    const response = await getFollowers(request, {
      params: Promise.resolve({ userId: followersOnlyUserId }),
    })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe("FORBIDDEN")
  })

  it("private list → only owner can access", async () => {
    mockedGetOptionalViewer.mockResolvedValueOnce({
      id: privateUserId,
      role: "USER",
      status: "ACTIVE",
    } as any)

    const request = new NextRequest(`http://localhost:3000/api/users/${privateUserId}/followers`)
    const response = await getFollowers(request, { params: Promise.resolve({ userId: privateUserId }) })

    expect(response.status).toBe(200)
  })

  it("private list → admin bypass", async () => {
    mockedGetOptionalViewer.mockResolvedValueOnce({
      id: adminId,
      role: "ADMIN",
      status: "ACTIVE",
    } as any)

    const request = new NextRequest(`http://localhost:3000/api/users/${privateUserId}/followers`)
    const response = await getFollowers(request, { params: Promise.resolve({ userId: privateUserId }) })

    expect(response.status).toBe(200)
  })

  it("private list → anonymous gets 403", async () => {
    mockedGetOptionalViewer.mockResolvedValueOnce(null as any)

    const request = new NextRequest(`http://localhost:3000/api/users/${privateUserId}/followers`)
    const response = await getFollowers(request, { params: Promise.resolve({ userId: privateUserId }) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe("FORBIDDEN")
  })
})
