/**
 * 动态搜索模块
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import "server-only"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { normalizeLimit, normalizeOffset, buildILikePattern } from "./shared/utils"
import { withFallback } from "./shared/fallback"
import type {
  SearchActivitiesParams,
  ResolvedSearchActivitiesParams,
  SearchActivityResult,
  SearchQueryResult,
} from "./shared/types"
import {
  buildRankExpressions,
  buildTsQuery,
  type SearchExecutionMode,
} from "@/lib/search/rank-utils"
import { SEARCH_RANK_HALF_LIFE_DAYS } from "@/lib/search/search-config"

const ACTIVITY_TIMESTAMP_COLUMN = Prisma.sql`"createdAt"`
const ACTIVITY_FALLBACK_ORDER = Prisma.sql`${ACTIVITY_TIMESTAMP_COLUMN} DESC, "id" DESC`

function buildActivitySearchClause(query: string, mode: SearchExecutionMode) {
  if (mode === "ts") {
    const tsQuery = buildTsQuery(query)
    return {
      clause: Prisma.sql`search_vector @@ ${tsQuery}`,
      tsQuery,
    }
  }

  const likePattern = buildILikePattern(query)
  return {
    clause: Prisma.sql`content ILIKE ${likePattern} ESCAPE '\\'`,
    tsQuery: undefined,
  }
}

// ============================================================================
// 参数解析
// ============================================================================

function resolveSearchActivitiesParams(
  params: SearchActivitiesParams
): ResolvedSearchActivitiesParams {
  const limit = normalizeLimit(params.limit, 20)
  const offset = normalizeOffset(params.offset)
  const authorId = params.authorId ?? ""
  const sort = params.sort ?? "relevance"

  return {
    query: params.query,
    limit,
    offset,
    authorId,
    sort,
  }
}

// ============================================================================
// 搜索执行（根据 mode 决定全文或 LIKE）
// ============================================================================

async function executeSearchActivities(
  params: ResolvedSearchActivitiesParams,
  mode: SearchExecutionMode
): Promise<SearchQueryResult<SearchActivityResult>> {
  const { query, limit, offset, sort } = params
  const { clause, tsQuery } = buildActivitySearchClause(query, mode)
  const filters = buildActivityFilters(params, clause)
  const whereClause = Prisma.join(filters, " AND ")
  const { rankSelect, orderByClause } = buildRankExpressions({
    vectorColumn: Prisma.sql`search_vector`,
    timestampColumn: ACTIVITY_TIMESTAMP_COLUMN,
    tsQuery,
    sort,
    halfLifeDays: SEARCH_RANK_HALF_LIFE_DAYS.activities,
    mode,
    fallbackOrderClause: ACTIVITY_FALLBACK_ORDER,
  })

  const [rows, totalRows] = await prisma.$transaction([
    prisma.$queryRaw<
      Array<{
        id: string
        content: string
        imageUrls: string[] | null
        isPinned: boolean
        likesCount: number
        commentsCount: number
        viewsCount: number
        createdAt: Date
        rank: number
        authorId: string
      }>
    >`
      SELECT
        id,
        content,
        "imageUrls",
        "isPinned",
        "likesCount",
        "commentsCount",
        "viewsCount",
        "createdAt",
        ${rankSelect} as rank,
        "authorId"
      FROM activities
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM activities
      WHERE ${whereClause}
    `,
  ])

  const total = Number(totalRows[0]?.total ?? 0)

  if (rows.length === 0) {
    return {
      items: [],
      total,
    }
  }

  const authorIds = [...new Set(rows.map((r) => r.authorId))]

  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
    },
  })

  const authorMap = new Map(authors.map((a) => [a.id, a]))

  return {
    total,
    items: rows.map((activity) => ({
      id: activity.id,
      content: activity.content,
      imageUrls: activity.imageUrls,
      isPinned: activity.isPinned,
      likesCount: activity.likesCount,
      commentsCount: activity.commentsCount,
      viewsCount: activity.viewsCount,
      createdAt: activity.createdAt,
      rank: activity.rank,
      author: authorMap.get(activity.authorId) || {
        id: activity.authorId,
        name: null,
        avatarUrl: null,
        role: "USER",
      },
    })),
  }
}

function buildActivityFilters(
  params: ResolvedSearchActivitiesParams,
  searchClause: Prisma.Sql
): Prisma.Sql[] {
  const filters: Prisma.Sql[] = [Prisma.sql`"deletedAt" IS NULL`, searchClause]

  if (params.authorId) {
    filters.push(Prisma.sql`"authorId" = ${params.authorId}`)
  }

  return filters
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 搜索动态
 * 使用 PostgreSQL 全文搜索，失败时降级到 LIKE 查询
 */
export const searchActivities = withFallback(
  (params: SearchActivitiesParams) => {
    const resolved = resolveSearchActivitiesParams(params)
    return executeSearchActivities(resolved, "ts")
  },
  (params: SearchActivitiesParams) => {
    const resolved = resolveSearchActivitiesParams(params)
    return executeSearchActivities(resolved, "like")
  },
  "动态"
)
