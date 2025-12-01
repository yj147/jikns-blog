/**
 * API 响应类型定义
 * 统一的 API 响应格式和错误处理类型
 */

import type { Comment } from "./comments"

// ============================================================================
// 通用 API 响应类型
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  type?: string
  message: string
  details?: Record<string, unknown>
  field?: string // 用于表单验证错误
  timestamp: number
  requestId?: string
  stack?: string // 仅开发环境
}

export interface ApiMeta {
  requestId: string
  timestamp: number
  version?: string
  processingTime?: number // 毫秒
  warnings?: string[] // 警告信息数组
  cached?: boolean
}

// ============================================================================
// 分页响应类型
// ============================================================================

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: PaginationMeta
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  nextCursor?: string
  prevCursor?: string
}

// ============================================================================
// 分页查询参数
// ============================================================================

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
  order?: "asc" | "desc"
  orderBy?: string
}

export interface SearchParams extends PaginationParams {
  q?: string
  filter?: Record<string, unknown>
  include?: string[]
  exclude?: string[]
}

// ============================================================================
// 博客文章 API 类型
// ============================================================================

export interface CreatePostRequest {
  title: string
  content: string
  excerpt?: string
  published?: boolean
  slug?: string
  publishedAt?: string // ISO string
  canonicalUrl?: string
  seoTitle?: string
  seoDescription?: string
  coverImage?: string
  seriesId?: string
  tagNames?: string[]
}

export interface UpdatePostRequest extends Partial<CreatePostRequest> {
  id: string
  slug?: string
}

export interface PostsSearchParams extends SearchParams {
  published?: boolean
  authorId?: string
  seriesId?: string
  tag?: string
  fromDate?: string // ISO string
  toDate?: string // ISO string
}

export interface PostResponse {
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
  viewCount: number
  createdAt: string // ISO string
  updatedAt: string // ISO string
  publishedAt: string | null // ISO string
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
    bio: string | null
  }
  series?: {
    id: string
    title: string
    slug: string
    description: string | null
  }
  tags: Array<{
    id: string
    name: string
    slug: string
    color: string | null
  }>
  stats: {
    commentsCount: number
    likesCount: number
    bookmarksCount: number
  }
}

export interface PostListResponse {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  coverImage: string | null
  viewCount: number
  publishedAt: string | null // ISO string
  createdAt: string // ISO string
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  tags: Array<{
    name: string
    slug: string
    color: string | null
  }>
  stats: {
    commentsCount: number
    likesCount: number
    bookmarksCount: number
  }
}

// ============================================================================
// 用户认证 API 类型
// ============================================================================

export interface LoginRequest {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
    role: "USER" | "ADMIN"
    status: "ACTIVE" | "BANNED"
  }
  accessToken: string
  refreshToken: string
  expiresAt: string // ISO string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirmRequest {
  token: string
  password: string
  confirmPassword: string
}

// ============================================================================
// 用户资料 API 类型
// ============================================================================

export interface UpdateProfileRequest {
  name?: string
  bio?: string
  socialLinks?: Record<string, string>
  avatarUrl?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface UserProfileResponse {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  socialLinks: Record<string, string> | null
  role: "USER" | "ADMIN"
  status: "ACTIVE" | "BANNED"
  createdAt: string // ISO string
  updatedAt: string // ISO string
  lastLoginAt: string | null // ISO string
  stats: {
    postsCount: number
    activitiesCount: number
    commentsCount: number
    likesCount: number
    bookmarksCount: number
    followersCount: number
    followingCount: number
  }
}

// ============================================================================
// 评论 API 类型
// ============================================================================

export interface CreateCommentRequest {
  content: string
  postId?: string
  activityId?: string
  parentId?: string // 用于回复
}

export interface UpdateCommentRequest {
  id: string
  content: string
}

export type CommentResponse = Comment

// ============================================================================
// 文件上传 API 类型
// ============================================================================

export interface UploadFileRequest {
  file: File
  category?: "avatar" | "post-image" | "document"
}

export interface FileUploadResponse {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  uploadedAt: string // ISO string
}

export interface UploadProgressEvent {
  loaded: number
  total: number
  percentage: number
}

// ============================================================================
// 搜索 API 类型
// ============================================================================

export interface SearchRequest extends SearchParams {
  type?: "posts" | "users" | "tags" | "all"
  facets?: string[]
}

export interface SearchResponse {
  query: string
  type: string
  results: {
    posts?: PostListResponse[]
    users?: UserProfileResponse[]
    tags?: TagResponse[]
  }
  facets?: Record<string, SearchFacet[]>
  suggestions?: string[]
  totalResults: number
  processingTime: number
}

export interface SearchFacet {
  value: string
  count: number
  selected?: boolean
}

export interface TagResponse {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  postsCount: number
  createdAt: string // ISO string
}

// ============================================================================
// 统计 API 类型
// ============================================================================

export interface DashboardStatsResponse {
  posts: {
    total: number
    published: number
    drafts: number
    thisMonth: number
  }
  comments: {
    total: number
    thisMonth: number
    pending: number
  }
  users: {
    total: number
    active: number
    thisMonth: number
  }
  views: {
    total: number
    thisMonth: number
    today: number
  }
}

export interface AnalyticsResponse {
  period: {
    start: string // ISO string
    end: string // ISO string
  }
  metrics: {
    pageViews: number
    uniqueVisitors: number
    bounceRate: number
    avgSessionDuration: number
  }
  topPages: Array<{
    path: string
    title?: string
    views: number
    uniqueViews: number
  }>
  topReferrers: Array<{
    source: string
    visits: number
  }>
  devices: Array<{
    type: string
    percentage: number
  }>
  browsers: Array<{
    name: string
    percentage: number
  }>
}

// ============================================================================
// WebSocket 消息类型
// ============================================================================

export interface WebSocketMessage<T = unknown> {
  type: string
  id: string
  data: T
  timestamp: number
}

export interface NotificationMessage {
  id: string
  type: "comment" | "like" | "follow" | "mention" | "system"
  title: string
  message: string
  read: boolean
  actionUrl?: string
  createdAt: string // ISO string
  user?: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
}

// ============================================================================
// 错误代码枚举
// ============================================================================

export enum ApiErrorCode {
  // 认证错误
  AUTH_REQUIRED = "AUTH_REQUIRED",
  AUTH_INVALID = "AUTH_INVALID",
  AUTH_EXPIRED = "AUTH_EXPIRED",
  AUTH_INSUFFICIENT_PERMISSIONS = "AUTH_INSUFFICIENT_PERMISSIONS",

  // 验证错误
  VALIDATION_FAILED = "VALIDATION_FAILED",
  VALIDATION_REQUIRED = "VALIDATION_REQUIRED",
  VALIDATION_FORMAT = "VALIDATION_FORMAT",
  VALIDATION_LENGTH = "VALIDATION_LENGTH",

  // 资源错误
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  RESOURCE_FORBIDDEN = "RESOURCE_FORBIDDEN",

  // 业务错误
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",
  OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",

  // 系统错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
}

// ============================================================================
// HTTP 状态码映射
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS]

// ============================================================================
// API 配置类型
// ============================================================================

export interface ApiConfig {
  baseUrl: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  headers?: Record<string, string>
}

export interface RequestConfig {
  url: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  data?: unknown
  params?: Record<string, unknown>
  headers?: Record<string, string>
  timeout?: number
  retryAttempts?: number
}
