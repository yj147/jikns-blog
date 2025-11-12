"use server"

import { revalidateTag } from "next/cache"

import { ARCHIVE_CACHE_TAGS } from "@/lib/cache/archive-tags"

type MaybeDate = Date | string | null | undefined

export interface ArchiveCacheChange {
  previousPublished?: boolean
  previousPublishedAt?: MaybeDate
  nextPublished?: boolean
  nextPublishedAt?: MaybeDate
}

/**
 * 针对文章状态变化刷新归档缓存。函数将自动解析受影响的年份与月份，
 * 并批量触发 `revalidateTag`，避免散落在各个 Server Action 内重复实现。
 */
export async function revalidateArchiveCache(
  change: ArchiveCacheChange | ArchiveCacheChange[]
): Promise<void> {
  const changes = Array.isArray(change) ? change : [change]
  const tags = new Set<string>()
  let hasImpact = false

  for (const item of changes) {
    const previousTouched = addTagsForState(item.previousPublished, item.previousPublishedAt, tags)
    const nextTouched = addTagsForState(item.nextPublished, item.nextPublishedAt, tags)

    if (previousTouched || nextTouched) {
      hasImpact = true
    }
  }

  if (!hasImpact) {
    return
  }

  tags.add(ARCHIVE_CACHE_TAGS.list)
  tags.add(ARCHIVE_CACHE_TAGS.years)
  tags.add(ARCHIVE_CACHE_TAGS.stats)

  for (const tag of tags) {
    revalidateTag(tag)
  }
}

function addTagsForState(
  published: boolean | undefined,
  publishedAt: MaybeDate,
  tags: Set<string>
): boolean {
  if (!published) {
    return false
  }

  const date = normalizeDate(publishedAt)
  if (!date) {
    return false
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1

  tags.add(ARCHIVE_CACHE_TAGS.year(year))
  tags.add(ARCHIVE_CACHE_TAGS.month(year, month))

  return true
}

function normalizeDate(value: MaybeDate): Date | undefined {
  if (!value) {
    return undefined
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
