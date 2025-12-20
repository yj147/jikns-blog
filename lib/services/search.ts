import "server-only"
import { Prisma } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { buildILikePattern } from "@/lib/repos/search/shared/utils"
import { tokenizeText } from "@/lib/search/tokenizer"
import { signAvatarUrl } from "@/lib/storage/signed-url"
import { createLogger } from "@/lib/utils/logger"
import {
  SearchValidationError,
  type SearchResultBucket,
  type SearchActivityHit,
  type SearchPostHit,
  type SearchTagHit,
  type SearchUserHit,
  type UnifiedSearchParams,
  type UnifiedSearchResult,
  UNIFIED_SEARCH_SORTS,
  UNIFIED_SEARCH_TYPES,
  type UnifiedSearchSort,
  type UnifiedSearchType,
} from "@/types/search"

const logger = createLogger("unified-search-service")

const MAX_QUERY_LENGTH = 100
const MIN_QUERY_LENGTH = 1
const MAX_LIMIT = 10
const MIN_LIMIT = 1
const DEFAULT_LIMIT = 10
const DEFAULT_PAGE = 1
const DECAY_SECONDS = (30 * 24 * 60 * 60).toString() // 30 天衰减期
const RANK_WEIGHT = "0.7"
const TIME_WEIGHT = "0.3"
const BANNED_QUERY_PATTERN = /(--|\/\*|\*\/|;)/

type FtsConfig = "simple" | "english"

function sanitizeQuery(query: string): string {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH || trimmed.length > MAX_QUERY_LENGTH) {
    throw new SearchValidationError("搜索关键词长度必须在 1-100 之间")
  }

  if (BANNED_QUERY_PATTERN.test(trimmed)) {
    throw new SearchValidationError("搜索关键词包含非法字符", {
      pattern: BANNED_QUERY_PATTERN.source,
    })
  }

  return trimmed
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT
  const parsed = Math.trunc(limit as number)
  if (parsed < MIN_LIMIT) return MIN_LIMIT
  if (parsed > MAX_LIMIT) return MAX_LIMIT
  return parsed
}

function normalizePage(page?: number): number {
  if (!Number.isFinite(page)) return DEFAULT_PAGE
  const parsed = Math.trunc(page as number)
  return parsed >= 1 ? parsed : DEFAULT_PAGE
}

function normalizeType(type?: UnifiedSearchType): UnifiedSearchType {
  if (!type) return "all"
  return UNIFIED_SEARCH_TYPES.includes(type) ? type : "all"
}

function normalizeSort(sort?: UnifiedSearchSort): UnifiedSearchSort {
  if (!sort) return "relevance"
  return UNIFIED_SEARCH_SORTS.includes(sort) ? sort : "relevance"
}

function normalizeParams(params: UnifiedSearchParams): Required<UnifiedSearchParams> {
  return {
    query: sanitizeQuery(params.query),
    type: normalizeType(params.type),
    page: normalizePage(params.page),
    limit: normalizeLimit(params.limit),
    sort: normalizeSort(params.sort),
  }
}

function buildTsQuery(query: string, config: FtsConfig): Prisma.Sql {
  // 先用相同的分词器处理查询，确保与存储的 tokens 一致
  const tokenizedQuery = tokenizeText(query)

  // 将 regconfig 作为字面量内联并显式 cast，避免 Prisma 绑定参数时将 tsquery 当成 jsonb
  const configSql = config === "english" ? Prisma.raw("'english'") : Prisma.raw("'simple'")
  return Prisma.sql`(plainto_tsquery(${configSql}::regconfig, ${tokenizedQuery}::text))::tsquery`
}

function buildRankClause(
  vectorColumn: string,
  tsQuery: Prisma.Sql,
  timestampColumn: string,
  sort: UnifiedSearchSort
) {
  const rankExpression = Prisma.sql`ts_rank(${Prisma.raw(vectorColumn)}, ${tsQuery}) * ${Prisma.raw(
    RANK_WEIGHT
  )} + EXP(-EXTRACT(EPOCH FROM (NOW() - ${Prisma.raw(timestampColumn)})) / ${Prisma.raw(
    DECAY_SECONDS
  )}) * ${Prisma.raw(TIME_WEIGHT)}`
  const rankSelect = rankExpression

  const orderByClause =
    sort === "latest"
      ? Prisma.sql`${Prisma.raw(timestampColumn)} DESC NULLS LAST, ${rankExpression} DESC`
      : Prisma.sql`${rankExpression} DESC, ${Prisma.raw(timestampColumn)} DESC NULLS LAST`

  return { rankSelect, orderByClause }
}

