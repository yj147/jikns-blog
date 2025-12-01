import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function checkSearchVectors() {
  console.log("=== 检查搜索向量状态 ===\n")

  // 检查文章
  const posts = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      has_vector: boolean
      has_content_tokens: boolean
      has_title_tokens: boolean
    }>
  >`
    SELECT
      id,
      title,
      search_vector IS NOT NULL as has_vector,
      "contentTokens" IS NOT NULL as has_content_tokens,
      "titleTokens" IS NOT NULL as has_title_tokens
    FROM posts
    LIMIT 5
  `
  console.log("📝 文章表 (posts):")
  console.table(posts)

  // 检查动态
  const activities = await prisma.$queryRaw<
    Array<{
      id: string
      content: string
      has_vector: boolean
      has_tokens: boolean
    }>
  >`
    SELECT
      id,
      LEFT(content, 30) as content,
      search_vector IS NOT NULL as has_vector,
      "contentTokens" IS NOT NULL as has_tokens
    FROM activities
    WHERE "deletedAt" IS NULL
    LIMIT 5
  `
  console.log("\n💬 动态表 (activities):")
  console.table(activities)

  // 检查标签
  const tags = await prisma.$queryRaw<
    Array<{
      name: string
      has_vector: boolean
      has_tokens: boolean
    }>
  >`
    SELECT
      name,
      search_vector IS NOT NULL as has_vector,
      "nameTokens" IS NOT NULL as has_tokens
    FROM tags
    LIMIT 5
  `
  console.log("\n🏷️  标签表 (tags):")
  console.table(tags)

  // 检查用户
  const users = await prisma.$queryRaw<
    Array<{
      name: string | null
      email: string
      has_vector: boolean
      has_tokens: boolean
    }>
  >`
    SELECT
      name,
      email,
      search_vector IS NOT NULL as has_vector,
      "nameTokens" IS NOT NULL as has_tokens
    FROM users
    LIMIT 5
  `
  console.log("\n👤 用户表 (users):")
  console.table(users)

  await prisma.$disconnect()
}

checkSearchVectors().catch(console.error)
