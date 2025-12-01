import { prisma } from "../lib/prisma"
import { Prisma } from "../lib/generated/prisma"

function buildTsQuery(query: string, config: "simple" | "english") {
  const escapedQuery = query.replace(/'/g, "''")
  return `plainto_tsquery('${config}', '${escapedQuery}')`
}

async function testSearch(query: string, type: string) {
  const tsQuery = buildTsQuery(query, "simple")
  const tsQueryRaw = Prisma.raw(tsQuery)

  if (type === "posts") {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, title, excerpt
      FROM posts p
      WHERE p.published = true
        AND p.search_vector @@ ${Prisma.raw(tsQuery)}
      LIMIT 5
    `
    return rows
  } else if (type === "activities") {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, content
      FROM activities a
      WHERE a."deletedAt" IS NULL
        AND a.search_vector @@ ${Prisma.raw(tsQuery)}
      LIMIT 5
    `
    return rows
  } else if (type === "tags") {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, name, description
      FROM tags t
      WHERE t.search_vector @@ ${Prisma.raw(tsQuery)}
      LIMIT 5
    `
    return rows
  } else if (type === "users") {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, name, email, bio
      FROM users u
      WHERE u.search_vector @@ ${Prisma.raw(tsQuery)}
      LIMIT 5
    `
    return rows
  }
  return []
}

async function main() {
  console.log("🔍 中文搜索测试\n")

  const tests = [
    { query: "React", type: "posts", desc: "英文关键词" },
    { query: "前端", type: "tags", desc: "中文关键词（标签）" },
    { query: "性能", type: "posts", desc: "中文关键词（文章）" },
    { query: "优化", type: "activities", desc: "中文关键词（动态）" },
    { query: "admin", type: "users", desc: "英文用户名" },
    { query: "管理员", type: "users", desc: "中文用户名" },
  ]

  for (const test of tests) {
    console.log(`\n━━━ ${test.desc}: "${test.query}" (${test.type}) ━━━`)
    const results = await testSearch(test.query, test.type)
    console.log(`找到 ${results.length} 条结果`)
    results.forEach((r, i) => {
      if (r.title) console.log(`${i + 1}. ${r.title}`)
      else if (r.email) console.log(`${i + 1}. ${r.name || "(无名)"} <${r.email}> - ${r.bio || ""}`)
      else if (r.content) console.log(`${i + 1}. ${r.content.substring(0, 50)}...`)
      else if (r.name) console.log(`${i + 1}. ${r.name} - ${r.description}`)
    })
  }

  await prisma.$disconnect()
}

main().catch(console.error)
