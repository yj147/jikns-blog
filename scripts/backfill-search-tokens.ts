import { prisma } from "@/lib/prisma"
import { tokenizeText } from "@/lib/search/tokenizer"
import type { Prisma } from "@/lib/generated/prisma"

const BATCH_SIZE = 100
const TRANSACTION_TIMEOUT_MS = 60_000

type ProgressState = {
  label: string
  total: number
  processed: number
  startedAt: number
}

function startProgress(label: string, total: number): ProgressState {
  return { label, total, processed: 0, startedAt: Date.now() }
}

function renderProgress(state: ProgressState) {
  const { label, processed, total, startedAt } = state
  const percent = total === 0 ? 100 : Math.min(100, Math.round((processed / total) * 100))
  const barWidth = 26
  const filled = Math.round((percent / 100) * barWidth)
  const bar = `${"=".repeat(filled)}${" ".repeat(barWidth - filled)}`
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)

  process.stdout.write(
    `\r${label.padEnd(12)} [${bar}] ${processed}/${total} (${percent}%) ${elapsedSeconds}s`
  )

  if (processed >= total) {
    process.stdout.write("\n")
  }
}

async function backfillPosts() {
  const where = {
    OR: [
      { titleTokens: null },
      { excerptTokens: null },
      { seoDescriptionTokens: null },
      { contentTokens: null },
    ],
  }

  const total = await prisma.post.count({ where })
  if (total === 0) {
    console.log("posts: no rows need backfill")
    return { label: "posts", total, updated: 0 }
  }

  console.log(`posts: pending ${total}`)
  const progress = startProgress("posts", total)
  let cursor: string | null = null

  while (true) {
    const batch: Array<
      Prisma.PostGetPayload<{
        select: {
          id: true
          title: true
          excerpt: true
          seoDescription: true
          content: true
        }
      }>
    > = await prisma.post.findMany({
      where,
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

    if (batch.length === 0) {
      break
    }

    await prisma.$transaction(
      async (tx) => {
        for (const post of batch) {
          await tx.post.update({
            where: { id: post.id },
            data: {
              titleTokens: tokenizeText(post.title),
              excerptTokens: tokenizeText(post.excerpt),
              seoDescriptionTokens: tokenizeText(post.seoDescription),
              contentTokens: tokenizeText(post.content),
            },
          })
        }
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    )

    cursor = batch[batch.length - 1]!.id
    progress.processed += batch.length
    renderProgress(progress)
  }

  return { label: "posts", total, updated: progress.processed }
}

async function backfillTags() {
  const where = {
    OR: [{ nameTokens: null }, { descriptionTokens: null }],
  }

  const total = await prisma.tag.count({ where })
  if (total === 0) {
    console.log("tags: no rows need backfill")
    return { label: "tags", total, updated: 0 }
  }

  console.log(`tags: pending ${total}`)
  const progress = startProgress("tags", total)
  let cursor: string | null = null

  while (true) {
    const batch: Array<
      Prisma.TagGetPayload<{
        select: {
          id: true
          name: true
          description: true
        }
      }>
    > = await prisma.tag.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
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

    if (batch.length === 0) {
      break
    }

    await prisma.$transaction(
      async (tx) => {
        for (const tag of batch) {
          await tx.tag.update({
            where: { id: tag.id },
            data: {
              nameTokens: tokenizeText(tag.name),
              descriptionTokens: tokenizeText(tag.description),
            },
          })
        }
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    )

    cursor = batch[batch.length - 1]!.id
    progress.processed += batch.length
    renderProgress(progress)
  }

  return { label: "tags", total, updated: progress.processed }
}

async function backfillUsers() {
  const where = {
    OR: [{ nameTokens: null }, { bioTokens: null }],
  }

  const total = await prisma.user.count({ where })
  if (total === 0) {
    console.log("users: no rows need backfill")
    return { label: "users", total, updated: 0 }
  }

  console.log(`users: pending ${total}`)
  const progress = startProgress("users", total)
  let cursor: string | null = null

  while (true) {
    const batch: Array<
      Prisma.UserGetPayload<{
        select: {
          id: true
          name: true
          email: true
          bio: true
        }
      }>
    > = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
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

    if (batch.length === 0) {
      break
    }

    await prisma.$transaction(
      async (tx) => {
        for (const user of batch) {
          const nameSource = [user.name, user.email].filter(Boolean).join(" ")
          await tx.user.update({
            where: { id: user.id },
            data: {
              nameTokens: tokenizeText(nameSource),
              bioTokens: tokenizeText(user.bio),
            },
          })
        }
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    )

    cursor = batch[batch.length - 1]!.id
    progress.processed += batch.length
    renderProgress(progress)
  }

  return { label: "users", total, updated: progress.processed }
}

async function backfillActivities() {
  const where = {
    contentTokens: null,
  }

  const total = await prisma.activity.count({ where })
  if (total === 0) {
    console.log("activities: no rows need backfill")
    return { label: "activities", total, updated: 0 }
  }

  console.log(`activities: pending ${total}`)
  const progress = startProgress("activities", total)
  let cursor: string | null = null

  while (true) {
    const batch: Array<
      Prisma.ActivityGetPayload<{
        select: {
          id: true
          content: true
        }
      }>
    > = await prisma.activity.findMany({
      where,
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

    if (batch.length === 0) {
      break
    }

    await prisma.$transaction(
      async (tx) => {
        for (const activity of batch) {
          await tx.activity.update({
            where: { id: activity.id },
            data: {
              contentTokens: tokenizeText(activity.content),
            },
          })
        }
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    )

    cursor = batch[batch.length - 1]!.id
    progress.processed += batch.length
    renderProgress(progress)
  }

  return { label: "activities", total, updated: progress.processed }
}

async function main() {
  console.log("=== Backfill search tokens (batch size 100) ===")
  const results = []
  results.push(await backfillPosts())
  results.push(await backfillTags())
  results.push(await backfillUsers())
  results.push(await backfillActivities())

  console.log("\nSummary:")
  for (const { label, total, updated } of results) {
    console.log(`${label.padEnd(12)} updated ${updated}/${total}`)
  }
}

main()
  .catch((error) => {
    console.error("Failed to backfill search tokens", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
