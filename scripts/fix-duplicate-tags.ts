/**
 * 修复数据库中的重复标签问题
 */
import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function fixDuplicateTags() {
  try {
    console.log("开始修复重复标签问题...")

    // 查找所有重复的标签名称
    const duplicateTagNames = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT name, COUNT(*) as count
      FROM "public"."tags"
      GROUP BY name
      HAVING COUNT(*) > 1
    `

    console.log(`发现 ${duplicateTagNames.length} 个重复的标签名称`)

    for (const { name } of duplicateTagNames) {
      console.log(`处理重复标签: ${name}`)

      // 获取所有同名的标签
      const duplicateTags = await prisma.tag.findMany({
        where: { name },
        include: {
          posts: true,
        },
        orderBy: { createdAt: "asc" },
      })

      if (duplicateTags.length <= 1) continue

      // 保留最早创建的标签
      const keepTag = duplicateTags[0]
      const removeTagIds = duplicateTags.slice(1).map((tag) => tag.id)

      console.log(`  保留标签 ID: ${keepTag.id}, 删除标签 IDs: ${removeTagIds.join(", ")}`)

      // 更新所有关联到重复标签的文章，指向保留的标签
      for (const tagId of removeTagIds) {
        await prisma.postTag.updateMany({
          where: { tagId },
          data: { tagId: keepTag.id },
        })
      }

      // 删除重复的标签
      await prisma.tag.deleteMany({
        where: { id: { in: removeTagIds } },
      })

      // 更新保留标签的文章数量
      const postCount = await prisma.postTag.count({
        where: { tagId: keepTag.id },
      })

      await prisma.tag.update({
        where: { id: keepTag.id },
        data: { postsCount: postCount },
      })

      console.log(`  已合并标签，最终文章数量: ${postCount}`)
    }

    // 查找所有重复的 slug
    const duplicateTagSlugs = await prisma.$queryRaw<Array<{ slug: string; count: bigint }>>`
      SELECT slug, COUNT(*) as count
      FROM "public"."tags"
      GROUP BY slug
      HAVING COUNT(*) > 1
    `

    console.log(`发现 ${duplicateTagSlugs.length} 个重复的标签 slug`)

    for (const { slug } of duplicateTagSlugs) {
      console.log(`处理重复 slug: ${slug}`)

      // 获取所有同 slug 的标签
      const duplicateTags = await prisma.tag.findMany({
        where: { slug },
        include: {
          posts: true,
        },
        orderBy: { createdAt: "asc" },
      })

      if (duplicateTags.length <= 1) continue

      // 保留最早创建的标签
      const keepTag = duplicateTags[0]
      const removeTags = duplicateTags.slice(1)

      for (let i = 0; i < removeTags.length; i++) {
        const removeTag = removeTags[i]
        const newSlug = `${slug}-${i + 1}`

        console.log(`  重命名标签 "${removeTag.name}" 的 slug 为: ${newSlug}`)

        await prisma.tag.update({
          where: { id: removeTag.id },
          data: { slug: newSlug },
        })
      }
    }

    console.log("✅ 重复标签修复完成")
  } catch (error) {
    console.error("❌ 修复重复标签失败:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixDuplicateTags()
  .then(() => {
    console.log("🎉 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 脚本执行失败:", error)
    process.exit(1)
  })
