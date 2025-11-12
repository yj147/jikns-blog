"use server"

import "server-only"
import { headers } from "next/headers"
import { z } from "zod"
import {
  searchPosts,
  searchActivities,
  searchUsers,
  searchTags,
  type SearchPostResult,
  type SearchActivityResult,
  type SearchUserResult,
  type SearchTagResult,
  type SearchQueryResult,
} from "@/lib/repos/search"
import type { ApiResponse } from "@/types/api"
import { MetricType } from "@/lib/performance-monitor"
import { getCurrentUser } from "@/lib/auth"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { getClientIPOrNullFromHeaders } from "@/lib/utils/client-ip"
import {
  SearchParamsSchema,
  type SearchParams,
  type SearchResultBucket,
  type SearchResults,
} from "@/lib/search/search-schemas"
import { SEARCH_BUCKET_LIMITS_FOR_ALL } from "@/lib/search/search-buckets"
import { createPerformanceTimer, createSearchApiError } from "./utils"

async function executeSearchQueries(validated: SearchParams): Promise<{
  posts: SearchResultBucket<SearchPostResult>
  activities: SearchResultBucket<SearchActivityResult>
  users: SearchResultBucket<SearchUserResult>
  tags: SearchResultBucket<SearchTagResult>
}> {
  const {
    query,
    type,
    page,
    limit,
    authorId,
    tagIds,
    publishedFrom,
    publishedTo,
    onlyPublished,
    sort,
  } = validated

  const searchAll = type === "all"
  const searchConfig = {
    posts: searchAll || type === "posts",
    activities: searchAll || type === "activities",
    users: searchAll || type === "users",
    tags: searchAll || type === "tags",
  }

  const computeBucketLimit = (key: keyof typeof SEARCH_BUCKET_LIMITS_FOR_ALL) =>
    searchAll ? Math.max(1, Math.min(limit, SEARCH_BUCKET_LIMITS_FOR_ALL[key])) : limit

  const bucketLimits = {
    posts: computeBucketLimit("posts"),
    activities: computeBucketLimit("activities"),
    users: computeBucketLimit("users"),
    tags: computeBucketLimit("tags"),
  }

  const bucketOffsets = {
    posts: (page - 1) * bucketLimits.posts,
    activities: (page - 1) * bucketLimits.activities,
    users: (page - 1) * bucketLimits.users,
    tags: (page - 1) * bucketLimits.tags,
  }

  const tasks: Array<Promise<[keyof typeof searchConfig, SearchQueryResult<any>]>> = []

  if (searchConfig.posts) {
    tasks.push(
      searchPosts({
        query,
        limit: bucketLimits.posts,
        offset: bucketOffsets.posts,
        authorId,
        tagIds,
        publishedFrom,
        publishedTo,
        onlyPublished,
        sort,
      }).then((result) => ["posts", result] as const)
    )
  }

  if (searchConfig.activities) {
    tasks.push(
      searchActivities({
        query,
        limit: bucketLimits.activities,
        offset: bucketOffsets.activities,
        authorId,
        sort,
      }).then((result) => ["activities", result] as const)
    )
  }

  if (searchConfig.users) {
    tasks.push(
      searchUsers({
        query,
        limit: bucketLimits.users,
        offset: bucketOffsets.users,
      }).then((result) => ["users", result] as const)
    )
  }

  if (searchConfig.tags) {
    tasks.push(
      searchTags({
        query,
        limit: bucketLimits.tags,
        offset: bucketOffsets.tags,
      }).then((result) => ["tags", result] as const)
    )
  }

  const resolved = await Promise.all(tasks)
  const resultMap = new Map<keyof typeof searchConfig, SearchQueryResult<any>>(resolved)

  const buildBucket = <T>(
    key: keyof typeof searchConfig,
    fallback: SearchQueryResult<T>,
    bucketLimit: number,
    bucketOffset: number
  ): SearchResultBucket<T> => {
    const data = resultMap.get(key) ?? fallback
    return {
      items: data.items,
      total: data.total,
      hasMore: data.total > bucketOffset + data.items.length,
      page,
      limit: bucketLimit,
    }
  }

  return {
    posts: buildBucket<SearchPostResult>(
      "posts",
      { items: [], total: 0 },
      bucketLimits.posts,
      bucketOffsets.posts
    ),
    activities: buildBucket<SearchActivityResult>(
      "activities",
      { items: [], total: 0 },
      bucketLimits.activities,
      bucketOffsets.activities
    ),
    users: buildBucket<SearchUserResult>(
      "users",
      { items: [], total: 0 },
      bucketLimits.users,
      bucketOffsets.users
    ),
    tags: buildBucket<SearchTagResult>(
      "tags",
      { items: [], total: 0 },
      bucketLimits.tags,
      bucketOffsets.tags
    ),
  }
}

