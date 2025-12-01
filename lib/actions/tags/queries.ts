"use server"

import { headers } from "next/headers"
import { unstable_cache } from "next/cache"
import { z } from "zod"

import type { ApiResponse as UnifiedApiResponse, PaginationMeta } from "@/lib/api/unified-response"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
import { enforceTagRateLimitForHeaders } from "@/lib/rate-limit/tag-limits"
import { getOptionalViewer } from "@/lib/auth/session"
import { createSuccessResponse, createErrorResponse } from "./response-helpers"

export type ApiResponse<T = any> = UnifiedApiResponse<T>

export type TagListPagination = Omit<PaginationMeta, "page" | "total"> & {
  page: number
  total: number
  totalPages: number
}

export interface TagData {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  postsCount: number
  activitiesCount: number
  createdAt: Date
  updatedAt?: Date
}

const GetTagsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  orderBy: z.enum(["postsCount", "name", "createdAt"]).default("postsCount"),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z
    .string()
    .optional()
    .transform((value) => normalizeTagSearchQuery(value)),
})

export type GetTagsOptions = z.infer<typeof GetTagsSchema>

type NormalizedGetTagsOptions = z.infer<typeof GetTagsSchema>

export interface GetTagsContext {
  /**
   * 当调用方（例如 API Route）已在外层完成限流时，可跳过 Server Action 内部的速率限制。
   */
  skipRateLimit?: boolean
}

const INVALID_TAG_SEARCH_CHARS = /[^a-zA-Z0-9\u4e00-\u9fa5\s\-_.]/g

function normalizeTagSearchQuery(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const stripped = trimmed.replace(INVALID_TAG_SEARCH_CHARS, "")
  const collapsed = stripped.replace(/\s+/g, " ")
  const normalized = collapsed.trim()
  return normalized || undefined
}

async function resolveViewerId(): Promise<string | null> {
  try {
    const viewer = await getOptionalViewer()
    return viewer?.id ?? null
  } catch (error) {
    logger.debug("获取可选用户信息失败，按匿名处理", { error })
    return null
  }
}

const cloneRequestHeaders = async () => {
  const incoming = await headers()
  const normalized = new Headers()
  for (const [key, value] of incoming.entries()) {
    normalized.append(key, value)
  }
  return normalized
}

const fetchTagsFromDatabase = async (options: NormalizedGetTagsOptions) => {
  const { page, limit, orderBy, order, search } = options

  const where = search
    ? {
        name: {
          contains: search,
          mode: "insensitive" as const,
        },
      }
    : {}

  const [total, tags] = await Promise.all([
    prisma.tag.count({ where }),
    prisma.tag.findMany({
      where,
      orderBy: { [orderBy]: order },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        postsCount: true,
        activitiesCount: true,
        createdAt: true,
      },
    }),
  ])

  const totalPages = total === 0 ? 1 : Math.ceil(total / limit)

  const hasMore = total > 0 && page < totalPages

  const paginationMeta: PaginationMeta = {
    page,
    limit,
    total,
    hasMore,
  }

  const paginationPayload: TagListPagination = {
    page,
    limit,
    total,
    hasMore,
    totalPages,
  }

  return {
    tags,
    paginationMeta,
    paginationPayload,
  }
}

const cachedFetchTags = unstable_cache(fetchTagsFromDatabase, ["tags", "list"], {
  tags: ["tags:list"],
  revalidate: 120,
})