async function withFallback<T>(
  main: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await main()
  } catch (error) {
    logger.warn(`${context} FTS 查询失败，降级到 LIKE`, {
      error: error instanceof Error ? error.message : String(error),
    })
    return fallback()
  }
}

function toBucket<T>(
  data: { total: number; items: T[] },
  page: number,
  limit: number
): SearchResultBucket<T> {
  const hasMore = data.total > page * limit
  return {
    items: data.items,
    total: data.total,
    page,
    limit,
    hasMore,
  }
}

async function searchPostsCount(query: string, _sort: UnifiedSearchSort): Promise<number> {
  const tsQuery = buildTsQuery(query, "simple")

  const ftsSearch = async () => {
    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM posts p
      WHERE p.published = true
        AND p.search_vector @@ ${tsQuery}
    `)

    return Number(count[0]?.total ?? 0)
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM posts p
      WHERE p.published = true
        AND (
          p.title ILIKE ${likePattern} OR
          p.excerpt ILIKE ${likePattern} OR
          p.content ILIKE ${likePattern}
        )
    `

    return Number(count[0]?.total ?? 0)
  }

  return withFallback(ftsSearch, likeSearch, "posts-count")
}

async function searchActivitiesCount(query: string, _sort: UnifiedSearchSort): Promise<number> {
  const tsQuery = buildTsQuery(query, "simple")

  const ftsSearch = async () => {
    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM activities a
      WHERE a."deletedAt" IS NULL
        AND a.search_vector @@ ${tsQuery}
    `)

    return Number(count[0]?.total ?? 0)
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM activities a
      WHERE a."deletedAt" IS NULL
        AND a.content ILIKE ${likePattern}
    `

    return Number(count[0]?.total ?? 0)
  }

  return withFallback(ftsSearch, likeSearch, "activities-count")
}

async function searchUsersCount(query: string, _sort: UnifiedSearchSort): Promise<number> {
  const tsQuery = buildTsQuery(query, "simple")

  const ftsSearch = async () => {
    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND u.search_vector @@ ${tsQuery}
    `)

    return Number(count[0]?.total ?? 0)
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND (
          u.name ILIKE ${likePattern} OR
          u.email ILIKE ${likePattern} OR
          COALESCE(u.bio, '') ILIKE ${likePattern}
        )
    `

    return Number(count[0]?.total ?? 0)
  }

  return withFallback(ftsSearch, likeSearch, "users-count")
}

async function searchTagsCount(query: string, _sort: UnifiedSearchSort): Promise<number> {
  const tsQuery = buildTsQuery(query, "simple")

  const ftsSearch = async () => {
    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM tags t
      WHERE t.search_vector @@ ${tsQuery}
    `)

    return Number(count[0]?.total ?? 0)
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM tags t
      WHERE
        t.name ILIKE ${likePattern} OR
        COALESCE(t.description, '') ILIKE ${likePattern}
    `

    return Number(count[0]?.total ?? 0)
  }

  return withFallback(ftsSearch, likeSearch, "tags-count")
}

