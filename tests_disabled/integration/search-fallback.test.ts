/**
 * 搜索仓储 fallback 集成测试（真实数据库）
 * 覆盖 LIKE 降级路径的 tag/author/date 组合，防止回归
 */

import { randomUUID } from "node:crypto"
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { realPrisma, cleanupTestData, createTestUser, disconnectRealDb } from "./setup-real-db"
import { PrismaClient } from "@/lib/generated/prisma"
import { searchPosts } from "@/lib/repos/search/posts"
import { searchActivities } from "@/lib/repos/search/activities"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/performance-monitor", () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
  },
  MetricType: {
    SEARCH_REPO_FALLBACK_TRIGGERED: "SEARCH_REPO_FALLBACK_TRIGGERED",
  },
}))

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
process.env.DATABASE_URL = TEST_DB_URL

vi.unmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
}))

describe.sequential("搜索 fallback 集成", () => {
  beforeAll(async () => {
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await disconnectRealDb()
  })

  beforeEach(async () => {
    await cleanupTestData()
  })

  it("文章 fallback 应满足 tag + author + 日期过滤", async () => {
    const author = await createTestUser({ email: `fallback-author-${randomUUID()}@example.com` })
    const anotherAuthor = await createTestUser({
      email: `fallback-author-b-${randomUUID()}@example.com`,
    })

    const tagAId = randomUUID()
    const tagBId = randomUUID()
    const tagA = await realPrisma.tag.create({
      data: {
        name: `FallbackTagA-${tagAId}`,
        slug: `fallback-tag-a-${tagAId}`,
        postsCount: 0,
      },
    })
    const tagB = await realPrisma.tag.create({
      data: {
        name: `FallbackTagB-${tagBId}`,
        slug: `fallback-tag-b-${tagBId}`,
        postsCount: 0,
      },
    })

    const matchingPost = await realPrisma.post.create({
      data: {
        title: "Prisma fallback post",
        slug: `fallback-post-${randomUUID()}`,
        content: "This post should match fallback with combined filters",
        excerpt: "fallback excerpt",
        authorId: author.id,
        published: true,
        publishedAt: new Date("2024-01-15T10:00:00.000Z"),
      },
    })
    await realPrisma.postTag.create({ data: { postId: matchingPost.id, tagId: tagA.id } })
    await realPrisma.postTag.create({ data: { postId: matchingPost.id, tagId: tagB.id } })

    const missingTagPost = await realPrisma.post.create({
      data: {
        title: "Missing tag fallback post",
        slug: `fallback-post-missing-${randomUUID()}`,
        content: "Should be filtered because only one tag matches",
        excerpt: "no tag",
        authorId: author.id,
        published: true,
        publishedAt: new Date("2024-01-16T10:00:00.000Z"),
      },
    })
    await realPrisma.postTag.create({ data: { postId: missingTagPost.id, tagId: tagA.id } })

    await realPrisma.post.create({
      data: {
        title: "Out of range fallback post",
        slug: `fallback-post-out-${randomUUID()}`,
        content: "Should be filtered because publishedAt is outside range",
        excerpt: "out of range",
        authorId: author.id,
        published: true,
        publishedAt: new Date("2024-03-01T10:00:00.000Z"),
      },
    })

    const otherAuthorPost = await realPrisma.post.create({
      data: {
        title: "Other author fallback post",
        slug: `fallback-post-other-${randomUUID()}`,
        content: "Should be filtered due to authorId mismatch",
        excerpt: "other author",
        authorId: anotherAuthor.id,
        published: true,
        publishedAt: new Date("2024-01-15T11:00:00.000Z"),
      },
    })
    await realPrisma.postTag.create({ data: { postId: otherAuthorPost.id, tagId: tagA.id } })
    await realPrisma.postTag.create({ data: { postId: otherAuthorPost.id, tagId: tagB.id } })

    const draftPost = await realPrisma.post.create({
      data: {
        title: "Draft fallback post",
        slug: `fallback-post-draft-${randomUUID()}`,
        content: "Should be filtered because onlyPublished=true",
        excerpt: "draft",
        authorId: author.id,
        published: false,
      },
    })
    await realPrisma.postTag.create({ data: { postId: draftPost.id, tagId: tagA.id } })
    await realPrisma.postTag.create({ data: { postId: draftPost.id, tagId: tagB.id } })

    const originalTransaction = PrismaClient.prototype.$transaction.bind(realPrisma)
    const transactionSpy = vi.spyOn(realPrisma, "$transaction")
    transactionSpy.mockImplementationOnce(async () => {
      transactionSpy.mockImplementation(originalTransaction)
      throw new Error("force fallback")
    })

    const result = await searchPosts({
      query: "fallback post",
      tagIds: [tagA.id, tagB.id],
      authorId: author.id,
      onlyPublished: true,
      publishedFrom: new Date("2024-01-10T00:00:00.000Z"),
      publishedTo: new Date("2024-01-31T23:59:59.000Z"),
      limit: 10,
      offset: 0,
      sort: "relevance",
    })

    expect(transactionSpy).toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe(matchingPost.id)
    expect(result.items[0].tags.map((tag) => tag.id).sort()).toEqual([tagA.id, tagB.id].sort())
    transactionSpy.mockRestore()
  })

  it("文章搜索应在重复标签筛选时返回结果", async () => {
    const author = await createTestUser({ email: `dedupe-author-${randomUUID()}@example.com` })

    const tagA = await realPrisma.tag.create({
      data: {
        name: `DedupeTagA-${randomUUID()}`,
        slug: `dedupe-tag-a-${randomUUID()}`,
        postsCount: 0,
      },
    })
    const tagB = await realPrisma.tag.create({
      data: {
        name: `DedupeTagB-${randomUUID()}`,
        slug: `dedupe-tag-b-${randomUUID()}`,
        postsCount: 0,
      },
    })

    const post = await realPrisma.post.create({
      data: {
        title: "Duplicate tag search",
        slug: `duplicate-tag-post-${randomUUID()}`,
        content: "This post should be found even with duplicate tag filters",
        excerpt: "duplicate tags",
        authorId: author.id,
        published: true,
        publishedAt: new Date("2024-05-01T10:00:00.000Z"),
      },
    })
    await realPrisma.postTag.create({ data: { postId: post.id, tagId: tagA.id } })
    await realPrisma.postTag.create({ data: { postId: post.id, tagId: tagB.id } })

    const originalTransaction = PrismaClient.prototype.$transaction.bind(realPrisma)
    const transactionSpy = vi.spyOn(realPrisma, "$transaction")
    transactionSpy.mockImplementationOnce(async () => {
      transactionSpy.mockImplementation(originalTransaction)
      throw new Error("force fallback for dedupe")
    })

    const result = await searchPosts({
      query: "duplicate",
      tagIds: [tagA.id, tagA.id, tagB.id],
      authorId: author.id,
      onlyPublished: true,
      limit: 5,
      offset: 0,
      sort: "relevance",
    })

    transactionSpy.mockRestore()

    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe(post.id)
    expect(result.items[0].tags.map((tag) => tag.id).sort()).toEqual([tagA.id, tagB.id].sort())
  })

  it("文章 fallback 在 onlyPublished=false 时应基于 createdAt 过滤草稿", async () => {
    const author = await createTestUser({ email: `fallback-draft-${randomUUID()}@example.com` })

    const inRangeDraft = await realPrisma.post.create({
      data: {
        title: "Draft fallback in range",
        slug: `fallback-draft-in-${randomUUID()}`,
        content: "Draft content that should match fallback date range",
        excerpt: "draft in range",
        authorId: author.id,
        published: false,
        createdAt: new Date("2024-02-10T10:00:00.000Z"),
      },
    })

    await realPrisma.post.create({
      data: {
        title: "Draft fallback out of range",
        slug: `fallback-draft-out-${randomUUID()}`,
        content: "Should be filtered due to createdAt outside range",
        excerpt: "draft out range",
        authorId: author.id,
        published: false,
        createdAt: new Date("2024-01-10T10:00:00.000Z"),
      },
    })

    const originalTransaction = PrismaClient.prototype.$transaction.bind(realPrisma)
    const transactionSpy = vi.spyOn(realPrisma, "$transaction")
    transactionSpy.mockImplementationOnce(async () => {
      transactionSpy.mockImplementation(originalTransaction)
      throw new Error("force fallback")
    })

    const result = await searchPosts({
      query: "draft fallback",
      onlyPublished: false,
      publishedFrom: new Date("2024-02-01T00:00:00.000Z"),
      publishedTo: new Date("2024-02-28T23:59:59.000Z"),
      limit: 10,
      offset: 0,
      sort: "relevance",
    })

    expect(transactionSpy).toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe(inRangeDraft.id)
    transactionSpy.mockRestore()
  })

  it("动态 fallback 应过滤 deletedAt 且尊重 authorId", async () => {
    const author = await createTestUser({ email: `fallback-activity-${randomUUID()}@example.com` })
    const otherAuthor = await createTestUser({
      email: `fallback-activity-b-${randomUUID()}@example.com`,
    })

    const visibleActivity = await realPrisma.activity.create({
      data: {
        content: "Activity fallback target content",
        authorId: author.id,
        createdAt: new Date("2024-03-10T10:00:00.000Z"),
      },
    })

    await realPrisma.activity.create({
      data: {
        content: "Activity fallback deleted content",
        authorId: author.id,
        deletedAt: new Date("2024-03-10T11:00:00.000Z"),
      },
    })

    await realPrisma.activity.create({
      data: {
        content: "Activity fallback other author",
        authorId: otherAuthor.id,
      },
    })

    const originalTransaction = PrismaClient.prototype.$transaction.bind(realPrisma)
    const transactionSpy = vi.spyOn(realPrisma, "$transaction")
    transactionSpy.mockImplementationOnce(async () => {
      transactionSpy.mockImplementation(originalTransaction)
      throw new Error("force fallback")
    })

    const result = await searchActivities({
      query: "fallback target",
      authorId: author.id,
      limit: 10,
      offset: 0,
      sort: "relevance",
    })

    expect(transactionSpy).toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe(visibleActivity.id)
    expect(result.items[0].author.id).toBe(author.id)
    transactionSpy.mockRestore()
  })
})
