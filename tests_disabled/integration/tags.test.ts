/**
 * 标签系统集成测试（真实数据库）
 * 测试标签与文章的完整关联流程
 * Phase 10 - M1 阶段
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { realPrisma, cleanupTestData, disconnectRealDb } from "./setup-real-db"
import { Prisma } from "@/lib/generated/prisma"
import { syncPostTags, recalculateTagCounts } from "@/lib/repos/tag-repo"
import { normalizeTagSlug } from "@/lib/utils/tag"

// 设置测试数据库 URL
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
process.env.DATABASE_URL = TEST_DB_URL

// 取消全局 mock，使用真实的 Prisma 客户端
vi.unmock("@/lib/prisma")

// 在取消 mock 后重新 mock，使用真实的数据库连接
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
}))

describe("标签与文章关联集成测试", () => {
  let testUserId: string
  let testPostId: string

  beforeAll(async () => {
    // 清理测试数据
    await cleanupTestData()

    // 创建测试用户
    const testUser = await realPrisma.user.create({
      data: {
        email: `test-tags-${Date.now()}@example.com`,
        name: "Test User",
        role: "ADMIN",
        status: "ACTIVE",
      },
    })
    testUserId = testUser.id

    // 创建测试文章
    const testPost = await realPrisma.post.create({
      data: {
        title: "Test Post for Tags",
        slug: `test-post-tags-${Date.now()}`,
        content: "Test content",
        excerpt: "Test excerpt",
        published: true,
        publishedAt: new Date(),
        authorId: testUserId,
      },
    })
    testPostId = testPost.id
  })

  afterAll(async () => {
    // 清理测试数据
    await realPrisma.postTag.deleteMany({
      where: { postId: testPostId },
    })
    await realPrisma.post.deleteMany({
      where: { id: testPostId },
    })
    await realPrisma.tag.deleteMany({
      where: {
        name: {
          startsWith: "TestTag",
        },
      },
    })
    await realPrisma.user.deleteMany({
      where: { id: testUserId },
    })

    // 断开数据库连接
    await disconnectRealDb()
  })

  beforeEach(async () => {
    // 每个测试前清理标签关联
    await realPrisma.postTag.deleteMany({
      where: { postId: testPostId },
    })
  })

  describe("文章创建时添加标签", () => {
    it("应该创建新标签并关联到文章", async () => {
      await realPrisma.$transaction(async (tx) => {
        const result = await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag1", "TestTag2"],
        })

        expect(result.tagIds).toHaveLength(2)

        // 验证标签已创建
        const tags = await tx.tag.findMany({
          where: {
            id: { in: result.tagIds },
          },
        })
        expect(tags).toHaveLength(2)
        expect(tags.map((t) => t.name)).toContain("TestTag1")
        expect(tags.map((t) => t.name)).toContain("TestTag2")

        // 验证关联已创建
        const postTags = await tx.postTag.findMany({
          where: { postId: testPostId },
        })
        expect(postTags).toHaveLength(2)
      })
    })

    it("应该使用已有标签", async () => {
      // 先创建一个标签
      const existingTag = await realPrisma.tag.create({
        data: {
          name: "TestTag3",
          slug: "testtag3",
          postsCount: 0,
        },
      })

      await realPrisma.$transaction(async (tx) => {
        const result = await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag3"],
        })

        expect(result.tagIds).toContain(existingTag.id)

        // 验证没有创建新标签
        const tagCount = await tx.tag.count({
          where: { name: "TestTag3" },
        })
        expect(tagCount).toBe(1)
      })
    })

    it("应该正确更新 postsCount", async () => {
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag4"],
        })

        const tag = await tx.tag.findFirst({
          where: { name: "TestTag4" },
        })

        expect(tag?.postsCount).toBe(1)
      })
    })
  })

  describe("文章更新时修改标签", () => {
    it("应该添加新标签", async () => {
      // 先添加一个标签
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag5"],
        })
      })

      // 添加另一个标签
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag5", "TestTag6"],
        })

        const postTags = await tx.postTag.findMany({
          where: { postId: testPostId },
        })
        expect(postTags).toHaveLength(2)
      })
    })

    it("应该移除标签", async () => {
      // 先添加两个标签
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag7", "TestTag8"],
        })
      })

      // 移除一个标签
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag7"],
        })

        const postTags = await tx.postTag.findMany({
          where: { postId: testPostId },
        })
        expect(postTags).toHaveLength(1)

        // 验证 postsCount 更新
        const tag8 = await tx.tag.findFirst({
          where: { name: "TestTag8" },
        })
        expect(tag8?.postsCount).toBe(0)
      })
    })

    it("应该替换标签", async () => {
      // 先添加标签
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag9"],
        })
      })

      // 替换为新标签
      await realPrisma.$transaction(async (tx) => {
        await syncPostTags({
          tx,
          postId: testPostId,
          newTagNames: ["TestTag10"],
        })

        const postTags = await tx.postTag.findMany({
          where: { postId: testPostId },
          include: { tag: true },
        })
        expect(postTags).toHaveLength(1)
        expect(postTags[0].tag.name).toBe("TestTag10")

        // 验证旧标签的 postsCount
        const tag9 = await tx.tag.findFirst({
          where: { name: "TestTag9" },
        })
        expect(tag9?.postsCount).toBe(0)
      })
    })
  })

  describe("标签删除", () => {
    it("应该级联删除 PostTag 关联", async () => {
      // 创建标签并关联到文章
      const tag = await realPrisma.tag.create({
        data: {
          name: "TestTag11",
          slug: "testtag11",
          postsCount: 0,
        },
      })

      await realPrisma.postTag.create({
        data: {
          postId: testPostId,
          tagId: tag.id,
        },
      })

      // 删除标签
      await realPrisma.tag.delete({
        where: { id: tag.id },
      })

      // 验证 PostTag 关联已被删除
      const postTag = await realPrisma.postTag.findUnique({
        where: {
          postId_tagId: {
            postId: testPostId,
            tagId: tag.id,
          },
        },
      })
      expect(postTag).toBeNull()
    })
  })

  describe("postsCount 准确性", () => {
    it("应该正确计算多篇文章关联同一标签", async () => {
      // 创建第二篇测试文章
      const post2 = await realPrisma.post.create({
        data: {
          title: "Test Post 2",
          slug: `test-post-2-${Date.now()}`,
          content: "Test content 2",
          excerpt: "Test excerpt 2",
          published: true,
          publishedAt: new Date(),
          authorId: testUserId,
        },
      })

      try {
        // 两篇文章都关联同一个标签
        await realPrisma.$transaction(async (tx) => {
          await syncPostTags({
            tx,
            postId: testPostId,
            newTagNames: ["TestTag12"],
          })
        })

        await realPrisma.$transaction(async (tx) => {
          await syncPostTags({
            tx,
            postId: post2.id,
            newTagNames: ["TestTag12"],
          })
        })

        // 验证 postsCount
        const tag = await realPrisma.tag.findFirst({
          where: { name: "TestTag12" },
        })
        expect(tag?.postsCount).toBe(2)
      } finally {
        // 清理第二篇文章
        await realPrisma.postTag.deleteMany({
          where: { postId: post2.id },
        })
        await realPrisma.post.delete({
          where: { id: post2.id },
        })
      }
    })

    it("应该通过 recalculateTagCounts 修正计数", async () => {
      // 创建标签
      const tag = await realPrisma.tag.create({
        data: {
          name: "TestTag13",
          slug: "testtag13",
          postsCount: 999, // 故意设置错误的计数
        },
      })

      // 创建关联
      await realPrisma.postTag.create({
        data: {
          postId: testPostId,
          tagId: tag.id,
        },
      })

      // 重新计算
      await realPrisma.$transaction(async (tx) => {
        await recalculateTagCounts(tx, [tag.id])
      })

      // 验证计数已修正
      const updatedTag = await realPrisma.tag.findUnique({
        where: { id: tag.id },
      })
      expect(updatedTag?.postsCount).toBe(1)
    })
  })
})
it("并发事务同时添加同一标签时 postsCount 应保持准确", async () => {
  const concurrentTagName = `TestConcurrentTag-${Date.now()}`
  const concurrentTagSlug = normalizeTagSlug(concurrentTagName)
  const secondPost = await realPrisma.post.create({
    data: {
      title: `Concurrent Post ${Date.now()}`,
      slug: `test-post-concurrent-${Date.now()}`,
      content: "Concurrent content",
      excerpt: "Concurrent excerpt",
      published: true,
      publishedAt: new Date(),
      authorId: testUserId,
    },
  })

  try {
    await Promise.all([
      realPrisma.$transaction(
        async (tx) => {
          await syncPostTags({
            tx,
            postId: testPostId,
            newTagNames: [concurrentTagName],
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      ),
      realPrisma.$transaction(
        async (tx) => {
          await syncPostTags({
            tx,
            postId: secondPost.id,
            newTagNames: [concurrentTagName],
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      ),
    ])

    const tag = await realPrisma.tag.findFirst({
      where: { slug: concurrentTagSlug },
    })

    expect(tag?.postsCount).toBe(2)
  } finally {
    await realPrisma.postTag.deleteMany({ where: { tag: { slug: concurrentTagSlug } } })
    await realPrisma.tag.deleteMany({ where: { slug: concurrentTagSlug } })
    await realPrisma.post.delete({ where: { id: secondPost.id } })
  }
})
