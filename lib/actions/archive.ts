"use server"

import { performance } from "perf_hooks"

import { Prisma } from "@/lib/generated/prisma"
import prisma from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import {
  archiveMonthNames,
  buildArchiveTimeline,
  resolveAdjacentMonths,
  summarizeArchivePosts,
  type ArchiveAggregateRow,
} from "@/lib/utils/archive"
import { createLogger } from "@/lib/utils/logger"
import { ARCHIVE_CACHE_TAGS } from "@/lib/cache/archive-tags"
import {
  ARCHIVE_SEARCH_MAX_QUERY_LENGTH,
  ARCHIVE_SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/constants/archive-search"

// 类型定义
export interface ArchivePost {
  id: string
  title: string
  slug: string
  summary: string | null
  publishedAt: Date
  tags: {
    tag: {
      id: string
      name: string
      slug: string
    }
  }[]
}

export interface ArchiveMonth {
  month: number
  monthName: string
  count: number
  posts: ArchivePost[]
}

export interface ArchiveYear {
  year: number
  months: ArchiveMonth[]
  totalCount: number
}

export interface ArchiveStats {
  totalPosts: number
  totalYears: number
  oldestPost: Date | null
  newestPost: Date | null
  postsPerYear: { year: number; count: number }[]
}

const ARCHIVE_CACHE_TTL = 3600
const DEFAULT_MONTHLY_PREVIEW_POSTS = 5
const MAX_SEARCH_RESULTS = 20

const archivePostSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  publishedAt: true,
  tags: {
    select: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} as const

const archiveLogger = createLogger("archive-actions")

interface ArchiveQueryOptions {
  year?: number
  month?: number
  limit?: number
  offset?: number
  limitYears?: number
  offsetYears?: number
  perMonthPostLimit?: number | null
}

type ArchiveQuery =
  | {
      type: "month"
      year: number
      month: number
      startDate: Date
      endDate: Date
    }
  | {
      type: "year"
      year: number
      startDate: Date
      endDate: Date
    }
  | {
      type: "recent"
      limitYears: number
      offsetYears: number
    }
  | {
      type: "all"
    }

interface NormalizedArchiveOptions {
  query: ArchiveQuery
  pagination: {
    limit?: number
    offset?: number
  }
  perMonthPostLimit: number | null
}

/**
 * 获取归档数据
 * @param options 查询选项
 * @returns 按年月分组的文章数据
 */
export async function getArchiveData(options?: ArchiveQueryOptions): Promise<ArchiveYear[]> {
  const normalizedOptions = normalizeArchiveOptions(options)
  const cacheKey = buildArchiveCacheKey(normalizedOptions)

  const startTime = performance.now()

  const getCachedData = unstable_cache(
    async () => {
      const { query, pagination } = normalizedOptions
      const publishedAtFilter: Prisma.DateTimeNullableFilter = { not: null }

      let aggregateStartDate: Date | undefined
      let aggregateEndDate: Date | undefined
      let aggregateAllowedYears: number[] | undefined

      switch (query.type) {
        case "month": {
          publishedAtFilter.gte = query.startDate
          publishedAtFilter.lte = query.endDate
          aggregateStartDate = query.startDate
          aggregateEndDate = query.endDate
          break
        }
        case "year": {
          publishedAtFilter.gte = query.startDate
          publishedAtFilter.lte = query.endDate
          aggregateStartDate = query.startDate
          aggregateEndDate = query.endDate
          break
        }
        case "recent": {
          const yearCounts = await getArchiveYears()
          if (yearCounts.length === 0) {
            return []
          }

          const allowedYears = yearCounts
            .slice(query.offsetYears, query.offsetYears + query.limitYears)
            .map(({ year }) => year)

          if (!allowedYears.length) {
            return []
          }

          aggregateAllowedYears = allowedYears
          const minYear = Math.min(...allowedYears)
          const maxYear = Math.max(...allowedYears)
          aggregateStartDate = new Date(minYear, 0, 1)
          aggregateEndDate = new Date(maxYear, 11, 31, 23, 59, 59, 999)
          publishedAtFilter.gte = aggregateStartDate
          publishedAtFilter.lte = aggregateEndDate
          break
        }
        case "all": {
          break
        }
      }

      const archivePosts = await fetchArchivePosts({
        publishedAtFilter,
        pagination,
        allowedYears: aggregateAllowedYears,
        perMonthPostLimit: normalizedOptions.perMonthPostLimit,
      })

      if (archivePosts.length === 0) {
        return []
      }

      let aggregates = await fetchArchiveAggregates({
        startDate: aggregateStartDate,
        endDate: aggregateEndDate,
        allowedYears: aggregateAllowedYears,
      })

      // 兜底机制：如果数据库聚合失败但有文章数据，使用内存聚合
      if (aggregates.length === 0 && archivePosts.length > 0) {
        archiveLogger.warn("Database aggregates empty, falling back to in-memory aggregation", {
          postsCount: archivePosts.length,
        })
        aggregates = summarizeArchivePosts(archivePosts)
      }

      if (aggregates.length === 0) {
        return []
      }

      return buildArchiveTimeline(aggregates, archivePosts, archiveMonthNames)
    },
    cacheKey,
    {
      revalidate: ARCHIVE_CACHE_TTL,
      tags: resolveArchiveCacheTags(normalizedOptions),
    }
  )

  try {
    const data = await getCachedData()
    const duration = performance.now() - startTime
    archiveLogger.info("Archive data fetched", {
      queryType: normalizedOptions.query.type,
      perMonthPostLimit: normalizedOptions.perMonthPostLimit ?? "all",
      yearCount: data.length,
      postCount: countArchivePosts(data),
      durationMs: Number(duration.toFixed(2)),
    })
    return data
  } catch (error) {
    const duration = performance.now() - startTime
    archiveLogger.error(
      "Failed to fetch archive data",
      {
        queryType: normalizedOptions.query.type,
        perMonthPostLimit: normalizedOptions.perMonthPostLimit ?? "all",
        durationMs: Number(duration.toFixed(2)),
      },
      error
    )
    throw error
  }
}

/**
 * 获取所有年份列表
 * @returns 年份及对应文章数
 */
export async function getArchiveYears(): Promise<{ year: number; count: number }[]> {
  const getCachedYears = unstable_cache(
    async () => {
      return prisma.$queryRaw<{ year: number; count: number }[]>(Prisma.sql`
        SELECT
          EXTRACT(YEAR FROM "publishedAt")::int AS "year",
          COUNT(*)::int AS "count"
        FROM "posts"
        WHERE "published" = true AND "publishedAt" IS NOT NULL
        GROUP BY "year"
        ORDER BY "year" DESC
      `)
    },
    ["archive:years"],
    {
      revalidate: ARCHIVE_CACHE_TTL,
      tags: [ARCHIVE_CACHE_TAGS.years],
    }
  )

  try {
    return await getCachedYears()
  } catch (error) {
    archiveLogger.error("Failed to fetch archive years", error)
    return []
  }
}

/**
 * 获取特定年份的月份列表
 * @param year 年份
 * @returns 月份及对应文章数
 */
export async function getArchiveMonths(
  year: number
): Promise<{ month: number; monthName: string; count: number }[]> {
  const getCachedMonths = unstable_cache(
    async () => {
      const startDate = new Date(year, 0, 1)
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999)

      const rows = await prisma.$queryRaw<{ month: number; count: number }[]>(Prisma.sql`
        SELECT
          EXTRACT(MONTH FROM "publishedAt")::int AS "month",
          COUNT(*)::int AS "count"
        FROM "posts"
        WHERE "published" = true
          AND "publishedAt" BETWEEN ${startDate} AND ${endDate}
        GROUP BY "month"
        ORDER BY "month" DESC
      `)

      return rows.map(({ month, count }) => ({
        month,
        monthName: archiveMonthNames[month - 1],
        count,
      }))
    },
    ["archive:months", year.toString()],
    {
      revalidate: ARCHIVE_CACHE_TTL,
      tags: [ARCHIVE_CACHE_TAGS.year(year)],
    }
  )

  try {
    return await getCachedMonths()
  } catch (error) {
    archiveLogger.error("Failed to fetch archive months", { year }, error)
    return []
  }
}

