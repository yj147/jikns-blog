"use server"

import "server-only"
import { headers } from "next/headers"
import { unstable_cache } from "next/cache"
import { z } from "zod"
import { searchTags, searchPostSuggestions, searchUsers } from "@/lib/repos/search"
import type { ApiResponse } from "@/types/api"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { getCurrentUser } from "@/lib/auth"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { getClientIPOrNullFromHeaders } from "@/lib/utils/client-ip"
import { createPerformanceTimer, createSearchApiError } from "./utils"

const SEARCH_SUGGESTION_MIN_QUERY_LENGTH = 2

const SearchSuggestionsParamsSchema = z.object({
  query: z.string().min(1).max(50),
  limit: z.number().int().min(1).max(10).default(5),
})

export type SearchSuggestionsParams = z.infer<typeof SearchSuggestionsParamsSchema>

export interface SearchSuggestion {
  type: "tag" | "post" | "user"
  id: string
  text: string
  href: string
  subtitle?: string
  metadata?: Record<string, any>
}

const fetchSearchSuggestionsData = unstable_cache(
  async (cacheKey: string, limit: number) => {
    if (!cacheKey) {
      return []
    }
    const query = cacheKey
    const [tagsResult, postsResult, usersResult] = await Promise.all([
      searchTags({ query, limit: 2 }),
      searchPostSuggestions({ query, limit: 2, onlyPublished: true }),
      searchUsers({ query, limit: 1 }),
    ])

    const suggestions: SearchSuggestion[] = []

    tagsResult.items.forEach((tag) => {
      suggestions.push({
        type: "tag",
        id: tag.id,
        text: tag.name,
        href: `/blog?tag=${tag.slug}`,
        subtitle: `${tag.postsCount} 篇文章`,
        metadata: {
          slug: tag.slug,
          color: tag.color,
        },
      })
    })

    postsResult.items.forEach((post) => {
      suggestions.push({
        type: "post",
        id: post.id,
        text: post.title,
        href: `/blog/${post.slug}`,
        subtitle: post.author.name || "匿名作者",
        metadata: {
          slug: post.slug,
          excerpt: post.excerpt,
        },
      })
    })

    usersResult.items.forEach((user) => {
      suggestions.push({
        type: "user",
        id: user.id,
        text: user.name || "匿名用户",
        href: `/profile/${user.id}`,
        subtitle: user.bio || undefined,
        metadata: {
          avatarUrl: user.avatarUrl,
        },
      })
    })

    return suggestions.slice(0, limit)
  },
  ["search-suggestions-v2"],
  {
    revalidate: 60,
    tags: ["search-suggestions"],
  }
)

export async function getSearchSuggestions(
  params: Partial<SearchSuggestionsParams>
): Promise<ApiResponse<{ suggestions: SearchSuggestion[] }>> {
  let stopSuggestionTimer: ReturnType<typeof createPerformanceTimer> | null = null

  try {
    const validated = SearchSuggestionsParamsSchema.parse(params)
    const { query, limit } = validated
    const normalizedQuery = query.trim()

    const headerList = await headers()
    const clientIp = getClientIPOrNullFromHeaders(headerList)
    const user = await getCurrentUser()

    stopSuggestionTimer = createPerformanceTimer(MetricType.SEARCH_SUGGESTION_DURATION, {
      userId: user?.id,
      additionalData: {
        feature: "search",
        action: "search_suggestions",
        queryLength: normalizedQuery.length,
        limit,
      },
    })

    if (normalizedQuery.length < SEARCH_SUGGESTION_MIN_QUERY_LENGTH) {
      stopSuggestionTimer?.({
        result: {
          status: "skipped",
          reason: "query_too_short",
        },
      })
      stopSuggestionTimer = null

      return {
        success: true,
        data: { suggestions: [] },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      }
    }

    const rateLimitResult = await checkSearchRateLimit({
      userId: user?.id,
      ip: clientIp,
    })

    if (!rateLimitResult.allowed) {
      stopSuggestionTimer?.({
        result: {
          status: "rate_limited",
          retryAfter: rateLimitResult.retryAfter,
        },
      })
      stopSuggestionTimer = null

      return {
        success: false,
        error: createSearchApiError("RATE_LIMIT_EXCEEDED", "搜索请求过于频繁，请稍后再试", {
          retryAfter: rateLimitResult.retryAfter,
        }),
      }
    }

    const limitedSuggestions = await fetchSearchSuggestionsData(
      normalizedQuery.toLowerCase(),
      limit
    )

    stopSuggestionTimer?.({
      result: {
        status: "success",
        suggestionsCount: limitedSuggestions.length,
      },
    })
    stopSuggestionTimer = null

    return {
      success: true,
      data: { suggestions: limitedSuggestions },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    performanceMonitor.recordError({
      type: "search_suggestions_error",
      endpoint: "/api/search/suggestions",
    })

    stopSuggestionTimer?.({
      result: {
        status: "error",
        message: error instanceof Error ? error.message : "unknown_error",
      },
    })
    stopSuggestionTimer = null

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: createSearchApiError("VALIDATION_ERROR", "参数验证失败", {
          errors: error.errors,
        }),
      }
    }

    return {
      success: false,
      error: createSearchApiError("INTERNAL_SERVER_ERROR", "获取搜索建议失败"),
    }
  }
}
