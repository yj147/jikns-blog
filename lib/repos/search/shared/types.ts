/**
 * 搜索模块共享类型定义
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

import type { SearchSortOption } from "@/lib/search/search-params"

// ============================================================================
// 文章搜索类型
// ============================================================================

export interface SearchPostsParams {
  query: string
  limit?: number
  offset?: number
  authorId?: string
  tagIds?: string[]
  publishedFrom?: Date
  publishedTo?: Date
  onlyPublished?: boolean
  sort?: SearchSortOption
}

export interface ResolvedSearchPostsParams {
  query: string
  limit: number
  offset: number
  authorId: string
  tagIds: string[]
  publishedFrom: Date | null
  publishedTo: Date | null
  onlyPublished: boolean
  sort: SearchSortOption
}

export interface SearchPostResult {
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
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  tags: Array<{
    id: string
    name: string
    slug: string
    color: string | null
  }>
}

// ============================================================================
// 动态搜索类型
// ============================================================================

export interface SearchActivitiesParams {
  query: string
  limit?: number
  offset?: number
  authorId?: string
  sort?: SearchSortOption
}

export interface ResolvedSearchActivitiesParams {
  query: string
  limit: number
  offset: number
  authorId: string
  sort: SearchSortOption
}

export interface SearchActivityResult {
  id: string
  content: string
  imageUrls: string[] | null
  isPinned: boolean
  likesCount: number
  commentsCount: number
  viewsCount: number
  createdAt: Date
  rank: number
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
    role: string
  }
}

// ============================================================================
// 用户搜索类型
// ============================================================================

export interface SearchUsersParams {
  query: string
  limit?: number
  offset?: number
}

export interface ResolvedSearchUsersParams {
  query: string
  limit: number
  offset: number
}

export interface SearchUserResult {
  id: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  role: string
  similarity: number
}

// ============================================================================
// 标签搜索类型
// ============================================================================

export interface SearchTagsParams {
  query: string
  limit?: number
  offset?: number
}

export interface ResolvedSearchTagsParams {
  query: string
  limit: number
  offset: number
}

export interface SearchTagResult {
  id: string
  name: string
  slug: string
  color: string | null
  description: string | null
  postsCount: number
}

// ============================================================================
// 通用搜索结果类型
// ============================================================================

export interface SearchQueryResult<T> {
  items: T[]
  total: number
}
