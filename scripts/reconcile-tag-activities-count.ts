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

async function addActivitiesCountColumn() {
  await prisma.$executeRaw`
    ALTER TABLE "tags"
    ADD COLUMN IF NOT EXISTS "activitiesCount" INTEGER NOT NULL DEFAULT 0
  `
}

async function fetchActivityCounts(): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ tagId: string; count: number }>>`
    SELECT "tagId", COUNT(*)::int AS count
    FROM "activity_tags"
    GROUP BY "tagId"
  `

  const map = new Map<string, number>()
  rows.forEach((row) => map.set(row.tagId, Number(row.count) || 0))
  return map
}

async function findOrphans(): Promise<Array<{ activityId: string; tagId: string }>> {
  const orphans = await prisma.$queryRaw<Array<{ activityId: string; tagId: string }>>`
    SELECT at."activityId" as "activityId", at."tagId" as "tagId"
    FROM "activity_tags" at
    LEFT JOIN "activities" a ON at."activityId" = a."id"
    LEFT JOIN "tags" t ON at."tagId" = t."id"
    WHERE a."id" IS NULL OR t."id" IS NULL
  `

  return orphans
}

export async function reconcileTagActivitiesCount(): Promise<{
  outputPath: string
  updated: TagDiff[]
  unchanged: number
  orphanRelations: Array<{ activityId: string; tagId: string }>
}> {
  await addActivitiesCountColumn()

  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      activitiesCount: true,
    },
  })

  const countMap = await fetchActivityCounts()
  const updated: TagDiff[] = []

  for (const tag of tags) {
    const actual = countMap.get(tag.id) ?? 0
    const needsUpdate = tag.activitiesCount !== actual || tag.activitiesCount < 0

    if (needsUpdate) {
      await prisma.tag.update({
        where: { id: tag.id },
        data: { activitiesCount: actual },
      })

      updated.push({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        previous: tag.activitiesCount,
        actual,
      })
    }
  }

  const orphanRelations = await findOrphans()

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outputDir = await ensureMonitoringDir()
  const outputPath = path.join(
    outputDir,
    `tag-activities-count-reconciliation-${timestamp}.json`
  )

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
  console.log("🔍 开始对账 Tag.activitiesCount 与 activity_tags 关联表 ...")

  try {
    const { outputPath, updated, unchanged, orphanRelations } = await reconcileTagActivitiesCount()

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
        `⚠️ 发现 ${orphanRelations.length} 条孤立关联（activity_tags 无对应 activities 或 tags），请手动审查`
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

if (process.env.NODE_ENV !== "test") {
  // 避免在测试环境下自动执行，便于单元测试覆盖
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main()
}
