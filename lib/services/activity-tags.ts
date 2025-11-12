import { Prisma, PrismaClient } from "@/lib/generated/prisma"
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
  tx: Prisma.TransactionClient | PrismaClient
  activityId: string
  rawTagNames: string[]
  maxTags?: number
}

/**
 * 同步 Activity 的标签关联
 *
 * 简化策略（Linus "好品味" 原则）：
 * 1. 先删除所有现有关联
 * 2. 仅连接已存在的标签
 * 3. 将未知 hashtag 写入候选池，等待管理员审核
 *
 * 优点：
 * - 用户无法突破管理员独占的标签治理
 * - 候选池保留了热门 hashtag 线索，方便后台审核
 * - 逻辑仍保持“删除 + 重建”的简单路径
 */
export async function syncActivityTags({
  tx,
  activityId,
  rawTagNames,
  maxTags = DEFAULT_MAX_TAGS,
}: SyncActivityTagsParams): Promise<{ tagIds: string[] }> {
  // 标准化标签名称
  const normalizedTags = normalizeTagNames(rawTagNames, maxTags)

  // 步骤 1：删除所有现有关联（简单直接）
  await tx.activityTag.deleteMany({
    where: { activityId },
  })

  // 如果没有标签，直接返回
  if (normalizedTags.length === 0) {
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
    return { tagIds: [] }
  }

  // 步骤 2：批量创建新的关联，只连接现有标签
  await tx.activityTag.createMany({
    data: uniqueTagIds.map((tagId) => ({ activityId, tagId })),
    skipDuplicates: true,
  })

  return { tagIds: uniqueTagIds }
}
