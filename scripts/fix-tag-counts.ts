/**
 * 修复标签计数
 * 重新计算所有标签的文章数量，确保 postsCount 字段与实际的 PostTag 记录数一致
 */

import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function fixTagCounts() {
  console.log("🔧 开始修复标签计数...\n")

  try {
    // 1. 获取所有标签
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
    })

    console.log(`📊 找到 ${tags.length} 个标签\n`)

    // 2. 对每个标签，重新计算文章数量
    const updates: Array<{ tagId: string; oldCount: number; newCount: number }> = []

    for (const tag of tags) {
      // 只统计已发布文章的 PostTag 记录数
      const actualCount = await prisma.postTag.count({
        where: {
          tagId: tag.id,
          post: {
            published: true,
          },
        },
      })

      // 如果计数不一致，记录下来
      if (tag.postsCount !== actualCount) {
        updates.push({
          tagId: tag.id,
          oldCount: tag.postsCount,
          newCount: actualCount,
        })

        console.log(`❌ 标签 "${tag.name}" 计数不一致:`)
        console.log(`   当前 postsCount: ${tag.postsCount}`)
        console.log(`   实际 PostTag 记录数: ${actualCount}`)
        console.log(`   需要更新为: ${actualCount}`)
        console.log()
      } else {
        console.log(`✅ 标签 "${tag.name}" 计数正确: ${tag.postsCount}`)
      }
    }

    // 3. 执行批量更新
    if (updates.length > 0) {
      console.log(`\n🔄 开始更新 ${updates.length} 个标签的计数...\n`)

      await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          await tx.tag.update({
            where: { id: update.tagId },
            data: { postsCount: update.newCount },
          })

          const tag = tags.find((t) => t.id === update.tagId)
          console.log(`✅ 已更新标签 "${tag?.name}": ${update.oldCount} → ${update.newCount}`)
        }
      })

      console.log(`\n✅ 成功更新 ${updates.length} 个标签的计数`)
    } else {
      console.log(`\n✅ 所有标签的计数都是正确的，无需更新`)
    }

    // 4. 验证修复结果
    console.log(`\n🔍 验证修复结果...\n`)

    const verifyTags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
    })

    let allCorrect = true
    for (const tag of verifyTags) {
      const actualCount = await prisma.postTag.count({
        where: {
          tagId: tag.id,
          post: {
            published: true,
          },
        },
      })

      if (tag.postsCount !== actualCount) {
        console.log(`❌ 标签 "${tag.name}" 仍然不一致: ${tag.postsCount} vs ${actualCount}`)
        allCorrect = false
      }
    }

    if (allCorrect) {
      console.log(`✅ 所有标签的计数都已正确！`)
    } else {
      console.log(`❌ 仍有标签的计数不正确，请检查数据库`)
    }

    // 5. 显示最终统计
    console.log(`\n📋 最终统计:`)
    console.log(`   总标签数: ${verifyTags.length}`)
    console.log(`   已修复: ${updates.length}`)
    console.log(`   无需修复: ${verifyTags.length - updates.length}`)

    await prisma.$disconnect()
  } catch (error) {
    console.error("❌ 修复过程中出错:", error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

fixTagCounts().catch((error) => {
  console.error("❌ 错误:", error)
  process.exit(1)
})