async function searchPosts(
  query: string,
  limit: number,
  offset: number,
  sort: UnifiedSearchSort
): Promise<{ total: number; items: SearchPostHit[] }> {
  const tsQuery = buildTsQuery(query, "simple")
  const timestampColumn = `COALESCE(p."publishedAt", p."createdAt")`
  const { rankSelect, orderByClause } = buildRankClause(
    "p.search_vector",
    tsQuery,
    timestampColumn,
    sort
  )

  const ftsSearch = async () => {
    const rowsQuery = Prisma.sql`
      SELECT
        p.id,
        p.slug,
        p.title,
        p.excerpt,
        p."publishedAt",
        p."createdAt",
        p."coverImage",
        p."authorId",
        u.name as "authorName",
        ${rankSelect} as rank
      FROM posts p
      JOIN users u ON u.id = p."authorId"
      WHERE p.published = true
        AND p.search_vector @@ ${tsQuery}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const rows = await prisma.$queryRaw<SearchPostHit[]>(rowsQuery)

    const countQuery = Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM posts p
      WHERE p.published = true
        AND p.search_vector @@ ${tsQuery}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(countQuery)

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)
    const orderBy =
      sort === "latest"
        ? Prisma.sql`COALESCE(p."publishedAt", p."createdAt") DESC NULLS LAST`
        : Prisma.sql`COALESCE(p."publishedAt", p."createdAt") DESC NULLS LAST`

    const rows = await prisma.$queryRaw<SearchPostHit[]>`
      SELECT
        p.id,
        p.slug,
        p.title,
        p.excerpt,
        p."publishedAt",
        p."createdAt",
        p."coverImage",
        p."authorId",
        u.name as "authorName",
        0 as rank
      FROM posts p
      JOIN users u ON u.id = p."authorId"
      WHERE p.published = true
        AND (
          p.title ILIKE ${likePattern} OR
          p.excerpt ILIKE ${likePattern} OR
          p.content ILIKE ${likePattern}
        )
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM posts p
      WHERE p.published = true
        AND (
          p.title ILIKE ${likePattern} OR
          p.excerpt ILIKE ${likePattern} OR
          p.content ILIKE ${likePattern}
        )
    `

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  return withFallback(ftsSearch, likeSearch, "posts")
}

async function searchActivities(
  query: string,
  limit: number,
  offset: number,
  sort: UnifiedSearchSort
): Promise<{ total: number; items: SearchActivityHit[] }> {
  const tsQuery = buildTsQuery(query, "simple")
  const timestampColumn = `a."createdAt"`
  const { rankSelect, orderByClause } = buildRankClause(
    "a.search_vector",
    tsQuery,
    timestampColumn,
    sort
  )

  const ftsSearch = async () => {
    const rowsQuery = Prisma.sql`
      SELECT
        a.id,
        a.content,
        a."imageUrls",
        a."createdAt",
        a."authorId",
        u.name as "authorName",
        ${rankSelect} as rank
      FROM activities a
      JOIN users u ON u.id = a."authorId"
      WHERE a."deletedAt" IS NULL
        AND a.search_vector @@ ${tsQuery}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const rows = await prisma.$queryRaw<SearchActivityHit[]>(rowsQuery)

    const countQuery = Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM activities a
      WHERE a."deletedAt" IS NULL
        AND a.search_vector @@ ${tsQuery}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(countQuery)

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)
    const orderBy =
      sort === "latest"
        ? Prisma.sql`a."createdAt" DESC, a.id DESC`
        : Prisma.sql`a."createdAt" DESC, a.id DESC`

    const rows = await prisma.$queryRaw<SearchActivityHit[]>`
      SELECT
        a.id,
        a.content,
        a."imageUrls",
        a."createdAt",
        a."authorId",
        u.name as "authorName",
        0 as rank
      FROM activities a
      JOIN users u ON u.id = a."authorId"
      WHERE a."deletedAt" IS NULL
        AND a.content ILIKE ${likePattern}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM activities a
      WHERE a."deletedAt" IS NULL
        AND a.content ILIKE ${likePattern}
    `

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  return withFallback(ftsSearch, likeSearch, "activities")
}

