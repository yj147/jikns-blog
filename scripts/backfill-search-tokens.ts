import { prisma } from "@/lib/prisma"
import { tokenizeText } from "@/lib/search/tokenizer"

type PostTokenSource = {
  id: string
  title: string | null
  excerpt: string | null
  seoDescription: string | null
  content: string | null
}

type ActivityTokenSource = {
  id: string
  content: string | null
}

const BATCH_SIZE = 100

async function backfillPosts() {
  let cursor: string | null = null
  let processed = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const posts: PostTokenSource[] = await prisma.post.findMany({
      select: {
        id: true,
        title: true,
        excerpt: true,
        seoDescription: true,
        content: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    })

    if (posts.length === 0) {
      break
    }

    cursor = posts[posts.length - 1]!.id

    await Promise.all(
      posts.map((post) =>
        prisma.post.update({
          where: { id: post.id },
          data: {
            titleTokens: tokenizeText(post.title),
            excerptTokens: tokenizeText(post.excerpt),
            seoDescriptionTokens: tokenizeText(post.seoDescription),
            contentTokens: tokenizeText(post.content),
          },
        })
      )
    )

    processed += posts.length
    console.log(`[tokens] posts processed: ${processed}`)
  }
}

async function backfillActivities() {
  let cursor: string | null = null
  let processed = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const activities: ActivityTokenSource[] = await prisma.activity.findMany({
      select: {
        id: true,
        content: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    })

    if (activities.length === 0) {
      break
    }

    cursor = activities[activities.length - 1]!.id

    await Promise.all(
      activities.map((activity) =>
        prisma.activity.update({
          where: { id: activity.id },
          data: {
            contentTokens: tokenizeText(activity.content),
          },
        })
      )
    )

    processed += activities.length
    console.log(`[tokens] activities processed: ${processed}`)
  }
}

async function main() {
  await backfillPosts()
  await backfillActivities()
}

main()
  .catch((error) => {
    console.error("Failed to backfill search tokens", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
