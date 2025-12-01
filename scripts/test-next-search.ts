import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function testNextSearch() {
  console.log("=== 测试 Next.js 文章搜索 ===\n")

  // 1. 查看文章的 tokens
  const post = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      titleTokens: string | null
      contentTokens: string | null
    }>
  >`
    SELECT id, title, "titleTokens", LEFT("contentTokens", 100) as "contentTokens"
    FROM posts
    WHERE title LIKE '%Next.js%'
    LIMIT 1
  `
  console.log("📄 文章信息:")
  console.table(post)

  // 2. 测试不同搜索词
  const queries = ["next", "next.js", "Next.js", "nextjs", "全栈"]

  for (const q of queries) {
    const result = await prisma.$queryRaw<
      Array<{
        title: string
        matches: boolean
      }>
    >`
      SELECT title, search_vector @@ plainto_tsquery('simple', ${q}) as matches
      FROM posts
      WHERE title LIKE '%Next.js%'
      LIMIT 1
    `
    console.log(`\n🔍 搜索词: "${q}"`)
    console.log(`   匹配: ${result[0]?.matches ? "✅ YES" : "❌ NO"}`)
  }

  // 3. 检查 tokenizer 如何处理 "Next.js"
  console.log("\n📝 分词测试:")
  const { tokenizeText } = await import("@/lib/search/tokenizer")
  const samples = ["Next.js", "Next.js 全栈开发", "next", "next.js"]
  for (const text of samples) {
    const tokens = tokenizeText(text)
    console.log(`   "${text}" -> "${tokens}"`)
  }

  await prisma.$disconnect()
}

testNextSearch().catch(console.error)
