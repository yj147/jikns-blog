import { Prisma } from "@/lib/generated/prisma"
import { normalizeTagNames } from "@/lib/repos/tag-repo"

const HASHTAG_REGEX = /#([\p{L}\p{N}_\-.]{1,32})/gu
const DEFAULT_MAX_TAGS = 10

export function extractActivityHashtags(content: string | null | undefined): string[] {
  if (!content) return []

  const tags = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = HASHTAG_REGEX.exec(content)) !== null) {
    const [, raw] = match
    const trimmed = raw.trim()
    if (trimmed.length < 2) continue
    tags.add(trimmed)
    if (tags.size >= DEFAULT_MAX_TAGS) break
  }

  return Array.from(tags)
}

interface SyncActivityTagsParams {
  tx: Prisma.TransactionClient
  activityId: string
  rawTagNames: string[]
  maxTags?: number
}

/**
 * 同步 Activity 的标签关联
 *
 * 策略（保持简单但计数实时）：
 * 1. 读取现有关联，删除需要去除的标签并下调计数
 * 2. 仅连接已存在的标签，对新增关联上调计数
 * 3. 未知 hashtag 写入候选池，等待管理员审核
 *
 * 优点：
 * - 用户无法突破管理员独占的标签治理
 * - 候选池保留了热门 hashtag 线索，方便后台审核
 * - 保持删除/新增对称，计数与 ActivityTag 实时一致
 */
export async function syncActivityTags({
  tx,
  activityId,
  rawTagNames,
  maxTags = DEFAULT_MAX_TAGS,
}: SyncActivityTagsParams): Promise<{ tagIds: string[] }> {
  // 标准化标签名称
  const normalizedTags = normalizeTagNames(rawTagNames, maxTags)

  const existingLinks = await tx.activityTag.findMany({
    where: { activityId },
    select: { tagId: true },
  })
  const existingTagIds = new Set(existingLinks.map((link) => link.tagId))

  if (normalizedTags.length === 0) {
    if (existingTagIds.size > 0) {
      const tagIds = Array.from(existingTagIds)
      await tx.activityTag.deleteMany({ where: { activityId } })
      await tx.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { activitiesCount: { decrement: 1 } },
      })
    }
    return { tagIds: [] }
  }

  const slugs = normalizedTags.map((tag) => tag.slug)
  const existingTags = await tx.tag.findMany({
    where: {
      slug: { in: slugs },
    },
    select: {
      id: true,
      slug: true,
    },
  })

  const tagIdBySlug = new Map(existingTags.map((tag) => [tag.slug, tag.id]))
  const now = new Date()
  const missingTags = normalizedTags.filter((tag) => !tagIdBySlug.has(tag.slug))

  if (missingTags.length > 0) {
    await Promise.all(
      missingTags.map(({ name, slug }) =>
        tx.activityTagCandidate.upsert({
          where: { slug },
          update: {
            name,
            occurrences: { increment: 1 },
            lastSeenAt: now,
            lastSeenActivityId: activityId,
          },
          create: {
            name,
            slug,
            occurrences: 1,
            lastSeenAt: now,
            lastSeenActivityId: activityId,
          },
        })
      )
    )
  }

  const uniqueTagIds = Array.from(
    new Set(
      normalizedTags
        .map(({ slug }) => tagIdBySlug.get(slug))
        .filter((id): id is string => Boolean(id))
    )
  )

  if (uniqueTagIds.length === 0) {
    if (existingTagIds.size > 0) {
      const tagIds = Array.from(existingTagIds)
      await tx.activityTag.deleteMany({ where: { activityId } })
      await tx.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { activitiesCount: { decrement: 1 } },
      })
    }
    return { tagIds: [] }
  }

  const newTagIdSet = new Set(uniqueTagIds)
  const tagsToRemove = Array.from(existingTagIds).filter((id) => !newTagIdSet.has(id))
  const tagsToAdd = uniqueTagIds.filter((id) => !existingTagIds.has(id))

  if (tagsToRemove.length > 0) {
    await tx.activityTag.deleteMany({
      where: { activityId, tagId: { in: tagsToRemove } },
    })

    await tx.tag.updateMany({
      where: { id: { in: tagsToRemove } },
      data: { activitiesCount: { decrement: 1 } },
    })
  }

  if (tagsToAdd.length > 0) {
    await tx.activityTag.createMany({
      data: tagsToAdd.map((tagId) => ({ activityId, tagId })),
      skipDuplicates: true,
    })

    await tx.tag.updateMany({
      where: { id: { in: tagsToAdd } },
      data: { activitiesCount: { increment: 1 } },
    })
  }

  return { tagIds: uniqueTagIds }
}

/**
 * 批量调节指定活动下所有标签的 activitiesCount
 */
export async function adjustTagActivitiesCountForActivities(
  tx: Prisma.TransactionClient,
  activityIds: string[],
  direction: "increment" | "decrement"
) {
  if (!activityIds.length) return

  const tagCounts = await tx.activityTag.groupBy({
    by: ["tagId"],
    where: { activityId: { in: activityIds } },
    _count: { _all: true },
  })

  if (tagCounts.length === 0) return

  const modifier: "increment" | "decrement" = direction === "increment" ? "increment" : "decrement"

  await Promise.all(
    tagCounts.map((entry) =>
      tx.tag.update({
        where: { id: entry.tagId },
        data: {
          activitiesCount: { [modifier]: entry._count._all },
        },
      })
    )
  )
}