export async function searchContent(
  params: Partial<SearchParams>
): Promise<ApiResponse<SearchResults>> {
  let stopSearchTimer: ReturnType<typeof createPerformanceTimer> | null = null

  try {
    const validated = SearchParamsSchema.parse(params)

    const headerList = await headers()
    const clientIp = getClientIPOrNullFromHeaders(headerList)
    const currentUser = await getCurrentUser()

    stopSearchTimer = createPerformanceTimer(MetricType.SEARCH_CONTENT_DURATION, {
      userId: currentUser?.id,
      additionalData: {
        feature: "search",
        action: "search_content",
        requestType: validated.type,
        queryLength: validated.query.length,
      },
    })

    const rateLimitResult = await checkSearchRateLimit({
      userId: currentUser?.id,
      ip: clientIp,
    })

    if (!rateLimitResult.allowed) {
      stopSearchTimer?.({
        result: {
          status: "rate_limited",
          retryAfter: rateLimitResult.retryAfter,
        },
      })
      stopSearchTimer = null

      return {
        success: false,
        error: createSearchApiError("RATE_LIMIT_EXCEEDED", "搜索请求过于频繁，请稍后再试", {
          retryAfter: rateLimitResult.retryAfter,
        }),
      }
    }

    const effectiveParams: SearchParams = {
      ...validated,
      onlyPublished: currentUser?.role === "ADMIN" ? validated.onlyPublished : true,
    }

    const { posts, activities, users, tags } = await executeSearchQueries(effectiveParams)

    const relevantTotals: number[] = []
    if (effectiveParams.type === "all" || effectiveParams.type === "posts") {
      relevantTotals.push(posts.total)
    }
    if (effectiveParams.type === "all" || effectiveParams.type === "activities") {
      relevantTotals.push(activities.total)
    }
    if (effectiveParams.type === "all" || effectiveParams.type === "users") {
      relevantTotals.push(users.total)
    }
    if (effectiveParams.type === "all" || effectiveParams.type === "tags") {
      relevantTotals.push(tags.total)
    }

    const overallTotal = relevantTotals.reduce((acc, value) => acc + value, 0)

    const searchResults: SearchResults = {
      posts,
      activities,
      users,
      tags,
      overallTotal,
      query: effectiveParams.query,
      type: effectiveParams.type,
    }

    stopSearchTimer?.({
      result: {
        status: "success",
        totals: {
          posts: posts.total,
          activities: activities.total,
          users: users.total,
          tags: tags.total,
          overall: overallTotal,
        },
        onlyPublished: effectiveParams.onlyPublished,
      },
    })
    stopSearchTimer = null

    return {
      success: true,
      data: searchResults,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        cached: false,
      },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: createSearchApiError("VALIDATION_ERROR", "参数验证失败", {
          errors: error.errors,
        }),
      }
    }

    stopSearchTimer?.({
      result: {
        status: "error",
        message: error instanceof Error ? error.message : "unknown_error",
      },
    })
    stopSearchTimer = null

    return {
      success: false,
      error: createSearchApiError("INTERNAL_SERVER_ERROR", "搜索失败，请稍后重试"),
    }
  }
}
