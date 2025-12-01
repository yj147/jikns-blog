/**
 * 文章搜索模块
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import "server-only"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { normalizeLimit, normalizeOffset, buildILikePattern } from "./shared/utils"
import { withFallback } from "./shared/fallback"
import type {
  SearchPostsParams,
  ResolvedSearchPostsParams,
  SearchPostResult,
  SearchQueryResult,
  SearchTagResult,
} from "./shared/types"
import {
  buildRankExpressions,
  buildTsQuery,
  type SearchExecutionMode,
} from "@/lib/search/rank-utils"
import { SEARCH_RANK_HALF_LIFE_DAYS } from "@/lib/search/search-config"

const POST_TIMESTAMP_COLUMN = Prisma.sql`COALESCE("publishedAt", "createdAt")`
const POST_FALLBACK_ORDER = Prisma.sql`${POST_TIMESTAMP_COLUMN} DESC NULLS LAST, "id" DESC`

function buildPostSearchClause(query: string, mode: SearchExecutionMode) {
  if (mode === "ts") {
    const tsQuery = buildTsQuery(query)
    return {
      clause: Prisma.sql`search_vector @@ ${tsQuery}`,
      tsQuery,
    }
  }

  const likePattern = buildILikePattern(query)
  return {
    clause: Prisma.sql`(
      title ILIKE ${likePattern} ESCAPE '\\' OR
      excerpt ILIKE ${likePattern} ESCAPE '\\' OR
      "seoDescription" ILIKE ${likePattern} ESCAPE '\\' OR
      content ILIKE ${likePattern} ESCAPE '\\'
    )`,
    tsQuery: undefined,
  }
}

// ============================================================================
// 参数解析
// ============================================================================

/**
 * 解析搜索文章参数
 *
 * @param params - 搜索参数
 * @param fallbackLimit - 默认分页大小
 * @returns 解析后的参数
 *
 * @remarks
 * 安全默认值设计：
 * - `onlyPublished` 默认为 `true`（只返回已发布文章）
 * - 必须显式传递 `false` 才能查询草稿文章
 * - 这符合"最小权限原则"和"安全默认值"原则
 * - 防止意外暴露未发布内容
 */
function resolveSearchPostsParams(
  params: SearchPostsParams,
  fallbackLimit: number
): ResolvedSearchPostsParams {
  const limit = normalizeLimit(params.limit, fallbackLimit)
  const offset = normalizeOffset(params.offset)
  const authorId = params.authorId ?? ""
  const tagIds = params.tagIds ? Array.from(new Set(params.tagIds)) : []
  const publishedFrom = params.publishedFrom ?? null
  const publishedTo = params.publishedTo ?? null
  const onlyPublished = params.onlyPublished ?? true
  const sort = params.sort ?? "relevance"

  return {
    query: params.query,
    limit,
    offset,
    authorId,
    tagIds,
    publishedFrom,
    publishedTo,
    onlyPublished,
    sort,
  }
}

// ============================================================================
// 主路径：全文搜索
// ============================================================================

/**
 * 构建文章搜索的 SQL 过滤条件
 */
function buildPostFilters(
  params: ResolvedSearchPostsParams,
  searchClause: Prisma.Sql
): Prisma.Sql[] {
  const { authorId, tagIds, publishedFrom, publishedTo, onlyPublished } = params
  const publishedTimestampColumn = POST_TIMESTAMP_COLUMN

  const filters: Prisma.Sql[] = [searchClause]

  if (onlyPublished) {
    filters.push(Prisma.sql`published = true`)
  }

  if (authorId) {
    filters.push(Prisma.sql`"authorId" = ${authorId}`)
  }

  if (publishedFrom) {
    filters.push(Prisma.sql`${publishedTimestampColumn} >= ${publishedFrom}`)
  }

  if (publishedTo) {
    filters.push(Prisma.sql`${publishedTimestampColumn} <= ${publishedTo}`)
  }

  if (tagIds && tagIds.length > 0) {
    filters.push(
      Prisma.sql`id IN (
        SELECT "postId"
        FROM post_tags
        WHERE "tagId" = ANY(${tagIds})
        GROUP BY "postId"
        HAVING COUNT(DISTINCT "tagId") = ${tagIds.length}
      )`
    )
  }

  return filters
}

/**
 * 获取文章的作者和标签信息
 */