/**
 * 获取归档统计信息
 * @returns 统计数据
 */
export async function getArchiveStats(): Promise<ArchiveStats> {
  const getCachedStats = unstable_cache(
    async () => {
      // 获取总文章数
      const totalPosts = await prisma.post.count({
        where: {
          published: true,
          publishedAt: { not: null },
        },
      })

      // 获取最早和最新的文章
      const [oldestPost, newestPost] = await Promise.all([
        prisma.post.findFirst({
          where: {
            published: true,
            publishedAt: { not: null },
          },
          orderBy: { publishedAt: "asc" },
          select: { publishedAt: true },
        }),
        prisma.post.findFirst({
          where: {
            published: true,
            publishedAt: { not: null },
          },
          orderBy: { publishedAt: "desc" },
          select: { publishedAt: true },
        }),
      ])

      // 计算年份数
      const years = await getArchiveYears()
      const totalYears = years.length

      // 每年文章数统计
      const postsPerYear = years.map(({ year, count }) => ({ year, count }))

      return {
        totalPosts,
        totalYears,
        oldestPost: oldestPost?.publishedAt || null,
        newestPost: newestPost?.publishedAt || null,
        postsPerYear,
      }
    },
    ["archive:stats"],
    {
      revalidate: ARCHIVE_CACHE_TTL,
      tags: [ARCHIVE_CACHE_TAGS.stats],
    }
  )

  try {
    return await getCachedStats()
  } catch (error) {
    archiveLogger.error("Failed to fetch archive stats", error)
    return {
      totalPosts: 0,
      totalYears: 0,
      oldestPost: null,
      newestPost: null,
      postsPerYear: [],
    }
  }
}