async function searchUsers(
  query: string,
  limit: number,
  offset: number,
  sort: UnifiedSearchSort
): Promise<{ total: number; items: SearchUserHit[] }> {
  // 用户名/邮箱包含中文和特殊字符（如邮箱符号），使用 simple 配置避免词干导致匹配缺失
  const tsQuery = buildTsQuery(query, "simple")
  const timestampColumn = `COALESCE(u."lastLoginAt", u."createdAt")`
  const { rankSelect, orderByClause } = buildRankClause(
    "u.search_vector",
    tsQuery,
    timestampColumn,
    sort
  )

  const ftsSearch = async () => {
    const rowsQuery = Prisma.sql`
      SELECT
        u.id,
        u.name,
        u."avatarUrl",
        u.bio,
        ${rankSelect} as rank
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND u.search_vector @@ ${tsQuery}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const rows = await prisma.$queryRaw<SearchUserHit[]>(rowsQuery)

    const countQuery = Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND u.search_vector @@ ${tsQuery}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(countQuery)

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)
    const orderBy =
      sort === "latest"
        ? Prisma.sql`COALESCE(u."lastLoginAt", u."createdAt") DESC NULLS LAST`
        : Prisma.sql`COALESCE(u."lastLoginAt", u."createdAt") DESC NULLS LAST`

    const rows = await prisma.$queryRaw<SearchUserHit[]>`
      SELECT
        u.id,
        u.name,
        u."avatarUrl",
        u.bio,
        0 as rank
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND (
          u.name ILIKE ${likePattern} OR
          u.email ILIKE ${likePattern} OR
          COALESCE(u.bio, '') ILIKE ${likePattern}
        )
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM users u
      WHERE u.status = 'ACTIVE'
        AND (
          u.name ILIKE ${likePattern} OR
          u.email ILIKE ${likePattern} OR
          COALESCE(u.bio, '') ILIKE ${likePattern}
        )
    `

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  return withFallback(ftsSearch, likeSearch, "users")
}

async function searchTags(
  query: string,
  limit: number,
  offset: number,
  sort: UnifiedSearchSort
): Promise<{ total: number; items: SearchTagHit[] }> {
  // 标签名称多语言，使用 simple 配置提高命中率
  const tsQuery = buildTsQuery(query, "simple")
  const timestampColumn = `t."createdAt"`
  const { rankSelect, orderByClause } = buildRankClause(
    "t.search_vector",
    tsQuery,
    timestampColumn,
    sort
  )

  const ftsSearch = async () => {
    const rowsQuery = Prisma.sql`
      SELECT
        t.id,
        t.name,
        t.slug,
        t.description,
        t.color,
        t."postsCount",
        ${rankSelect} as rank
      FROM tags t
      WHERE t.search_vector @@ ${tsQuery}
      ORDER BY ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const rows = await prisma.$queryRaw<SearchTagHit[]>(rowsQuery)

    const countQuery = Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM tags t
      WHERE t.search_vector @@ ${tsQuery}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>(countQuery)

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  const likeSearch = async () => {
    const likePattern = buildILikePattern(query)
    const orderBy =
      sort === "latest"
        ? Prisma.sql`t."createdAt" DESC NULLS LAST`
        : Prisma.sql`t."createdAt" DESC NULLS LAST`

    const rows = await prisma.$queryRaw<SearchTagHit[]>`
      SELECT
        t.id,
        t.name,
        t.slug,
        t.description,
        t.color,
        t."postsCount",
        0 as rank
      FROM tags t
      WHERE
        t.name ILIKE ${likePattern} OR
        COALESCE(t.description, '') ILIKE ${likePattern}
      ORDER BY ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM tags t
      WHERE
        t.name ILIKE ${likePattern} OR
        COALESCE(t.description, '') ILIKE ${likePattern}
    `

    return { total: Number(count[0]?.total ?? 0), items: rows }
  }

  return withFallback(ftsSearch, likeSearch, "tags")
}

export async function unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  const normalized = normalizeParams(params)
  const offset = (normalized.page - 1) * normalized.limit
  const searchAll = normalized.type === "all"
  const shouldFetchItems = (target: UnifiedSearchType) => searchAll || normalized.type === target

  const countsPromise = Promise.all([
    searchPostsCount(normalized.query, normalized.sort),
    searchActivitiesCount(normalized.query, normalized.sort),
    searchUsersCount(normalized.query, normalized.sort),
    searchTagsCount(normalized.query, normalized.sort),
  ])

  const itemsPromise = Promise.all([
    shouldFetchItems("posts")
      ? searchPosts(normalized.query, normalized.limit, offset, normalized.sort)
      : Promise.resolve({ total: 0, items: [] }),
    shouldFetchItems("activities")
      ? searchActivities(normalized.query, normalized.limit, offset, normalized.sort)
      : Promise.resolve({ total: 0, items: [] }),
    shouldFetchItems("users")
      ? searchUsers(normalized.query, normalized.limit, offset, normalized.sort)
      : Promise.resolve({ total: 0, items: [] }),
    shouldFetchItems("tags")
      ? searchTags(normalized.query, normalized.limit, offset, normalized.sort)
      : Promise.resolve({ total: 0, items: [] }),
  ])

  const [[postsCount, activitiesCount, usersCount, tagsCount], [posts, activities, users, tags]] =
    await Promise.all([countsPromise, itemsPromise])

  // 签名用户头像 URL
  const signedUserItems = await Promise.all(
    users.items.map(async (user) => ({
      ...user,
      avatarUrl: await signAvatarUrl(user.avatarUrl),
    }))
  )

  const buckets = {
    posts: toBucket({ total: postsCount, items: posts.items }, normalized.page, normalized.limit),
    activities: toBucket(
      { total: activitiesCount, items: activities.items },
      normalized.page,
      normalized.limit
    ),
    users: toBucket(
      { total: usersCount, items: signedUserItems },
      normalized.page,
      normalized.limit
    ),
    tags: toBucket({ total: tagsCount, items: tags.items }, normalized.page, normalized.limit),
  }

  return {
    query: normalized.query,
    type: normalized.type,
    page: normalized.page,
    limit: normalized.limit,
    overallTotal: postsCount + activitiesCount + usersCount + tagsCount,
    ...buckets,
  }
}
