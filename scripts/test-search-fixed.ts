// 测试修复后的搜索功能
import { PrismaClient } from "@/lib/generated/prisma"
import { tokenizeText } from "@/lib/search/tokenizer"

const prisma = new PrismaClient()

async function testSearchFixed() {
  console.log("=== 测试修复后的搜索功能 ===\n")

  const queries = ["next", "next.js", "Next.js", "nextjs", "全栈", "全栈开发"]

  for (const q of queries) {
    // 模拟搜索服务的行为：先分词查询
    const tokenizedQuery = tokenizeText(q)

    console.log(`\n🔍 搜索词: "${q}"`)
    console.log(`   分词后: "${tokenizedQuery}"`)

    // 测试文章搜索
    const posts = await prisma.$queryRaw<Array<{ title: string }>>`
      SELECT title
      FROM posts
      WHERE published = true
        AND search_vector @@ plainto_tsquery('simple', ${tokenizedQuery})
      LIMIT 3
    `

    console.log(`   文章匹配: ${posts.length > 0 ? "✅ YES" : "❌ NO"}`)
    if (posts.length > 0) {
      posts.forEach((p) => console.log(`     - ${p.title}`))
    }

    // 测试标签搜索
    const tags = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name
      FROM tags
      WHERE search_vector @@ plainto_tsquery('simple', ${tokenizedQuery})
      LIMIT 3
    `

    console.log(`   标签匹配: ${tags.length > 0 ? "✅ YES" : "❌ NO"}`)
    if (tags.length > 0) {
      tags.forEach((t) => console.log(`     - ${t.name}`))
    }
  }

  await prisma.$disconnect()
}

testSearchFixed().catch(console.error)