/**
 * 获取相邻月份的导航信息
 * @param year 当前年份
 * @param month 当前月份
 * @returns 前一个月和后一个月的信息
 */
export async function getAdjacentMonths(year: number, month: number) {
  const years = await getArchiveYears()
  if (years.length === 0) {
    return { prev: null, next: null }
  }

  const sortedYears = years.map((item) => item.year).sort((a, b) => a - b)
  const monthsByYear = new Map<number, number[]>()

  // 批量查询所有年份的月份数据，避免 N+1 查询
  const allMonths = await prisma.$queryRaw<{ year: number; month: number }[]>(Prisma.sql`
    SELECT DISTINCT
      EXTRACT(YEAR FROM "publishedAt")::int AS "year",
      EXTRACT(MONTH FROM "publishedAt")::int AS "month"
    FROM "posts"
    WHERE "published" = true
      AND "publishedAt" IS NOT NULL
      AND EXTRACT(YEAR FROM "publishedAt")::int IN (${Prisma.join(sortedYears)})
    ORDER BY "year" ASC, "month" ASC
  `)

  // 按年份分组月份数据
  allMonths.forEach(({ year: yearItem, month: monthItem }) => {
    if (!monthsByYear.has(yearItem)) {
      monthsByYear.set(yearItem, [])
    }
    monthsByYear.get(yearItem)!.push(monthItem)
  })

  return resolveAdjacentMonths(year, month, sortedYears, monthsByYear)
}

/**
 * 搜索归档中的文章
 * @param query 搜索关键词
 * @param year 限定年份（可选）
 * @returns 搜索结果
 */
