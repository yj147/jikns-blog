/**
 * 集成测试：关注服务幂等性（真实数据库）
 *
 * 场景：同一用户连续两次关注同一个目标用户，第二次应该返回 wasNew=false 并复用首次记录
 * 目的：防止 Prisma 事务在唯一约束冲突后进入 aborted 状态导致 500
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { realPrisma, cleanupTestData, createTestUser, disconnectRealDb } from "./setup-real-db"

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
process.env.DATABASE_URL = TEST_DB_URL

// 取消全局 mock，使用真实的 Prisma 客户端
vi.unmock("@/lib/prisma")

// 在取消 mock 后重新 mock，使用真实的数据库连接
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
}))

let followUser: typeof import("@/lib/interactions/follow").followUser

describe("Follow Service Idempotency (Real DB)", () => {
  let followerId: string
  let targetId: string

  beforeAll(async () => {
    ;({ followUser } = await import("@/lib/interactions/follow"))

    await cleanupTestData()

    const follower = await createTestUser({
      id: "follow-idempotency-follower",
      email: "follow-idempotency-follower@example.com",
      name: "Follow Idempotency Follower",
    })
    const target = await createTestUser({
      id: "follow-idempotency-target",
      email: "follow-idempotency-target@example.com",
      name: "Follow Idempotency Target",
    })

    followerId = follower.id
    targetId = target.id
  })

  beforeEach(async () => {
    await realPrisma.follow.deleteMany({
      where: {
        followerId,
        followingId: targetId,
      },
    })
  })

  afterAll(async () => {
    await cleanupTestData()
    await disconnectRealDb()
    const { prisma } = await import("@/lib/prisma")
    await prisma.$disconnect()
  })

  it("连续两次关注同一用户 → 第二次 should be idempotent", async () => {
    const first = await followUser(followerId, targetId)
    expect(first.wasNew).toBe(true)

    const second = await followUser(followerId, targetId)
    expect(second.wasNew).toBe(false)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.followerId).toBe(followerId)
    expect(second.followingId).toBe(targetId)

    const followRecords = await realPrisma.follow.findMany({
      where: { followerId, followingId: targetId },
    })
    expect(followRecords).toHaveLength(1)
  })
})
