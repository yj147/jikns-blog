/**
 * 集成测试：Activity 模块多态关联 XOR 约束验证（真实数据库）
 *
 * 测试目标：
 * 1. 验证 Comment 和 Like 的 XOR 约束在数据库层生效
 * 2. 确保不能插入违反约束的记录（同时为空或同时非空）
 * 3. 验证合法的多态关联可以正常创建
 *
 * 约束名称：
 * - comments_target_xor_check
 * - likes_target_xor_check
 *
 * 注意：此测试使用真实的 Supabase 本地数据库，不使用 mock Prisma
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import {
  realPrisma,
  cleanupTestData,
  createTestUser,
  createTestPost,
  createTestActivity,
  disconnectRealDb,
} from "./setup-real-db"

describe("Activity Polymorphic Constraints (Real DB)", () => {
  let testUserId: string
  let testPostId: string
  let testActivityId: string

  beforeAll(async () => {
    // 清理所有测试数据
    await cleanupTestData()

    // 创建测试用户
    const user = await createTestUser({
      id: "test-user-polymorphic",
      email: "polymorphic-test@example.com",
      name: "Polymorphic Test User",
    })
    testUserId = user.id

    // 创建测试文章
    const post = await createTestPost({
      authorId: testUserId,
      title: "Test Post for Polymorphic Constraints",
      slug: "test-post-polymorphic",
    })
    testPostId = post.id

    // 创建测试动态
    const activity = await createTestActivity({
      authorId: testUserId,
      content: "Test activity for polymorphic constraints",
    })
    testActivityId = activity.id
  })

  afterAll(async () => {
    // 清理所有测试数据
    await cleanupTestData()
    // 断开数据库连接
    await disconnectRealDb()
  })

  beforeEach(async () => {
    // 每个测试前清理评论和点赞
    await realPrisma.comment.deleteMany({
      where: {
        OR: [{ postId: testPostId }, { activityId: testActivityId }],
      },
    })
    await realPrisma.like.deleteMany({
      where: {
        OR: [{ postId: testPostId }, { activityId: testActivityId }],
      },
    })
  })

  describe("Comment XOR Constraint", () => {
    it("应该允许创建只有 postId 的评论", async () => {
      const comment = await realPrisma.comment.create({
        data: {
          content: "Valid comment on post",
          authorId: testUserId,
          postId: testPostId,
        },
      })

      expect(comment.postId).toBe(testPostId)
      expect(comment.activityId).toBeNull()
    })

    it("应该允许创建只有 activityId 的评论", async () => {
      const comment = await realPrisma.comment.create({
        data: {
          content: "Valid comment on activity",
          authorId: testUserId,
          activityId: testActivityId,
        },
      })

      expect(comment.activityId).toBe(testActivityId)
      expect(comment.postId).toBeNull()
    })

    it("应该拒绝创建 postId 和 activityId 同时为空的评论", async () => {
      await expect(
        realPrisma.comment.create({
          data: {
            content: "Invalid comment - both targets null",
            authorId: testUserId,
            // postId 和 activityId 都不提供
          },
        })
      ).rejects.toThrow(/23514|violates check constraint/)
    })

    it("应该拒绝创建 postId 和 activityId 同时非空的评论", async () => {
      await expect(
        realPrisma.$executeRaw`
          INSERT INTO comments (id, content, "authorId", "postId", "activityId", "createdAt", "updatedAt")
          VALUES ('test-invalid-comment', 'Invalid', ${testUserId}, ${testPostId}, ${testActivityId}, NOW(), NOW())
        `
      ).rejects.toThrow(/23514|violates check constraint/)
    })

    it("应该拒绝将合法评论更新为违反约束的状态", async () => {
      // 创建合法评论
      const comment = await realPrisma.comment.create({
        data: {
          content: "Valid comment",
          authorId: testUserId,
          postId: testPostId,
        },
      })

      // 尝试更新为同时非空（使用原始 SQL）
      await expect(
        realPrisma.$executeRaw`
          UPDATE comments
          SET "activityId" = ${testActivityId}
          WHERE id = ${comment.id}
        `
      ).rejects.toThrow(/23514|violates check constraint/)
    })
  })

  describe("Like XOR Constraint", () => {
    it("应该允许创建只有 postId 的点赞", async () => {
      const like = await realPrisma.like.create({
        data: {
          authorId: testUserId,
          postId: testPostId,
        },
      })

      expect(like.postId).toBe(testPostId)
      expect(like.activityId).toBeNull()
    })

    it("应该允许创建只有 activityId 的点赞", async () => {
      const like = await realPrisma.like.create({
        data: {
          authorId: testUserId,
          activityId: testActivityId,
        },
      })

      expect(like.activityId).toBe(testActivityId)
      expect(like.postId).toBeNull()
    })

    it("应该拒绝创建 postId 和 activityId 同时为空的点赞", async () => {
      await expect(
        realPrisma.like.create({
          data: {
            authorId: testUserId,
            // postId 和 activityId 都不提供
          },
        })
      ).rejects.toThrow(/23514|violates check constraint/)
    })

    it("应该拒绝创建 postId 和 activityId 同时非空的点赞", async () => {
      await expect(
        realPrisma.$executeRaw`
          INSERT INTO likes (id, "authorId", "postId", "activityId", "createdAt")
          VALUES ('test-invalid-like', ${testUserId}, ${testPostId}, ${testActivityId}, NOW())
        `
      ).rejects.toThrow(/23514|violates check constraint/)
    })

    it("应该拒绝将合法点赞更新为违反约束的状态", async () => {
      // 创建合法点赞
      const like = await realPrisma.like.create({
        data: {
          authorId: testUserId,
          postId: testPostId,
        },
      })

      // 尝试更新为同时非空（使用原始 SQL）
      await expect(
        realPrisma.$executeRaw`
          UPDATE likes
          SET "activityId" = ${testActivityId}
          WHERE id = ${like.id}
        `
      ).rejects.toThrow(/23514|violates check constraint/)
    })
  })

  describe("Constraint Metadata Verification", () => {
    it("应该能查询到 comments_target_xor_check 约束", async () => {
      const result = await realPrisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'comments'
          AND constraint_type = 'CHECK'
          AND constraint_name = 'comments_target_xor_check'
      `

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].constraint_name).toBe("comments_target_xor_check")
    })

    it("应该能查询到 likes_target_xor_check 约束", async () => {
      const result = await realPrisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'likes'
          AND constraint_type = 'CHECK'
          AND constraint_name = 'likes_target_xor_check'
      `

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].constraint_name).toBe("likes_target_xor_check")
    })
  })
})