export async function searchArchivePosts(query: string, year?: number): Promise<ArchivePost[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < ARCHIVE_SEARCH_MIN_QUERY_LENGTH) {
    return []
  }

  if (normalizedQuery.length > ARCHIVE_SEARCH_MAX_QUERY_LENGTH) {
    archiveLogger.warn("archive_search_query_too_long", {
      queryLength: normalizedQuery.length,
      year,
    })
    return []
  }

  const tsQuery = Prisma.sql`websearch_to_tsquery('simple', ${normalizedQuery})`
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"published" = true`,
    Prisma.sql`"publishedAt" IS NOT NULL`,
    Prisma.sql`"search_vector" @@ ${tsQuery}`,
  ]

  if (typeof year === "number" && !Number.isNaN(year)) {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)
    conditions.push(Prisma.sql`"publishedAt" BETWEEN ${startDate} AND ${endDate}`)
  }

  const whereClause = Prisma.join(conditions, " AND ")

  const candidates = await prisma.$queryRaw<{ id: string; rank: number }[]>(Prisma.sql`
    SELECT "id",
           ts_rank("search_vector", ${tsQuery}) AS rank
    FROM "posts"
    WHERE ${whereClause}
    ORDER BY rank DESC, "publishedAt" DESC
    LIMIT ${MAX_SEARCH_RESULTS}
  `)

  if (candidates.length === 0) {
    return []
  }

  const orderedIds = candidates.map((row) => row.id)
  const orderMap = new Map<string, number>()
  orderedIds.forEach((id, index) => {
    orderMap.set(id, index)
  })

  const posts = await prisma.post.findMany({
    where: {
      id: { in: orderedIds },
    },
    take: MAX_SEARCH_RESULTS,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      tags: {
        select: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  const sortedPosts = posts.sort((a, b) => {
    const orderA = orderMap.get(a.id)
    const orderB = orderMap.get(b.id)
    return (orderA ?? Number.MAX_SAFE_INTEGER) - (orderB ?? Number.MAX_SAFE_INTEGER)
  })

  return sortedPosts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.excerpt,
    publishedAt: post.publishedAt!,
    tags: post.tags,
  }))
}

async function fetchArchiveAggregates({
  startDate,
  endDate,
  allowedYears,
}: {
  startDate?: Date
  endDate?: Date
  allowedYears?: number[]
}): Promise<ArchiveAggregateRow[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"published" = true`,
    Prisma.sql`"publishedAt" IS NOT NULL`,
  ]

  if (startDate) {
    conditions.push(Prisma.sql`"publishedAt" >= ${startDate}`)
  }

  if (endDate) {
    conditions.push(Prisma.sql`"publishedAt" <= ${endDate}`)
  }

  if (allowedYears && allowedYears.length > 0) {
    conditions.push(
      Prisma.sql`EXTRACT(YEAR FROM "publishedAt")::int IN (${Prisma.join(allowedYears)})`
    )
  }

  const whereClause = Prisma.join(conditions, " AND ")

  return prisma.$queryRaw<ArchiveAggregateRow[]>(Prisma.sql`
    SELECT
      EXTRACT(YEAR FROM "publishedAt")::int AS "year",
      EXTRACT(MONTH FROM "publishedAt")::int AS "month",
      COUNT(*)::int AS "count"
    FROM "posts"
    WHERE ${whereClause}
    GROUP BY "year", "month"
    ORDER BY "year" DESC, "month" DESC
  `)
}

