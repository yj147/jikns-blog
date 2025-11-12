"use server"

import "server-only"
import { headers } from "next/headers"
import { z } from "zod"
import { searchUsers } from "@/lib/repos/search"
import type { ApiResponse } from "@/types/api"
import { MetricType } from "@/lib/performance-monitor"
import { getCurrentUser } from "@/lib/auth"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { getClientIPOrNullFromHeaders } from "@/lib/utils/client-ip"
import { createPerformanceTimer, createSearchApiError } from "./utils"

const AUTHOR_SUGGESTION_LIMIT = 10
const ANONYMOUS_AUTHOR_NAME = "未命名作者"

const AuthorCandidatesParamsSchema = z.object({
  query: z.string().min(1, "搜索关键词不能为空").max(100, "搜索关键词不能超过100个字符"),
  limit: z.number().int().min(1).max(AUTHOR_SUGGESTION_LIMIT).default(5),
})

export interface AuthorCandidate {
  id: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  role: string
  similarity: number
}

export async function searchAuthorCandidates(
  params: Partial<z.infer<typeof AuthorCandidatesParamsSchema>>
): Promise<ApiResponse<{ authors: AuthorCandidate[] }>> {
  let stopAuthorTimer: ReturnType<typeof createPerformanceTimer> | null = null

  try {
    const normalizedQuery = params.query?.trim() ?? ""
    if (normalizedQuery.length === 0) {
      return {
        success: true,
        data: { authors: [] },
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
        },
      }
    }

    const validated = AuthorCandidatesParamsSchema.parse({
      query: normalizedQuery,
      limit: params.limit ?? 5,
    })

    const headerList = await headers()
    const clientIp = getClientIPOrNullFromHeaders(headerList)
    const currentUser = await getCurrentUser()

    stopAuthorTimer = createPerformanceTimer(MetricType.SEARCH_AUTHOR_CANDIDATE_DURATION, {
      userId: currentUser?.id,
      additionalData: {
        feature: "search",
        action: "author_candidates",
        queryLength: validated.query.length,
        limit: validated.limit,
      },
    })

    const rateLimitResult = await checkSearchRateLimit({
      userId: currentUser?.id,
      ip: clientIp,
    })

    if (!rateLimitResult.allowed) {
      stopAuthorTimer?.({
        result: {
          status: "rate_limited",
          retryAfter: rateLimitResult.retryAfter,
        },
      })
      stopAuthorTimer = null

      return {
        success: false,
        error: createSearchApiError("RATE_LIMIT_EXCEEDED", "搜索请求过于频繁，请稍后再试", {
          retryAfter: rateLimitResult.retryAfter,
        }),
      }
    }

    const result = await searchUsers({
      query: validated.query,
      limit: validated.limit,
      offset: 0,
    })

    const authors: AuthorCandidate[] = result.items.map((user) => ({
      id: user.id,
      name: user.name ?? ANONYMOUS_AUTHOR_NAME,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      similarity: user.similarity ?? 0,
    }))

    stopAuthorTimer?.({
      result: {
        status: "success",
        authorsCount: authors.length,
      },
    })
    stopAuthorTimer = null

    return {
      success: true,
      data: { authors },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
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

    stopAuthorTimer?.({
      result: {
        status: "error",
        message: error instanceof Error ? error.message : "unknown_error",
      },
    })
    stopAuthorTimer = null

    return {
      success: false,
      error: createSearchApiError("INTERNAL_SERVER_ERROR", "搜索作者失败，请稍后重试"),
    }
  }
}
