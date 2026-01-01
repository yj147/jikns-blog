"use server"

import { logger } from "@/lib/utils/logger"
import { createErrorResponse } from "./response-helpers"
import type { ApiResponse, GetTagsOptions, TagData, TagListPagination } from "./queries-core"
import {
  getTagsCacheable,
  getTagCacheable,
  getPopularTagsCacheable,
  searchTagsCacheable,
} from "./queries-core"

export type { ApiResponse, TagData, TagListPagination, GetTagsOptions } from "./queries-core"

export interface GetTagsContext {
  /**
   * 当调用方（例如 API Route）已在外层完成限流时，可跳过 Server Action 内部的速率限制。
   */
  skipRateLimit?: boolean
}

async function resolveViewerId(): Promise<string | null> {
  try {
    const { getOptionalViewer } = await import("@/lib/auth/session")
    const viewer = await getOptionalViewer()
    return viewer?.id ?? null
  } catch (error) {
    logger.debug("获取可选用户信息失败，按匿名处理", { error })
    return null
  }
}

const cloneRequestHeaders = async () => {
  const { headers } = await import("next/headers")
  const incoming = await headers()
  const normalized = new Headers()
  for (const [key, value] of incoming.entries()) {
    normalized.append(key, value)
  }
  return normalized
}

function createInternalError(
  operation: string,
  error?: unknown,
  level: "warn" | "error" = "error"
): ApiResponse {
  const message = `${operation}失败`
  if (level === "warn") {
    logger.warn(message, error as Error)
  } else {
    logger.error(message, error as Error)
  }
  return createErrorResponse("INTERNAL_ERROR", message)
}

export async function withTagSearchRateLimit<T>(
  operation: string,
  fn: () => Promise<ApiResponse<T>>,
  context?: GetTagsContext
): Promise<ApiResponse<T>> {
  if (context?.skipRateLimit) {
    return fn()
  }

  const normalizedHeaders = await cloneRequestHeaders()
  const viewerId = await resolveViewerId()
  const { enforceTagRateLimitForHeaders } = await import("@/lib/rate-limit/tag-limits")

  try {
    await enforceTagRateLimitForHeaders("search", normalizedHeaders, viewerId)
  } catch (error) {
    const statusCode = (error as any)?.statusCode as number | undefined
    if (statusCode === 429) {
      return createErrorResponse("RATE_LIMIT_EXCEEDED", (error as Error).message, {
        retryAfter: (error as any)?.retryAfter,
        statusCode,
      }) as ApiResponse<T>
    }
    return createInternalError(operation, error, "warn") as ApiResponse<T>
  }

  return fn()
}

export async function getTags(
  options: Partial<GetTagsOptions> = {},
  context?: GetTagsContext
): Promise<ApiResponse<{ tags: TagData[]; pagination: TagListPagination }>> {
  "use server"
  return withTagSearchRateLimit("获取标签列表", () => getTagsCacheable(options), context)
}

export async function getTag(
  slugOrId: string,
  context?: GetTagsContext
): Promise<ApiResponse<{ tag: TagData }>> {
  "use server"
  return withTagSearchRateLimit("获取标签详情", () => getTagCacheable(slugOrId), context)
}

export async function getPopularTags(
  limit: number = 10,
  context?: GetTagsContext
): Promise<ApiResponse<{ tags: TagData[] }>> {
  "use server"
  return withTagSearchRateLimit("获取热门标签", () => getPopularTagsCacheable(limit), context)
}

export async function searchTags(
  query: string,
  limit: number = 10,
  context?: GetTagsContext
): Promise<ApiResponse<{ tags: TagData[] }>> {
  "use server"
  return withTagSearchRateLimit("搜索标签", () => searchTagsCacheable(query, limit), context)
}