async function fetchArchivePosts({
  publishedAtFilter,
  pagination,
  allowedYears,
  perMonthPostLimit,
}: {
  publishedAtFilter: Prisma.DateTimeNullableFilter
  pagination: { limit?: number; offset?: number }
  allowedYears?: number[]
  perMonthPostLimit: number | null
}): Promise<ArchivePost[]> {
  if (perMonthPostLimit === null) {
    const posts = await prisma.post.findMany({
      where: buildPostWhere(publishedAtFilter, allowedYears),
      select: archivePostSelect,
      orderBy: { publishedAt: "desc" },
      skip: pagination.offset,
      take: pagination.limit,
    })
    return mapPostsToArchivePosts(posts)
  }

  const orderedIds = await fetchPostIdsWithMonthlyLimit({
    publishedAtFilter,
    allowedYears,
    perMonthPostLimit,
  })

  if (orderedIds.length === 0) {
    return []
  }

  const pagedIds = applyPaginationToIds(orderedIds, pagination)
  if (pagedIds.length === 0) {
    return []
  }

  const orderMap = new Map(pagedIds.map((id, index) => [id, index]))

  const posts = await prisma.post.findMany({
    where: { id: { in: pagedIds } },
    select: archivePostSelect,
  })

  const mapped = mapPostsToArchivePosts(posts)

  return mapped.sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

async function fetchPostIdsWithMonthlyLimit({
  publishedAtFilter,
  allowedYears,
  perMonthPostLimit,
}: {
  publishedAtFilter: Prisma.DateTimeNullableFilter
  allowedYears?: number[]
  perMonthPostLimit: number
}): Promise<string[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"published" = true`,
    Prisma.sql`"publishedAt" IS NOT NULL`,
  ]

  if (publishedAtFilter.gte) {
    conditions.push(Prisma.sql`"publishedAt" >= ${publishedAtFilter.gte}`)
  }

  if (publishedAtFilter.gt) {
    conditions.push(Prisma.sql`"publishedAt" > ${publishedAtFilter.gt}`)
  }

  if (publishedAtFilter.lte) {
    conditions.push(Prisma.sql`"publishedAt" <= ${publishedAtFilter.lte}`)
  }

  if (publishedAtFilter.lt) {
    conditions.push(Prisma.sql`"publishedAt" < ${publishedAtFilter.lt}`)
  }

  if (allowedYears && allowedYears.length > 0) {
    conditions.push(
      Prisma.sql`EXTRACT(YEAR FROM "publishedAt")::int IN (${Prisma.join(allowedYears)})`
    )
  }

  const whereClause = conditions.length > 0 ? Prisma.join(conditions, " AND ") : Prisma.sql`TRUE`

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH filtered_posts AS (
      SELECT
        "id",
        "publishedAt",
        ROW_NUMBER() OVER (
          PARTITION BY EXTRACT(YEAR FROM "publishedAt")::int,
                       EXTRACT(MONTH FROM "publishedAt")::int
          ORDER BY "publishedAt" DESC, "id" DESC
        ) AS month_rank
      FROM "posts"
      WHERE ${whereClause}
    )
    SELECT "id"
    FROM filtered_posts
    WHERE month_rank <= ${perMonthPostLimit}
    ORDER BY "publishedAt" DESC, "id" DESC
  `)

  return rows.map((row) => row.id)
}

function buildPostWhere(
  publishedAtFilter: Prisma.DateTimeNullableFilter,
  allowedYears?: number[]
): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {
    published: true,
    publishedAt: publishedAtFilter,
  }

  if (allowedYears && allowedYears.length > 0) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []
    where.AND = [
      ...existingAnd,
      {
        OR: allowedYears.map((year) => ({
          publishedAt: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31, 23, 59, 59, 999),
          },
        })),
      },
    ]
  }

  return where
}

function mapPostsToArchivePosts(
  posts: Array<{
    id: string
    title: string
    slug: string
    excerpt: string | null
    publishedAt: Date | null
    tags: {
      tag: {
        id: string
        name: string
        slug: string
      }
    }[]
  }>
): ArchivePost[] {
  return posts
    .filter((post) => post.publishedAt)
    .map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.excerpt,
      publishedAt: post.publishedAt!,
      tags: post.tags,
    }))
}

function applyPaginationToIds(
  ids: string[],
  pagination: { limit?: number; offset?: number }
): string[] {
  const start = pagination.offset ?? 0
  if (start >= ids.length) {
    return []
  }

  if (pagination.limit === undefined) {
    return ids.slice(start)
  }

  return ids.slice(start, start + pagination.limit)
}

