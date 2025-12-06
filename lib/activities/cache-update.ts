"use client"

/**
 * Activity 缓存更新工具
 * 负责在 SWR 全局缓存中同步 likes/comments 等计数的乐观更新，
 * 避免列表/详情页面在后台数据尚未回填时回退到旧值。
 */

import { mutate as globalMutate } from "swr"
import type { ActivityApiResponse, ActivityWithAuthor } from "@/types/activity"

type ActivityUpdater = (activity: ActivityWithAuthor) => ActivityWithAuthor

const isActivitiesListKey = (key: unknown) =>
  typeof key === "string" && key.startsWith("/api/activities")

type ActivitiesListCache =
  | ActivityApiResponse<ActivityWithAuthor[]>[]
  | ActivityApiResponse<ActivityWithAuthor[]>
  | undefined

function updateListPages(
  pages: ActivityApiResponse<ActivityWithAuthor[]>[] | undefined,
  activityId: string,
  updater: ActivityUpdater
) {
  if (!pages) return pages

  let changed = false
  const nextPages = pages.map((page) => {
    if (!page?.data) return page
    let pageChanged = false
    const nextData = page.data.map((item) => {
      if (item.id !== activityId) return item
      pageChanged = true
      return updater(item)
    })
    if (!pageChanged) return page
    changed = true
    return { ...page, data: nextData }
  })

  return changed ? nextPages : pages
}

function updateActivityDetail(
  response: ActivityApiResponse<ActivityWithAuthor> | undefined,
  activityId: string,
  updater: ActivityUpdater
) {
  if (!response?.data || response.data.id !== activityId) return response
  const nextData = updater(response.data)
  if (nextData === response.data) return response
  return { ...response, data: nextData }
}

function updateActivitiesListCache(
  cache: ActivitiesListCache,
  activityId: string,
  updater: ActivityUpdater
): ActivitiesListCache {
  if (!cache) return cache

  // useSWRInfinite: data 为数组（分页）
  if (Array.isArray(cache)) {
    return updateListPages(cache, activityId, updater)
  }

  // useSWR: 单页列表
  if (cache.data) {
    let changed = false
    const nextData = cache.data.map((item) => {
      if (item.id !== activityId) return item
      changed = true
      return updater(item)
    })

    return changed ? { ...cache, data: nextData } : cache
  }

  return cache
}

/**
 * 在所有 Activity 相关的 SWR 缓存中应用更新函数
 */
export function updateActivityInCaches(activityId: string, updater: ActivityUpdater) {
  // 更新列表页缓存（useSWRInfinite）
  void globalMutate(
    isActivitiesListKey,
    (cache: ActivitiesListCache) => updateActivitiesListCache(cache, activityId, updater),
    false
  )

  // 更新单个详情缓存（useActivity）
  void globalMutate(
    `/api/activities/${activityId}`,
    (response: ActivityApiResponse<ActivityWithAuthor> | undefined) =>
      updateActivityDetail(response, activityId, updater),
    false
  )
}

/**
 * 便捷方法：调整 likes/comments 计数（支持增量）
 */
export function bumpActivityCounts(
  activityId: string,
  delta: { likes?: number; comments?: number; isLiked?: boolean }
) {
  updateActivityInCaches(activityId, (activity) => {
    const nextLikes =
      typeof delta.likes === "number"
        ? Math.max(0, (activity.likesCount ?? 0) + delta.likes)
        : activity.likesCount

    const nextComments =
      typeof delta.comments === "number"
        ? Math.max(0, (activity.commentsCount ?? 0) + delta.comments)
        : activity.commentsCount

    const nextIsLiked =
      typeof delta.isLiked === "boolean" ? delta.isLiked : activity.isLiked ?? activity.isLiked

    return {
      ...activity,
      likesCount: nextLikes,
      commentsCount: nextComments,
      isLiked: nextIsLiked,
    }
  })
}
