/**
 * 博客相关类型定义 - Phase 5.2
 * 前后端数据连接的类型安全保证
 */

export interface PostAuthor {
  id: string
  name: string | null
  avatarUrl: string | null
  bio?: string | null
}

export interface PostSeries {
  id: string
  title: string
  slug: string
  description: string | null
}

export interface PostTag {
  id: string
  name: string
  slug: string
  color: string | null
}

export interface PostStats {
  commentsCount: number
  likesCount: number
  bookmarksCount: number
}

// 文章列表项类型（用于博客首页）
export interface PostListItem {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  coverImage: string | null
  signedCoverImage?: string | null
  viewCount: number
  publishedAt: string | null
  createdAt: string
  author: PostAuthor
  tags: PostTag[]
  stats: PostStats
  contentLength: number // 内容长度（用于计算阅读时间）
}

// 完整文章类型（用于文章详情页）
export interface PostDetail {
  id: string
  slug: string
  title: string
  content: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  canonicalUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  coverImage: string | null
  signedCoverImage?: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  contentSigned?: string | null
  author: PostAuthor
  series?: PostSeries
  tags: PostTag[]
  stats: PostStats
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    timestamp: number
  }
  meta?: {
    requestId: string
    timestamp: number
  }
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta
}

// 搜索参数类型
export interface PostSearchParams {
  page?: number
  limit?: number
  q?: string
  published?: boolean
  authorId?: string
  seriesId?: string
  tag?: string
  fromDate?: string
  toDate?: string
  orderBy?: string
  order?: "asc" | "desc"
}

// Next.js 页面参数类型
export interface BlogPageSearchParams {
  page?: string
  q?: string
  tag?: string
  sort?: string
  author?: string
}

// 组件Props类型
export interface BlogPostCardProps {
  post: PostListItem
}

export interface BlogSearchFilterProps {
  onSearch: (query: string) => void
  onTagFilter: (tag: string) => void
  onSortChange: (sort: string) => void
  currentQuery: string
  currentTag: string
  currentSort: string
}

export interface BlogPaginationProps {
  pagination: PaginationMeta
  onPageChange: (page: number) => void
}
