"use strict"

import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function main() {
  const activitiesWithImages = await prisma.activity.findMany({
    where: { imageUrls: { isEmpty: false } },
    select: { id: true, imageUrls: true, isPinned: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  })

  const pinnedActivities = await prisma.activity.findMany({
    where: { isPinned: true },
    select: { id: true, content: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  const tagLinks = await prisma.activityTag.findMany({
    take: 5,
    select: {
      activityId: true,
      tag: { select: { slug: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  console.info("\n[activities.imageUrls != []]")
  console.table(
    activitiesWithImages.map((activity) => ({
      id: activity.id,
      imageUrl: activity.imageUrls[0],
      pinned: activity.isPinned,
      createdAt: activity.createdAt.toISOString(),
    }))
  )

  console.info("\n[pinned activities]")
  console.table(
    pinnedActivities.map((activity) => ({
      id: activity.id,
      createdAt: activity.createdAt.toISOString(),
      preview: activity.content.slice(0, 60),
    }))
  )

  console.info("\n[activity_tags sample]")
  console.table(
    tagLinks.map((link) => ({
      activityId: link.activityId,
      tag: `${link.tag.name} (${link.tag.slug})`,
    }))
  )
}

main()
  .catch((error) => {
    console.error("Failed to verify feed activity data", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