function normalizeArchiveOptions(options?: ArchiveQueryOptions): NormalizedArchiveOptions {
  const limit = toPositiveInt(options?.limit)
  const offset = toNonNegativeInt(options?.offset)

  const rawYear = toNonNegativeInt(options?.year)
  const year = rawYear && rawYear > 0 ? rawYear : undefined

  const rawMonth = toNonNegativeInt(options?.month)
  const month = rawMonth && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : undefined

  const limitYears = year ? undefined : toPositiveInt(options?.limitYears)
  const offsetYears = limitYears ? (toNonNegativeInt(options?.offsetYears) ?? 0) : 0

  let query: ArchiveQuery

  if (year !== undefined && month !== undefined) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)
    query = {
      type: "month",
      year,
      month,
      startDate,
      endDate,
    }
  } else if (year !== undefined) {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)
    query = {
      type: "year",
      year,
      startDate,
      endDate,
    }
  } else if (limitYears !== undefined) {
    query = {
      type: "recent",
      limitYears,
      offsetYears,
    }
  } else {
    query = { type: "all" }
  }

  return {
    query,
    pagination: { limit, offset },
    perMonthPostLimit: resolvePerMonthPostLimit(options?.perMonthPostLimit, query.type),
  }
}

function buildArchiveCacheKey(options: NormalizedArchiveOptions): string[] {
  const parts: string[] = ["archive:data"]

  switch (options.query.type) {
    case "month":
      parts.push("type:month", `y:${options.query.year}`, `m:${options.query.month}`)
      break
    case "year":
      parts.push("type:year", `y:${options.query.year}`)
      break
    case "recent":
      parts.push("type:recent", `ly:${options.query.limitYears}`, `oy:${options.query.offsetYears}`)
      break
    case "all":
      parts.push("type:all")
      break
  }

  if (options.pagination.limit !== undefined) {
    parts.push(`limit:${options.pagination.limit}`)
  }

  if (options.pagination.offset !== undefined) {
    parts.push(`offset:${options.pagination.offset}`)
  }

  parts.push(
    options.perMonthPostLimit === null ? "perMonth:all" : `perMonth:${options.perMonthPostLimit}`
  )

  return parts
}

function resolveArchiveCacheTags(options: NormalizedArchiveOptions): string[] {
  const tags = new Set<string>([ARCHIVE_CACHE_TAGS.list])

  switch (options.query.type) {
    case "month":
      tags.add(ARCHIVE_CACHE_TAGS.year(options.query.year))
      tags.add(ARCHIVE_CACHE_TAGS.month(options.query.year, options.query.month))
      break
    case "year":
      tags.add(ARCHIVE_CACHE_TAGS.year(options.query.year))
      break
    case "recent":
    case "all":
      // 为 recent 和 all 类型添加 years 标签，确保任何年份的数据更新都会失效这些缓存
      tags.add(ARCHIVE_CACHE_TAGS.years)
      break
  }

  return Array.from(tags)
}

function resolvePerMonthPostLimit(
  explicitLimit: number | null | undefined,
  queryType: ArchiveQuery["type"]
): number | null {
  if (explicitLimit === null) {
    return null
  }

  const parsed = toPositiveInt(explicitLimit)
  if (parsed !== undefined) {
    return parsed
  }

  if (queryType === "month") {
    return null
  }

  return DEFAULT_MONTHLY_PREVIEW_POSTS
}

function countArchivePosts(years: ArchiveYear[]): number {
  return years.reduce((yearTotal, year) => {
    const monthTotal = year.months.reduce((sum, month) => sum + month.posts.length, 0)
    return yearTotal + monthTotal
  }, 0)
}

function toFiniteInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined
  }

  const truncated = Math.trunc(value)
  return Math.abs(truncated) === Infinity ? undefined : truncated
}

function toPositiveInt(value: number | undefined): number | undefined {
  const parsed = toFiniteInteger(value)
  if (parsed === undefined || parsed <= 0) {
    return undefined
  }

  return parsed
}

function toNonNegativeInt(value: number | undefined): number | undefined {
  const parsed = toFiniteInteger(value)
  if (parsed === undefined || parsed < 0) {
    return undefined
  }

  return parsed
}
