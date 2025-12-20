/**
 * 标签搜索模块
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import "server-only"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { normalizeLimit, normalizeOffset, buildILikePattern } from "./shared/utils"
import { withFallback } from "./shared/fallback"
import type {
  SearchTagsParams,
  ResolvedSearchTagsParams,
  SearchTagResult,
  SearchQueryResult,
} from "./shared/types"
import {
  buildRankExpressions,
  buildTsQuery,
  type SearchExecutionMode,
} from "@/lib/search/rank-utils"

const TAG_TIMESTAMP_COLUMN = Prisma.sql`"createdAt"`
const TAG_FALLBACK_ORDER = Prisma.sql`${TAG_TIMESTAMP_COLUMN} DESC NULLS LAST, "id" DESC`

function buildTagSearchClause(query: string, mode: SearchExecutionMode) {
  if (mode === "ts") {
    const tsQuery = buildTsQuery(query)
    const likePattern = buildILikePattern(query)
    return {
      clause: Prisma.sql`(search_vector @@ ${tsQuery} OR slug ILIKE ${likePattern} ESCAPE '\\')`,
      tsQuery,
    }
  }

  const likePattern = buildILikePattern(query)
  return {
    clause: Prisma.sql`(
      name ILIKE ${likePattern} ESCAPE '\\' OR
      slug ILIKE ${likePattern} ESCAPE '\\' OR
      COALESCE(description, '') ILIKE ${likePattern} ESCAPE '\\'
    )`,
    tsQuery: undefined,
  }
}

// ============================================================================
// 参数解析
// ============================================================================

function resolveSearchTagsParams(params: SearchTagsParams): ResolvedSearchTagsParams {
  const limit = normalizeLimit(params.limit, 10)
  const offset = normalizeOffset(params.offset)
  const sort = params.sort ?? "relevance"

  return {
    query: params.query,
    limit,
    offset,
    sort,
  }
}

// ============================================================================
// 标签搜索（全文 + 降级）
// ============================================================================

async function executeSearchTags(
  params: ResolvedSearchTagsParams,
  mode: SearchExecutionMode
): Promise<SearchQueryResult<SearchTagResult>> {
  const { query, limit, offset, sort } = params
  const { clause, tsQuery } = buildTagSearchClause(query, mode)
  const { rankSelect, orderByClause } = buildRankExpressions({
    vectorColumn: Prisma.sql`search_vector`,
    timestampColumn: TAG_TIMESTAMP_COLUMN,
    tsQuery,
    sort,
    mode,
    fallbackOrderClause: TAG_FALLBACK_ORDER,
  })

  const [rows, totalRows] = await prisma.$transaction([
    prisma.$queryRaw<
      Array<{
        id: string
        name: string
        slug: string
        color: string | null
        description: string | null
        postsCount: number
        rank: number
      }>
    >`
      SELECT
        id,
        name,
        slug,
        color,
        description,
        "postsCount",
        ${rankSelect} as rank
      FROM tags
      WHERE ${clause}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM tags
      WHERE ${clause}
    `,
  ])

  const total = Number(totalRows[0]?.total ?? 0)

  return {
    total,
    items: rows,
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 搜索标签
 * 使用 PostgreSQL 全文搜索，失败时降级到 LIKE 查询
 */
export const searchTags = withFallback(
  (params: SearchTagsParams) => {
    const resolved = resolveSearchTagsParams(params)
    return executeSearchTags(resolved, "ts")
  },
  (params: SearchTagsParams) => {
    const resolved = resolveSearchTagsParams(params)
    return executeSearchTags(resolved, "like")
  },
  "标签"
)
