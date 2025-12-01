/**
 * 通知偏好拦截集成测试（真实数据库）
 */

import { randomUUID } from "node:crypto"
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { realPrisma, disconnectRealDb } from "./setup-real-db"

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
process.env.DATABASE_URL = TEST_DB_URL

vi.unmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
}))

let toggleLike: typeof import("@/lib/interactions/likes").toggleLike
let createComment: typeof import("@/lib/interactions/comments").createComment

let createdUserIds: string[] = []
let createdPostIds: string[] = []
let createdActivityIds: string[] = []

async function cleanupArtifacts() {
  const userIds = [...new Set(createdUserIds)]
  const postIds = [...new Set(createdPostIds)]
  const activityIds = [...new Set(createdActivityIds)]

  if (!userIds.length && !postIds.length && !activityIds.length) return

  await realPrisma.notification.deleteMany({
    where: {
      OR: [
        { recipientId: { in: userIds } },
        { actorId: { in: userIds } },
        { postId: { in: postIds } },
        { activityId: { in: activityIds } },
      ],
    },
  })

  await realPrisma.comment.deleteMany({
    where: {
      OR: [
        { authorId: { in: userIds } },
        { postId: { in: postIds } },
      ],
    },
  })

  await realPrisma.like.deleteMany({
    where: {
      OR: [
        { authorId: { in: userIds } },
        { postId: { in: postIds } },
        { activityId: { in: activityIds } },
      ],
    },
  })

  await realPrisma.post.deleteMany({ where: { id: { in: postIds } } })
  await realPrisma.activity.deleteMany({ where: { id: { in: activityIds } } })
  await realPrisma.user.deleteMany({ where: { id: { in: userIds } } })
}

async function createUser(overrides: { notificationPreferences?: Record<string, unknown> } = {}) {
  const record = await realPrisma.user.create({
    data: {
      id: randomUUID(),
      email: `notify-${randomUUID()}@example.com`,
      name: "Notify User",
      role: "USER",
      status: "ACTIVE",
      lastLoginAt: new Date(),
      updatedAt: new Date(),
      notificationPreferences: overrides.notificationPreferences ?? {},
    },
  })

  createdUserIds.push(record.id)
  return record
}

async function createPublishedPost(authorId: string) {
  const record = await realPrisma.post.create({
    data: {
      id: randomUUID(),
      title: "Post for notification",
      slug: `post-${randomUUID()}`,
      content: "content",
      excerpt: "excerpt",
      authorId,
      published: true,
      publishedAt: new Date(),
    },
  })

  createdPostIds.push(record.id)
  return record
}

async function createActivity(authorId: string) {
  const record = await realPrisma.activity.create({
    data: {
      id: randomUUID(),
      content: "Activity for notification",
      authorId,
    },
  })

  createdActivityIds.push(record.id)
  return record
}

describe("Notification Preferences Gate", () => {
  beforeAll(async () => {
    ;({ toggleLike } = await import("@/lib/interactions/likes"))
    ;({ createComment } = await import("@/lib/interactions/comments"))
  })

  beforeEach(async () => {
    createdUserIds = []
    createdPostIds = []
    createdActivityIds = []
  })

  afterEach(async () => {
    await cleanupArtifacts()
  })

  afterAll(async () => {
    await cleanupArtifacts()
    await disconnectRealDb()
    const { prisma } = await import("@/lib/prisma")
    await prisma.$disconnect()
  })

  it("关闭点赞通知后不落库", async () => {
    const recipient = await createUser({ notificationPreferences: { LIKE: false } })
    const actor = await createUser()
    const post = await createPublishedPost(recipient.id)

    await toggleLike("post", post.id, actor.id)

    const notifications = await realPrisma.notification.findMany({
      where: { recipientId: recipient.id, type: "LIKE" },
    })

    expect(notifications).toHaveLength(0)
  })

  it("开启评论通知会写入通知记录", async () => {
    const recipient = await createUser()
    const actor = await createUser()
    const post = await createPublishedPost(recipient.id)

    const comment = await createComment({
      targetType: "post",
      targetId: post.id,
      content: "hello",
      authorId: actor.id,
    })

    const notifications = await realPrisma.notification.findMany({
      where: { recipientId: recipient.id, type: "COMMENT" },
    })

    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.commentId).toBe(comment.id)
    expect(notifications[0]?.postId).toBe(post.id)
  })

  it("activity 点赞生成通知并附带 target 信息", async () => {
    const recipient = await createUser()
    const actor = await createUser()
    const activity = await createActivity(recipient.id)

    await toggleLike("activity", activity.id, actor.id)

    const notifications = await realPrisma.notification.findMany({
      where: { recipientId: recipient.id, type: "LIKE" },
    })

    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.activityId).toBe(activity.id)
    expect(notifications[0]?.postId).toBeNull()
  })

  it("关闭点赞通知后 activity 不落库", async () => {
    const recipient = await createUser({ notificationPreferences: { LIKE: false } })
    const actor = await createUser()
    const activity = await createActivity(recipient.id)

    await toggleLike("activity", activity.id, actor.id)

    const notifications = await realPrisma.notification.findMany({
      where: { recipientId: recipient.id, type: "LIKE" },
    })

    expect(notifications).toHaveLength(0)
  })
})
