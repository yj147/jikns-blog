import "server-only"

import { searchActivities } from "./activities"
import { searchPosts } from "./posts"
import { searchTags } from "./tags"
import { searchUsers } from "./users"
import type {
  SearchActivityResult,
  SearchPostResult,
  SearchQueryResult,
  SearchTagResult,
  SearchUserResult,
} from "./shared/types"
import { signAvatarUrl } from "@/lib/storage/signed-url"
import {
  SearchValidationError,
  type SearchActivityHit,
  type SearchPostHit,
  type SearchResultBucket,
  type SearchTagHit,
  type SearchUserHit,
  type UnifiedSearchParams,
  type UnifiedSearchResult,
  UNIFIED_SEARCH_SORTS,
  UNIFIED_SEARCH_TYPES,
  type UnifiedSearchSort,
  type UnifiedSearchType,
} from "@/types/search"

const MAX_QUERY_LENGTH = 100
const MIN_QUERY_LENGTH = 1
const MAX_LIMIT = 10
const MIN_LIMIT = 1
const DEFAULT_LIMIT = 10
const DEFAULT_PAGE = 1
const BANNED_QUERY_PATTERN = /(--|\/\*|\*\/|;)/

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

function toBucket<T>(
  data: SearchQueryResult<T>,
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

function mapPostHit(post: SearchPostResult): SearchPostHit {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    coverImage: post.coverImage,
    authorId: post.author.id,
    authorName: post.author.name,
    rank: post.rank,
  }
}

function mapActivityHit(activity: SearchActivityResult): SearchActivityHit {
  return {
    id: activity.id,
    content: activity.content,
    imageUrls: activity.imageUrls,
    createdAt: activity.createdAt,
    authorId: activity.author.id,
    authorName: activity.author.name,
    rank: activity.rank,
  }
}

async function mapUserHit(user: SearchUserResult): Promise<SearchUserHit> {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: await signAvatarUrl(user.avatarUrl),
    bio: user.bio,
    rank: user.rank,
  }
}

function mapTagHit(tag: SearchTagResult): SearchTagHit {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    description: tag.description,
    color: tag.color,
    postsCount: tag.postsCount,
    rank: tag.rank,
  }
}

export async function unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  const normalized = normalizeParams(params)
  const offset = (normalized.page - 1) * normalized.limit
  const searchAll = normalized.type === "all"
  const shouldFetchItems = (target: UnifiedSearchType) => searchAll || normalized.type === target

  const resolveLimit = (enabled: boolean) => (enabled ? normalized.limit : 1)
  const resolveOffset = (enabled: boolean) => (enabled ? offset : 0)

  const shouldFetchPosts = shouldFetchItems("posts")
  const shouldFetchActivities = shouldFetchItems("activities")
  const shouldFetchUsers = shouldFetchItems("users")
  const shouldFetchTags = shouldFetchItems("tags")

  const [postsResult, activitiesResult, usersResult, tagsResult] = await Promise.all([
    searchPosts({
      query: normalized.query,
      limit: resolveLimit(shouldFetchPosts),
      offset: resolveOffset(shouldFetchPosts),
      sort: normalized.sort,
    }),
    searchActivities({
      query: normalized.query,
      limit: resolveLimit(shouldFetchActivities),
      offset: resolveOffset(shouldFetchActivities),
      sort: normalized.sort,
    }),
    searchUsers({
      query: normalized.query,
      limit: resolveLimit(shouldFetchUsers),
      offset: resolveOffset(shouldFetchUsers),
    }),
    searchTags({
      query: normalized.query,
      limit: resolveLimit(shouldFetchTags),
      offset: resolveOffset(shouldFetchTags),
      sort: normalized.sort,
    }),
  ])

  const postsItems = shouldFetchPosts ? postsResult.items.map(mapPostHit) : []
  const activitiesItems = shouldFetchActivities ? activitiesResult.items.map(mapActivityHit) : []
  const usersItems = shouldFetchUsers
    ? await Promise.all(usersResult.items.map((user) => mapUserHit(user)))
    : []
  const tagsItems = shouldFetchTags ? tagsResult.items.map(mapTagHit) : []

  const buckets = {
    posts: toBucket(
      { total: postsResult.total, items: postsItems },
      normalized.page,
      normalized.limit
    ),
    activities: toBucket(
      { total: activitiesResult.total, items: activitiesItems },
      normalized.page,
      normalized.limit
    ),
    users: toBucket(
      { total: usersResult.total, items: usersItems },
      normalized.page,
      normalized.limit
    ),
    tags: toBucket(
      { total: tagsResult.total, items: tagsItems },
      normalized.page,
      normalized.limit
    ),
  }

  return {
    query: normalized.query,
    type: normalized.type,
    page: normalized.page,
    limit: normalized.limit,
    overallTotal: postsResult.total + activitiesResult.total + usersResult.total + tagsResult.total,
    ...buckets,
  }
}
