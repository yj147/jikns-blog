/**
 * 用户搜索模块
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import "server-only"
import { prisma } from "@/lib/prisma"
import { normalizeLimit, normalizeOffset } from "./shared/utils"
import { withFallback } from "./shared/fallback"
import type {
  SearchUsersParams,
  ResolvedSearchUsersParams,
  SearchUserResult,
  SearchQueryResult,
} from "./shared/types"

// ============================================================================
// 参数解析
// ============================================================================

function resolveSearchUsersParams(params: SearchUsersParams): ResolvedSearchUsersParams {
  const limit = normalizeLimit(params.limit, 10)
  const offset = normalizeOffset(params.offset)
  const trimmedQuery = params.query.trim()
  const query = trimmedQuery.length > 0 ? trimmedQuery : params.query

  return {
    query,
    limit,
    offset,
  }
}

// ============================================================================
// 主路径：pg_trgm 模糊搜索
// ============================================================================

async function executeSearchUsersMain(
  params: ResolvedSearchUsersParams
): Promise<SearchQueryResult<SearchUserResult>> {
  const { query, limit, offset } = params
  const likeQuery = `%${query}%`

  const [users, totalRows] = await prisma.$transaction([
    prisma.$queryRaw<
      Array<{
        id: string
        name: string | null
        avatarUrl: string | null
        bio: string | null
        similarity: number
      }>
    >`
      SELECT
        id,
        name,
        "avatarUrl",
        bio,
        GREATEST(
          similarity(COALESCE(name, ''), ${query}),
          similarity(COALESCE(bio, ''), ${query})
        ) as similarity
      FROM users
      WHERE status = 'ACTIVE'
        AND (name ILIKE ${likeQuery} OR COALESCE(bio, '') ILIKE ${likeQuery})
      ORDER BY similarity DESC, name ASC NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM users
      WHERE status = 'ACTIVE'
        AND (name ILIKE ${likeQuery} OR COALESCE(bio, '') ILIKE ${likeQuery})
    `,
  ])

  const total = Number(totalRows[0]?.total ?? 0)

  const items: SearchUserResult[] = users.map((user) => ({
    ...user,
    rank: user.similarity,
  }))

  return {
    total,
    items,
  }
}

// ============================================================================
// 降级路径：LIKE 查询
// ============================================================================

async function executeSearchUsersFallback(
  params: ResolvedSearchUsersParams
): Promise<SearchQueryResult<SearchUserResult>> {
  const { query, limit, offset } = params

  const where = {
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { bio: { contains: query, mode: "insensitive" as const } },
    ],
    status: "ACTIVE" as const,
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  const items: SearchUserResult[] = users.map((user, index) => ({
    ...user,
    rank: offset + index + 1,
    similarity: 0, // LIKE 查询没有相似度分数
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
 * 搜索用户
 * 使用 pg_trgm 扩展进行模糊搜索，失败时降级到 LIKE 查询
 */
export const searchUsers = withFallback(
  (params: SearchUsersParams) => {
    const resolved = resolveSearchUsersParams(params)
    return executeSearchUsersMain(resolved)
  },
  (params: SearchUsersParams) => {
    const resolved = resolveSearchUsersParams(params)
    return executeSearchUsersFallback(resolved)
  },
  "用户"
)
