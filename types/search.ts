export const UNIFIED_SEARCH_TYPES = ["all", "posts", "activities", "users", "tags"] as const
export type UnifiedSearchType = (typeof UNIFIED_SEARCH_TYPES)[number]

export const UNIFIED_SEARCH_SORTS = ["relevance", "latest"] as const
export type UnifiedSearchSort = (typeof UNIFIED_SEARCH_SORTS)[number]

export interface UnifiedSearchParams {
  query: string
  type?: UnifiedSearchType
  page?: number
  limit?: number
  sort?: UnifiedSearchSort
}

export interface SearchResultBucket<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface UnifiedSearchResult {
  query: string
  type: UnifiedSearchType
  page: number
  limit: number
  overallTotal: number
  posts: SearchResultBucket<SearchPostHit>
  activities: SearchResultBucket<SearchActivityHit>
  users: SearchResultBucket<SearchUserHit>
  tags: SearchResultBucket<SearchTagHit>
}

export interface SearchPostHit {
  id: string
  slug: string
  title: string
  excerpt: string | null
  publishedAt: Date | string | null
  createdAt: Date | string
  coverImage: string | null
  authorId: string
  authorName: string | null
  rank: number
}

export interface SearchActivityHit {
  id: string
  content: string
  imageUrls: string[] | null
  createdAt: Date | string
  authorId: string
  authorName: string | null
  rank: number
}

export interface SearchUserHit {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  bio?: string | null
  rank: number
}

export interface SearchTagHit {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  postsCount: number
  rank: number
}

export class SearchValidationError extends Error {
  details?: Record<string, unknown>

  constructor(message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "SearchValidationError"
    this.details = details
  }
}
