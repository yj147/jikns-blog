import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function checkDatabaseSchema() {
  console.log("=== 检查数据库 schema 状态 ===\n")

  // 检查 posts 表的生成列定义
  const postsColumns = await prisma.$queryRaw<
    Array<{
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
      is_generated: string
      generation_expression: string | null
    }>
  >`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      is_generated,
      generation_expression
    FROM information_schema.columns
    WHERE table_name = 'posts'
      AND column_name IN ('search_vector', 'contentTokens', 'titleTokens')
    ORDER BY ordinal_position
  `
  console.log("📝 posts 表相关列:")
  console.table(postsColumns)

  // 检查 activities 表
  const activitiesColumns = await prisma.$queryRaw<
    Array<{
      column_name: string
      data_type: string
      is_generated: string
      generation_expression: string | null
    }>
  >`
    SELECT
      column_name,
      data_type,
      is_generated,
      generation_expression
    FROM information_schema.columns
    WHERE table_name = 'activities'
      AND column_name IN ('search_vector', 'contentTokens')
    ORDER BY ordinal_position
  `
  console.log("\n💬 activities 表相关列:")
  console.table(activitiesColumns)

  // 检查一条文章数据
  const samplePost = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      titleTokens: string | null
      contentTokens: string | null
      search_vector: any
    }>
  >`
    SELECT
      id,
      title,
      "titleTokens",
      "contentTokens",
      search_vector::text as search_vector
    FROM posts
    WHERE title LIKE '%Next.js%'
    LIMIT 1
  `
  console.log("\n📄 示例文章数据:")
  console.table(samplePost)

  await prisma.$disconnect()
}

checkDatabaseSchema().catch(console.error)
