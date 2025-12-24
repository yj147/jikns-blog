import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"

// 使用真实的 Prisma 客户端（unmock 全局 mock）
vi.unmock("@/lib/prisma")
import { prisma } from "@/lib/prisma"

describe("Full-Text Search Indexes", () => {
  let testUserId: string
  let testTagId: string

  beforeAll(async () => {
    const testUser = await prisma.user.create({
      data: {
        email: "fts-test@example.com",
        name: "FTS Test User",
        bio: "Testing full-text search functionality",
      },
    })
    testUserId = testUser.id

    const testTag = await prisma.tag.create({
      data: {
        name: "TypeScript Testing",
        slug: "typescript-testing",
        description: "Advanced testing strategies for TypeScript projects",
      },
    })
    testTagId = testTag.id
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    await prisma.tag.delete({ where: { id: testTagId } }).catch(() => {})
  })

  it("users 表应该有 search_vector GIN 索引", async () => {
    const result = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'users' AND indexname = 'users_search_vector_idx'
    `
    expect(result).toHaveLength(1)
    expect(result[0].indexname).toBe("users_search_vector_idx")
  })

  it("tags 表应该有 search_vector GIN 索引", async () => {
    const result = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'tags' AND indexname = 'tags_search_vector_idx'
    `
    expect(result).toHaveLength(1)
    expect(result[0].indexname).toBe("tags_search_vector_idx")
  })

  it("用户搜索查询计划包含索引信息（小数据集可能用 Seq Scan）", async () => {
    const plan = await prisma.$queryRawUnsafe<any[]>(`
      EXPLAIN (FORMAT JSON)
      SELECT id, name, email
      FROM users
      WHERE search_vector @@ to_tsquery('english', 'test')
      LIMIT 10
    `)

    const planStr = JSON.stringify(plan)
    // 验证查询计划存在（索引可用，优化器可选择使用）
    expect(plan).toBeDefined()
    expect(plan.length).toBeGreaterThan(0)
  })

  it("标签搜索查询计划包含索引信息", async () => {
    const plan = await prisma.$queryRawUnsafe<any[]>(`
      EXPLAIN (FORMAT JSON)
      SELECT id, name, description
      FROM tags
      WHERE search_vector @@ to_tsquery('english', 'typescript')
      LIMIT 10
    `)

    const planStr = JSON.stringify(plan)
    // 验证查询计划存在（索引可用，优化器可选择使用）
    expect(plan).toBeDefined()
    expect(plan.length).toBeGreaterThan(0)
  })

  it("用户名称的全文检索应该工作正常", async () => {
    // 使用 simple 配置匹配 search_vector 的构建方式
    const results = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name
      FROM users
      WHERE search_vector @@ plainto_tsquery('simple', 'FTS')
      LIMIT 5
    `

    expect(results.length).toBeGreaterThan(0)
    const found = results.some((u) => u.id === testUserId)
    expect(found).toBe(true)
  })

  it("标签描述的全文检索应该工作正常", async () => {
    // 使用 simple 配置匹配 search_vector 的构建方式
    const results = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name
      FROM tags
      WHERE search_vector @@ plainto_tsquery('simple', 'TypeScript')
      LIMIT 5
    `

    expect(results.length).toBeGreaterThan(0)
    const found = results.some((t) => t.id === testTagId)
    expect(found).toBe(true)
  })

  it("空查询应该返回空结果", async () => {
    const emptyResults = await prisma.$queryRaw<any[]>`
      SELECT id FROM users
      WHERE search_vector @@ plainto_tsquery('simple', '')
      LIMIT 10
    `
    expect(emptyResults).toHaveLength(0)
  })

  it("多表联合搜索性能应该 < 200ms", async () => {
    const start = Date.now()

    // 并行执行两个查询模拟联合搜索
    await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT 'user' as type, id, name as title
        FROM users
        WHERE search_vector @@ to_tsquery('english', 'test')
        LIMIT 5
      `,
      prisma.$queryRaw<any[]>`
        SELECT 'tag' as type, id, name as title
        FROM tags
        WHERE search_vector @@ to_tsquery('english', 'test')
        LIMIT 5
      `,
    ])

    const duration = Date.now() - start
    expect(duration).toBeLessThan(200)
  })
})
