import { Prisma, Tag } from "@/lib/generated/prisma"
import { normalizeTagSlug } from "@/lib/utils/tag"
import { sanitizeTagName } from "@/lib/validation/tag"

type Transaction = Prisma.TransactionClient

export interface NormalizedTagInput {
  name: string
  slug: string
}

/**
 * 将标签名称转换为 URL 友好的 slug
 * 支持中文、英文、数字，自动转换为小写并用连字符分隔
 */
export function normalizeTagNames(
  rawTagNames: string[] | undefined,
  maxTags: number = 10
): NormalizedTagInput[] {
  if (!rawTagNames || rawTagNames.length === 0) return []

  const normalized: NormalizedTagInput[] = []
  const seen = new Set<string>()

  for (const raw of rawTagNames) {
    const sanitizedName = sanitizeTagName(raw)
    if (!sanitizedName) continue

    const slug = normalizeTagSlug(sanitizedName)
    if (!slug || seen.has(slug)) continue

    seen.add(slug)
    normalized.push({ name: sanitizedName, slug })

    if (normalized.length >= maxTags) break
  }

  return normalized
}

async function fetchCurrentPostTags(
  tx: Transaction,
  postId: string
): Promise<
  Array<{
    postId: string
    tagId: string
    tag: Pick<Tag, "id" | "name" | "slug" | "color">
  }>
> {
  return tx.postTag.findMany({
    where: { postId },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
      },
    },
  })
}

export async function recalculateTagCounts(tx: Transaction, tagIds: string[]): Promise<void> {
  if (!tagIds || tagIds.length === 0) return

  const uniqueTagIds = Array.from(
    new Set(tagIds.filter((id): id is string => Boolean(id && id.trim())))
  )
  if (uniqueTagIds.length === 0) return

  const [publishedCounts, activityCounts] = await Promise.all([
    tx.postTag.groupBy({
      by: ["tagId"],
      where: {
        tagId: { in: uniqueTagIds },
        post: { published: true },
      },
      _count: {
        _all: true,
      },
    }),
    tx.activityTag.groupBy({
      by: ["tagId"],
      where: {
        tagId: { in: uniqueTagIds },
        activity: { deletedAt: null },
      },
      _count: {
        _all: true,
      },
    }),
  ])

  const postsCountMap = new Map(publishedCounts.map((entry) => [entry.tagId, entry._count._all]))
  const activitiesCountMap = new Map(
    activityCounts.map((entry) => [entry.tagId, entry._count._all])
  )

  await Promise.all(
    uniqueTagIds.map((tagId) =>
      tx.tag.update({
        where: { id: tagId },
        data: {
          postsCount: postsCountMap.get(tagId) ?? 0,
          activitiesCount: activitiesCountMap.get(tagId) ?? 0,
        },
      })
    )
  )
}

interface SyncPostTagsParams {
  tx: Transaction
  postId: string
  newTagNames: string[]
  existingPostTags?: Array<{
    postId: string
    tagId: string
    tag: Pick<Tag, "id" | "name" | "slug" | "color">
  }>
  maxTags?: number
}

export async function syncPostTags({
  tx,
  postId,
  newTagNames,
  existingPostTags,
  maxTags = 10,
}: SyncPostTagsParams): Promise<{ tagIds: string[] }> {
  const normalizedTags = normalizeTagNames(newTagNames, maxTags)
  const desiredSlugs = new Set(normalizedTags.map((tag) => tag.slug))

  const currentPostTags = existingPostTags ?? (await fetchCurrentPostTags(tx, postId))

  const linkedTagIds = new Set(currentPostTags.map((pt) => pt.tagId))
  const currentTagsBySlug = new Map(currentPostTags.map((pt) => [pt.tag.slug, pt.tag]))

  const tagsToRemove = currentPostTags.filter((pt) => !desiredSlugs.has(pt.tag.slug))
  const tagIdsToRemove = tagsToRemove.map((pt) => pt.tagId)

  if (tagIdsToRemove.length > 0) {
    await tx.postTag.deleteMany({
      where: {
        postId,
        tagId: { in: tagIdsToRemove },
      },
    })

    tagIdsToRemove.forEach((id) => linkedTagIds.delete(id))
  }

  if (normalizedTags.length === 0) {
    if (tagIdsToRemove.length > 0) {
      await recalculateTagCounts(tx, tagIdsToRemove)
    }
    return { tagIds: [] }
  }

  const slugs = normalizedTags.map((tag) => tag.slug)
  const names = normalizedTags.map((tag) => tag.name)

  const existingTags = await tx.tag.findMany({
    where: {
      OR: [{ slug: { in: slugs } }, { name: { in: names } }],
    },
  })

  const tagsBySlug = new Map<
    string,
    { id: string; name: string; slug: string; color: string | null }
  >(existingTags.map((tag) => [tag.slug, tag]))
  const associationsToCreate: Array<{ postId: string; tagId: string }> = []
  const affectedTagIds = new Set<string>(tagIdsToRemove)

  normalizedTags.forEach(({ slug }) => {
    const existing = currentTagsBySlug.get(slug)
    if (existing) {
      affectedTagIds.add(existing.id)
    }
  })

  for (const tagInput of normalizedTags) {
    let tagRecord =
      currentTagsBySlug.get(tagInput.slug) ||
      tagsBySlug.get(tagInput.slug) ||
      existingTags.find((tag) => tag.name === tagInput.name)

    if (!tagRecord) {
      tagRecord = await tx.tag.create({
        data: {
          name: tagInput.name,
          slug: tagInput.slug,
          postsCount: 0,
        },
      })

      tagsBySlug.set(tagRecord.slug, tagRecord)
    }

    if (!linkedTagIds.has(tagRecord.id)) {
      associationsToCreate.push({ postId, tagId: tagRecord.id })
      linkedTagIds.add(tagRecord.id)
    }

    affectedTagIds.add(tagRecord.id)
  }

  if (associationsToCreate.length > 0) {
    await tx.postTag.createMany({
      data: associationsToCreate,
      skipDuplicates: true,
    })
  }

  if (affectedTagIds.size > 0) {
    await recalculateTagCounts(tx, Array.from(affectedTagIds))
  }

  const finalTagIds = normalizedTags
    .map((tag) => {
      const match =
        currentTagsBySlug.get(tag.slug) ||
        tagsBySlug.get(tag.slug) ||
        existingTags.find((existing) => existing.slug === tag.slug || existing.name === tag.name)
      return match?.id
    })
    .filter((id): id is string => Boolean(id))

  return { tagIds: finalTagIds }
}
