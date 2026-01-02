import "server-only"

import { unstable_cache } from "next/cache"
import { z } from "zod"

import type { ApiResponse as UnifiedApiResponse, PaginationMeta } from "@/lib/api/unified-response"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
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

function createInternalError(operation: string, error?: unknown): ApiResponse {
  const message = `${operation}失败`
  logger.error(message, error as Error)
  return createErrorResponse("INTERNAL_ERROR", message)
}

export async function getTagsCacheable(
  options: Partial<GetTagsOptions> = {}
): Promise<ApiResponse<{ tags: TagData[]; pagination: TagListPagination }>> {
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
}

export async function getTagCacheable(slugOrId: string): Promise<ApiResponse<{ tag: TagData }>> {
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
}

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

export async function getPopularTagsCacheable(
  limit: number = 10
): Promise<ApiResponse<{ tags: TagData[] }>> {
  try {
    const validatedLimit = Math.min(Math.max(1, limit), 50)

    const cachedFetch = unstable_cache(
      async () => fetchPopularTagsFromDatabase(validatedLimit),
      ["tags", "popular", String(validatedLimit)],
      {
        tags: ["tags:list"],
        revalidate: 300,
      }
    )

    const tags = await cachedFetch()
    return createSuccessResponse({ tags })
  } catch (error) {
    return createInternalError("获取热门标签", error)
  }
}

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

export async function searchTagsCacheable(
  query: string,
  limit: number = 10
): Promise<ApiResponse<{ tags: TagData[] }>> {
  try {
    const validatedLimit = Math.min(Math.max(1, limit), 50)

    const sanitizedQuery = normalizeTagSearchQuery(query)
    if (!sanitizedQuery) {
      return createSuccessResponse({ tags: [] })
    }

    const cachedSearch = unstable_cache(
      async () => searchTagsFromDatabase(sanitizedQuery, validatedLimit),
      ["tags", "search", sanitizedQuery, String(validatedLimit)],
      {
        tags: ["tags:list"],
        revalidate: 60,
      }
    )

    const tags = await cachedSearch()
    return createSuccessResponse({ tags })
  } catch (error) {
    return createInternalError("搜索标签", error)
  }
}
