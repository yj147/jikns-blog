/**
 * 检查标签计数是否正确
 * 用于诊断标签文章计数显示错误问题
 */

import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function checkTagCounts() {
  console.log("🔍 检查标签计数...\n")

  // 1. 获取所有标签
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  })

  console.log(`📊 数据库中共有 ${tags.length} 个标签\n`)

  // 2. 对每个标签，检查实际的已发布文章数量
  for (const tag of tags) {
    // 从 PostTag 表中统计已发布文章的关联数量
    const actualCount = await prisma.postTag.count({
      where: {
        tagId: tag.id,
        post: {
          published: true,
        },
      },
    })

    // 获取关联的文章详情
    const postTags = await prisma.postTag.findMany({
      where: { tagId: tag.id },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            published: true,
          },
        },
      },
    })

    const isCorrect = tag.postsCount === actualCount
    const status = isCorrect ? "✅" : "❌"

    console.log(`${status} 标签: ${tag.name} (slug: ${tag.slug})`)
    console.log(`   数据库 postsCount: ${tag.postsCount}`)
    console.log(`   实际已发布文章数: ${actualCount}`)

    if (!isCorrect) {
      console.log(`   ⚠️  计数不一致！差异: ${tag.postsCount - actualCount}`)
    }

    if (postTags.length > 0) {
      console.log(`   关联的文章:`)
      postTags.forEach((pt, index) => {
        console.log(
          `     ${index + 1}. ${pt.post.title} (ID: ${pt.post.id}, 已发布: ${pt.post.published ? "是" : "否"})`
        )
      })
    } else {
      console.log(`   无关联文章`)
    }

    console.log()
  }

  // 3. 检查是否有重复的 PostTag 记录
  console.log("🔍 检查重复的 PostTag 记录...\n")

  const allPostTags = await prisma.postTag.findMany({
    orderBy: [{ postId: "asc" }, { tagId: "asc" }],
  })

  const seen = new Set<string>()
  const duplicates: Array<{ postId: string; tagId: string }> = []

  for (const pt of allPostTags) {
    const key = `${pt.postId}-${pt.tagId}`
    if (seen.has(key)) {
      duplicates.push({ postId: pt.postId, tagId: pt.tagId })
    }
    seen.add(key)
  }

  if (duplicates.length > 0) {
    console.log(`❌ 发现 ${duplicates.length} 个重复的 PostTag 记录:`)
    duplicates.forEach((dup, index) => {
      console.log(`   ${index + 1}. postId: ${dup.postId}, tagId: ${dup.tagId}`)
    })
  } else {
    console.log(`✅ 没有重复的 PostTag 记录`)
  }

  console.log()

  // 4. 总结（注意：这里需要重新查询已发布文章的计数）
  const incorrectTags: typeof tags = []
  for (const tag of tags) {
    const actualCount = await prisma.postTag.count({
      where: {
        tagId: tag.id,
        post: {
          published: true,
        },
      },
    })
    if (tag.postsCount !== actualCount) {
      incorrectTags.push(tag)
    }
  }

  console.log("📋 总结:")
  console.log(`   总标签数: ${tags.length}`)
  console.log(`   计数正确的标签: ${tags.length - incorrectTags.length}`)
  console.log(`   计数错误的标签: ${incorrectTags.length}`)

  if (incorrectTags.length > 0) {
    console.log(`\n❌ 需要修复的标签:`)
    for (const tag of incorrectTags) {
      const actualCount = await prisma.postTag.count({
        where: {
          tagId: tag.id,
          post: {
            published: true,
          },
        },
      })
      console.log(`   - ${tag.name}: 显示 ${tag.postsCount}，实际已发布 ${actualCount}`)
    }
  }

  await prisma.$disconnect()
}

checkTagCounts().catch((error) => {
  console.error("❌ 错误:", error)
  process.exit(1)
})
