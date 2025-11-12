/**
 * 清理重复的文章
 * 用于删除未发布的重复文章，保留已发布的版本
 */

import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function cleanDuplicatePosts() {
  console.log("🔍 检查重复的文章...\n")

  try {
    // 1. 获取所有文章，按标题分组
    const allPosts = await prisma.post.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // 2. 按标题分组
    const postsByTitle = new Map<string, typeof allPosts>()
    for (const post of allPosts) {
      const title = post.title.trim()
      if (!postsByTitle.has(title)) {
        postsByTitle.set(title, [])
      }
      postsByTitle.get(title)!.push(post)
    }

    // 3. 找出重复的文章
    const duplicates: Array<{
      title: string
      posts: typeof allPosts
    }> = []

    for (const [title, posts] of postsByTitle.entries()) {
      if (posts.length > 1) {
        duplicates.push({ title, posts })
      }
    }

    if (duplicates.length === 0) {
      console.log("✅ 没有发现重复的文章")
      await prisma.$disconnect()
      return
    }

    console.log(`❌ 发现 ${duplicates.length} 组重复的文章:\n`)

    // 4. 显示重复的文章
    for (const dup of duplicates) {
      console.log(`📝 标题: "${dup.title}"`)
      console.log(`   共有 ${dup.posts.length} 篇文章:\n`)

      dup.posts.forEach((post, index) => {
        console.log(`   ${index + 1}. ID: ${post.id}`)
        console.log(`      已发布: ${post.published ? "是" : "否"}`)
        console.log(`      创建时间: ${post.createdAt.toLocaleString("zh-CN")}`)
        console.log(`      标签: ${post.tags.map((t) => t.tag.name).join(", ")}`)
        console.log()
      })
    }

    // 5. 询问用户是否要删除未发布的重复文章
    console.log("🤔 建议操作:")
    console.log("   - 保留已发布的文章")
    console.log("   - 删除未发布的重复文章")
    console.log()

    // 6. 自动删除未发布的重复文章
    const postsToDelete: string[] = []

    for (const dup of duplicates) {
      // 找出已发布的文章
      const publishedPosts = dup.posts.filter((p) => p.published)
      const unpublishedPosts = dup.posts.filter((p) => !p.published)

      if (publishedPosts.length > 0 && unpublishedPosts.length > 0) {
        // 如果有已发布的文章，删除未发布的
        unpublishedPosts.forEach((post) => {
          postsToDelete.push(post.id)
          console.log(`❌ 将删除未发布的文章: "${post.title}" (ID: ${post.id})`)
        })
      } else if (publishedPosts.length === 0 && unpublishedPosts.length > 1) {
        // 如果都是未发布的，保留最新的，删除旧的
        const sortedPosts = unpublishedPosts.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )
        sortedPosts.slice(1).forEach((post) => {
          postsToDelete.push(post.id)
          console.log(`❌ 将删除旧的未发布文章: "${post.title}" (ID: ${post.id})`)
        })
      } else if (publishedPosts.length > 1) {
        // 如果有多篇已发布的，保留最新的，删除旧的
        const sortedPosts = publishedPosts.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )
        sortedPosts.slice(1).forEach((post) => {
          postsToDelete.push(post.id)
          console.log(`❌ 将删除旧的已发布文章: "${post.title}" (ID: ${post.id})`)
        })
      }
    }

    if (postsToDelete.length === 0) {
      console.log("\n✅ 没有需要删除的文章")
      await prisma.$disconnect()
      return
    }

    console.log(`\n🔄 准备删除 ${postsToDelete.length} 篇文章...\n`)

    // 7. 执行删除
    await prisma.$transaction(async (tx) => {
      for (const postId of postsToDelete) {
        const post = allPosts.find((p) => p.id === postId)
        if (!post) continue

        // 获取受影响的标签ID
        const affectedTagIds = post.tags.map((t) => t.tagId)

        // 删除文章（会自动删除 PostTag 关联）
        await tx.post.delete({
          where: { id: postId },
        })

        console.log(`✅ 已删除文章: "${post.title}" (ID: ${postId})`)

        // 重新计算标签计数
        if (affectedTagIds.length > 0) {
          for (const tagId of affectedTagIds) {
            const count = await tx.postTag.count({ where: { tagId } })
            await tx.tag.update({
              where: { id: tagId },
              data: { postsCount: Math.max(count, 0) },
            })
          }
        }
      }
    })

    console.log(`\n✅ 成功删除 ${postsToDelete.length} 篇重复文章`)

    // 8. 验证结果
    console.log(`\n🔍 验证清理结果...\n`)

    const remainingPosts = await prisma.post.findMany({
      orderBy: { createdAt: "asc" },
    })

    const remainingByTitle = new Map<string, number>()
    for (const post of remainingPosts) {
      const title = post.title.trim()
      remainingByTitle.set(title, (remainingByTitle.get(title) || 0) + 1)
    }

    let stillHasDuplicates = false
    for (const [title, count] of remainingByTitle.entries()) {
      if (count > 1) {
        console.log(`❌ 仍有重复: "${title}" (${count} 篇)`)
        stillHasDuplicates = true
      }
    }

    if (!stillHasDuplicates) {
      console.log(`✅ 所有重复文章已清理完成！`)
    }

    console.log(`\n📋 最终统计:`)
    console.log(`   总文章数: ${remainingPosts.length}`)
    console.log(`   已删除: ${postsToDelete.length}`)

    await prisma.$disconnect()
  } catch (error) {
    console.error("❌ 清理过程中出错:", error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

cleanDuplicatePosts().catch((error) => {
  console.error("❌ 错误:", error)
  process.exit(1)
})
