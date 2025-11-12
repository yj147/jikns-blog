import path from "path"
import { promises as fs } from "fs"
import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

interface TagDiff {
  id: string
  name: string
  slug: string
  previous: number
  actual: number
}

async function ensureMonitoringDir(): Promise<string> {
  const dir = path.join(process.cwd(), "monitoring-data")
  await fs.mkdir(dir, { recursive: true })
  return dir
}

async function reconcileTagCounts(): Promise<{
  outputPath: string
  updated: TagDiff[]
  unchanged: number
  orphanRelations: Array<{ postId: string; tagId: string }>
}> {
  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      postsCount: true,
    },
  })

  const updated: TagDiff[] = []

  for (const tag of tags) {
    const actualCount = await prisma.postTag.count({ where: { tagId: tag.id } })

    if (tag.postsCount !== actualCount || tag.postsCount < 0) {
      await prisma.tag.update({
        where: { id: tag.id },
        data: { postsCount: actualCount },
      })

      updated.push({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        previous: tag.postsCount,
        actual: actualCount,
      })
    }
  }

  const orphanRelations = (await prisma.$queryRaw<Array<{ postId: string; tagId: string }>>`
    SELECT pt."postId" as "postId", pt."tagId" as "tagId"
    FROM "post_tags" pt
    LEFT JOIN "posts" p ON pt."postId" = p."id"
    LEFT JOIN "tags" t ON pt."tagId" = t."id"
    WHERE p."id" IS NULL OR t."id" IS NULL
  `) as Array<{ postId: string; tagId: string }>

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outputDir = await ensureMonitoringDir()
  const outputPath = path.join(outputDir, `tag-posts-count-reconciliation-${timestamp}.json`)

  const report = {
    generatedAt: new Date().toISOString(),
    totalTags: tags.length,
    reconciledTags: updated.length,
    unchangedTags: tags.length - updated.length,
    updated,
    orphanRelations,
  }

  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf-8")

  return { outputPath, updated, unchanged: tags.length - updated.length, orphanRelations }
}

async function main() {
  console.log("🔍 开始对账 Tag.postsCount 与 post_tags 关联表 ...")

  try {
    const { outputPath, updated, unchanged, orphanRelations } = await reconcileTagCounts()

    console.log(`✅ 已生成对账报告: ${outputPath}`)
    console.log(`   - 需修复标签数量: ${updated.length}`)
    console.log(`   - 已保持一致的标签数量: ${unchanged}`)

    if (updated.length > 0) {
      console.log("   - 修复详情: ")
      updated.forEach((tag) => {
        console.log(`     • ${tag.name}(${tag.id}) 从 ${tag.previous} 调整为 ${tag.actual}`)
      })
    }

    if (orphanRelations.length > 0) {
      console.warn(
        `⚠️ 发现 ${orphanRelations.length} 条孤立关联（post_tags 无对应 posts 或 tags），请手动审查`
      )
    }

    console.log("🎉 对账完成")
    process.exit(0)
  } catch (error) {
    console.error("💥 对账失败:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