const fetchTagDetail = unstable_cache(
  async (identifier: string) => {
    return prisma.tag.findFirst({
      where: {
        OR: [{ slug: identifier }, { id: identifier }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        postsCount: true,
        activitiesCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  },
  ["tags", "detail"],
  { tags: ["tags:detail"], revalidate: 120 }
)

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

  try {
    await enforceTagRateLimitForHeaders("search", normalizedHeaders, viewerId)
  } catch (error) {
    const statusCode = (error as any)?.statusCode as number | undefined
    if (statusCode === 429) {
      return createErrorResponse("RATE_LIMIT_EXCEEDED", (error as Error).message, {
        retryAfter: (error as any)?.retryAfter,
        statusCode,
      })
    }
    return createInternalError(operation, error, "warn")
  }

  return fn()
}

/**
 * 获取标签列表，提供分页、排序、搜索能力，并在内部统一限流与参数校验。
 * @param options - 页码、排序字段、排序方向与可选的搜索关键字
 * @param context - 可选上下文，允许外层已限流时跳过重复检查
 * @returns 包含标签数组与分页信息的统一响应
 */
export async function getTags(
  options: Partial<GetTagsOptions> = {},
  context?: GetTagsContext
): Promise<ApiResponse<{ tags: TagData[]; pagination: TagListPagination }>> {
  "use server"
  return withTagSearchRateLimit(
    "获取标签列表",
    async () => {
      try {
        const validatedOptions = GetTagsSchema.parse(options)
        const { tags, paginationMeta, paginationPayload } = await cachedFetchTags(validatedOptions)

        return createSuccessResponse({ tags, pagination: paginationPayload }, paginationMeta)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return createErrorResponse("VALIDATION_ERROR", "参数验证失败", error.errors)
        }

        return createInternalError("获取标签列表", error)
      }
    },
    context
  )
}

/**
 * 根据 slug 或 ID 获取单个标签详情，包含速率限制与 404 处理。
 * @param slugOrId - 标签 slug 或数据库 ID
 * @returns 标签详情响应
 */
export async function getTag(slugOrId: string): Promise<ApiResponse<{ tag: TagData }>> {
  "use server"
  return withTagSearchRateLimit("获取标签详情", async () => {
    try {
      if (!slugOrId) {
        return createErrorResponse("VALIDATION_ERROR", "标签标识不能为空")
      }

      const tag = await fetchTagDetail(slugOrId)

      if (!tag) {
        return createErrorResponse("NOT_FOUND", "标签不存在")
      }

      return createSuccessResponse({ tag })
    } catch (error) {
      return createInternalError("获取标签详情", error)
    }
  })
}

/**
 * 从数据库获取热门标签（内部函数）
 */
async function fetchPopularTagsFromDatabase(limit: number): Promise<TagData[]> {
  return prisma.tag.findMany({
    where: {
      postsCount: {
        gt: 0,
      },
    },
    orderBy: {
      postsCount: "desc",
    },
    take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        postsCount: true,
        activitiesCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })
}

/**
 * 获取热门标签列表，默认返回 10 条并通过缓存减少数据库压力。
 * @param limit - 期望返回的标签数量，范围 1~50
 * @returns 热门标签数组响应
 */
export async function getPopularTags(
  limit: number = 10
): Promise<ApiResponse<{ tags: TagData[] }>> {
  "use server"
  return withTagSearchRateLimit("获取热门标签", async () => {
    try {
      const validatedLimit = Math.min(Math.max(1, limit), 50)

      // 使用 unstable_cache 缓存热门标签查询
      const cachedFetch = unstable_cache(
        async () => fetchPopularTagsFromDatabase(validatedLimit),
        ["tags", "popular", String(validatedLimit)],
        {
          tags: ["tags:list"],
          revalidate: 300, // 5分钟缓存
        }
      )

      const tags = await cachedFetch()
      return createSuccessResponse({ tags })
    } catch (error) {
      return createInternalError("获取热门标签", error)
    }
  })
}

/**
 * 从数据库搜索标签（内部函数）
 */
async function searchTagsFromDatabase(sanitizedQuery: string, limit: number): Promise<TagData[]> {
  return prisma.tag.findMany({
    where: {
      name: {
        contains: sanitizedQuery,
        mode: "insensitive",
      },
    },
    orderBy: {
      postsCount: "desc",
    },
    take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        postsCount: true,
        activitiesCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })
}

/**
 * 根据关键字模糊搜索标签，结果按 postsCount 降序排列并受速率限制保护。
 * @param query - 用户输入的搜索关键字
 * @param limit - 期望返回数量，范围 1~50
 * @returns 匹配的标签数组响应
 */
export async function searchTags(
  query: string,
  limit: number = 10
): Promise<ApiResponse<{ tags: TagData[] }>> {
  "use server"
  return withTagSearchRateLimit("搜索标签", async () => {
    try {
      const validatedLimit = Math.min(Math.max(1, limit), 50)

      const sanitizedQuery = normalizeTagSearchQuery(query)
      if (!sanitizedQuery) {
        return createSuccessResponse({ tags: [] })
      }

      // 使用 unstable_cache 缓存搜索结果
      const cachedSearch = unstable_cache(
        async () => searchTagsFromDatabase(sanitizedQuery, validatedLimit),
        ["tags", "search", sanitizedQuery, String(validatedLimit)],
        {
          tags: ["tags:list"],
          revalidate: 60, // 1分钟缓存
        }
      )

      const tags = await cachedSearch()
      return createSuccessResponse({ tags })
    } catch (error) {
      return createInternalError("搜索标签", error)
    }
  })
}
