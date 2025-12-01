/**
 * 标签搜索模块
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import "server-only"
import { prisma } from "@/lib/prisma"
import { normalizeLimit, normalizeOffset } from "./shared/utils"
import type {
  SearchTagsParams,
  ResolvedSearchTagsParams,
  SearchTagResult,
  SearchQueryResult,
} from "./shared/types"

// ============================================================================
// 参数解析
// ============================================================================

function resolveSearchTagsParams(params: SearchTagsParams): ResolvedSearchTagsParams {
  const limit = normalizeLimit(params.limit, 10)
  const offset = normalizeOffset(params.offset)

  return {
    query: params.query,
    limit,
    offset,
  }
}

// ============================================================================
// 标签搜索（简单模糊匹配）
// ============================================================================

async function executeSearchTags(
  params: ResolvedSearchTagsParams
): Promise<SearchQueryResult<SearchTagResult>> {
  const { query, limit, offset } = params

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      skip: offset,
      orderBy: { postsCount: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        description: true,
        postsCount: true,
      },
    }),
    prisma.tag.count({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
    }),
  ])

  const items: SearchTagResult[] = tags.map((tag, index) => ({
    ...tag,
    rank: offset + index + 1,
  }))

  return {
    total,
    items,
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 搜索标签
 * 使用简单的模糊匹配
 */
export async function searchTags(
  params: SearchTagsParams
): Promise<SearchQueryResult<SearchTagResult>> {
  const resolved = resolveSearchTagsParams(params)
  return executeSearchTags(resolved)
}