async function fetchAuthorsAndTags(
  postIds: string[],
  authorIds: string[],
  includeTags: boolean
): Promise<{
  authors: Array<{ id: string; name: string | null; avatarUrl: string | null }>
  postTags: Array<{ postId: string; tag: SearchTagResult }>
}> {
  type AuthorSummary = { id: string; name: string | null; avatarUrl: string | null }
  type PostTagWithTag = { postId: string; tag: SearchTagResult }

  const [authors, postTags] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    }),
    includeTags
      ? prisma.postTag
          .findMany({
            where: { postId: { in: postIds } },
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                  description: true,
                  postsCount: true,
                },
              },
            },
          })
          .then((items) =>
            items.map<PostTagWithTag>((item, index) => ({
              postId: item.postId,
              tag: { ...item.tag, rank: item.tag.postsCount ?? index + 1 },
            }))
          )
      : Promise.resolve<PostTagWithTag[]>([]),
  ])

  return { authors, postTags }
}

/**
 * 映射文章搜索结果
 */
function mapPostResults(
  rows: Array<{
    id: string
    slug: string
    title: string
    excerpt: string | null
    coverImage: string | null
    published: boolean
    publishedAt: Date | null
    viewCount: number
    createdAt: Date
    rank: number
    authorId: string
  }>,
  authors: Array<{ id: string; name: string | null; avatarUrl: string | null }>,
  postTags: Array<{ postId: string; tag: SearchTagResult }>
): SearchPostResult[] {
  const authorMap = new Map(authors.map((a) => [a.id, a]))
  const tagsByPost = new Map<string, SearchTagResult[]>()

  for (const pt of postTags) {
    const tags = tagsByPost.get(pt.postId)
    if (tags) {
      tags.push(pt.tag)
    } else {
      tagsByPost.set(pt.postId, [pt.tag])
    }
  }

  return rows.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    published: post.published,
    publishedAt: post.publishedAt,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
    rank: post.rank,
    author: authorMap.get(post.authorId) || {
      id: post.authorId,
      name: null,
      avatarUrl: null,
    },
    tags: tagsByPost.get(post.id) || [],
  }))
}

/**
 * 执行文章搜索（根据 mode 决定全文或 LIKE）
 */
async function executeSearchPosts(
  params: ResolvedSearchPostsParams,
  mode: SearchExecutionMode,
  options?: { includeTags?: boolean }
): Promise<SearchQueryResult<SearchPostResult>> {
  const { query, limit, offset, sort } = params
  const includeTags = options?.includeTags ?? true
  const { clause, tsQuery } = buildPostSearchClause(query, mode)
  const filters = buildPostFilters(params, clause)
  const whereClause = Prisma.join(filters, " AND ")
  const { rankSelect, orderByClause } = buildRankExpressions({
    vectorColumn: Prisma.sql`search_vector`,
    timestampColumn: POST_TIMESTAMP_COLUMN,
    tsQuery,
    sort,
    halfLifeDays: SEARCH_RANK_HALF_LIFE_DAYS.posts,
    mode,
    fallbackOrderClause: POST_FALLBACK_ORDER,
  })

  const [rows, totalRows] = await prisma.$transaction([
    prisma.$queryRaw<
      Array<{
        id: string
        slug: string
        title: string
        excerpt: string | null
        coverImage: string | null
        published: boolean
        publishedAt: Date | null
        viewCount: number
        createdAt: Date
        rank: number
        authorId: string
      }>
    >`
      SELECT
        id,
        slug,
        title,
        excerpt,
        "coverImage",
        published,
        "publishedAt",
        "viewCount",
        "createdAt",
        ${rankSelect} as rank,
        "authorId"
      FROM posts
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM posts
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
  const postIds = rows.map((r) => r.id)

  const { authors, postTags } = await fetchAuthorsAndTags(postIds, authorIds, includeTags)
  const items = mapPostResults(rows, authors, postTags)

  return {
    total,
    items,
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 搜索文章
 * 使用 PostgreSQL 全文搜索，支持相关性排序和高级过滤
 * 如果全文搜索失败，自动降级到 LIKE 查询
 */
export const searchPosts = withFallback(
  (params: SearchPostsParams) => {
    const resolved = resolveSearchPostsParams(params, 20)
    return executeSearchPosts(resolved, "ts")
  },
  (params: SearchPostsParams) => {
    const resolved = resolveSearchPostsParams(params, 20)
    return executeSearchPosts(resolved, "like")
  },
  "文章"
)

/**
 * 搜索文章建议（不包含标签）
 */
export async function searchPostSuggestions(
  params: SearchPostsParams
): Promise<SearchQueryResult<SearchPostResult>> {
  const base = resolveSearchPostsParams(params, 5)
  const resolved: ResolvedSearchPostsParams = {
    ...base,
    onlyPublished: base.onlyPublished,
    sort: "relevance",
  }
  return executeSearchPosts(resolved, "ts", { includeTags: false })
}
