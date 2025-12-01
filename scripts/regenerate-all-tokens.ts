// 强制重新生成所有搜索 tokens（不管是否已存在）
import { PrismaClient } from "@/lib/generated/prisma"
import { tokenizeText } from "@/lib/search/tokenizer"

const prisma = new PrismaClient()

async function regenerateAllTokens() {
  console.log("=== 强制重新生成所有搜索 tokens ===\n")

  // 1. 重新生成所有文章的 tokens
  console.log("📝 处理 posts...")
  const posts = await prisma.post.findMany({
    select: { id: true, title: true, excerpt: true, seoDescription: true, content: true },
  })
  console.log(`   找到 ${posts.length} 篇文章`)

  let postsUpdated = 0
  for (const post of posts) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        titleTokens: tokenizeText(post.title),
        excerptTokens: tokenizeText(post.excerpt),
        seoDescriptionTokens: tokenizeText(post.seoDescription),
        contentTokens: tokenizeText(post.content),
      },
    })
    postsUpdated++
  }
  console.log(`   ✅ 更新了 ${postsUpdated} 篇文章\n`)

  // 2. 重新生成所有标签的 tokens
  console.log("🏷️  处理 tags...")
  const tags = await prisma.tag.findMany({
    select: { id: true, name: true, description: true },
  })
  console.log(`   找到 ${tags.length} 个标签`)

  let tagsUpdated = 0
  for (const tag of tags) {
    await prisma.tag.update({
      where: { id: tag.id },
      data: {
        nameTokens: tokenizeText(tag.name),
        descriptionTokens: tokenizeText(tag.description),
      },
    })
    tagsUpdated++
  }
  console.log(`   ✅ 更新了 ${tagsUpdated} 个标签\n`)

  // 3. 重新生成所有用户的 tokens
  console.log("👤 处理 users...")
  const users = await prisma.user.findMany({
    select: { id: true, name: true, bio: true },
  })
  console.log(`   找到 ${users.length} 个用户`)

  let usersUpdated = 0
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nameTokens: tokenizeText(user.name),
        bioTokens: tokenizeText(user.bio),
      },
    })
    usersUpdated++
  }
  console.log(`   ✅ 更新了 ${usersUpdated} 个用户\n`)

  // 4. 重新生成所有动态的 tokens
  console.log("💬 处理 activities...")
  const activities = await prisma.activity.findMany({
    where: { deletedAt: null },
    select: { id: true, content: true },
  })
  console.log(`   找到 ${activities.length} 条动态`)

  let activitiesUpdated = 0
  for (const activity of activities) {
    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        contentTokens: tokenizeText(activity.content),
      },
    })
    activitiesUpdated++
  }
  console.log(`   ✅ 更新了 ${activitiesUpdated} 条动态\n`)

  console.log("=== 完成 ===")
  console.log(`总计更新:`)
  console.log(`  - posts: ${postsUpdated}`)
  console.log(`  - tags: ${tagsUpdated}`)
  console.log(`  - users: ${usersUpdated}`)
  console.log(`  - activities: ${activitiesUpdated}`)

  await prisma.$disconnect()
}

regenerateAllTokens().catch(console.error)
