import { z } from "zod"
import type { SWRInfiniteKeyedMutator } from "swr/infinite"
import { UserStatus, Role } from "@/lib/generated/prisma"

const httpsImageUrlSchema = z
  .string()
  .trim()
  .url("图片URL格式无效")
  .refine((value) => {
    try {
      const url = new URL(value)
      const { protocol, hostname } = url

      const isLocalhost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.endsWith(".local")

      if (isLocalhost) {
        return protocol === "http:" || protocol === "https:"
      }

      return protocol === "https:"
    } catch {
      return false
    }
  }, "图片URL必须使用HTTPS地址（本地开发环境除外）")

/**
 * Activity 模块类型定义
 * 包含数据验证 schema 和 TypeScript 类型
 */

// 动态创建数据验证 schema
export const activityCreateSchema = z.object({
  content: z.string().min(1, "动态内容不能为空").max(5000, "动态内容最多5000个字符"),
  imageUrls: z.array(httpsImageUrlSchema).max(9, "最多上传9张图片").optional(),
  isPinned: z.boolean().optional().default(false),
})

// 动态更新数据验证 schema
export const activityUpdateSchema = z.object({
  content: z.string().min(1, "动态内容不能为空").max(5000, "动态内容最多5000个字符").optional(),
  imageUrls: z.array(httpsImageUrlSchema).max(9, "最多上传9张图片").optional(),
  isPinned: z.boolean().optional(),
})

// 动态查询参数验证 schema
export const activityQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    orderBy: z.enum(["latest", "trending", "following"]).default("latest"),
    authorId: z.string().uuid().optional(),
    cursor: z.string().min(1).optional(),
    isPinned: z.coerce.boolean().optional(),
    hasImages: z.coerce.boolean().optional(),
    q: z
      .string()
      .trim()
      .min(2, "搜索关键词至少需要2个字符")
      .max(64, "搜索关键词长度不得超过64个字符")
      .optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    tags: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.cursor && value.page > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["page"],
        message: "游标分页模式下无需指定 page 参数",
      })
    }

    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "开始时间不能晚于结束时间",
      })
    }
  })

// TypeScript 类型定义
export type ActivityCreateData = z.infer<typeof activityCreateSchema>
export type ActivityUpdateData = z.infer<typeof activityUpdateSchema>
export type ActivityQueryParams = z.infer<typeof activityQuerySchema>

// 数据库模型对应的 TypeScript 接口
export interface Activity {
  id: string
  content: string
  imageUrls: string[]
  isPinned: boolean
  likesCount: number
  commentsCount: number
  viewsCount: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  authorId: string
}

// 说明：显示名回退逻辑在 API 层实现——优先使用 name，其次使用 `用户${id.substring(0, 6)}`
export interface ActivityAuthor {
  id: string
  name: string | null
  avatarUrl: string | null
  role: "USER" | "ADMIN"
  status?: UserStatus
}

// 扩展的动态接口（包含关联数据）
export interface ActivityWithAuthor extends Activity {
  author: ActivityAuthor
  isLiked?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

// 权限检查专用类型：必须包含 author 的完整数据（包括 status）
export interface ActivityWithAuthorForPermission {
  id: string
  authorId: string
  deletedAt: Date | null
  isPinned: boolean
  author: {
    id: string
    status: UserStatus
    role: Role
  }
}

// 动态列表响应接口
export interface ActivityListResponse {
  activities: ActivityWithAuthor[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
    nextCursor?: string | null
  }
}

// 动态统计接口
export interface ActivityStats {
  total: number
  todayCount: number
  weekCount: number
  monthCount: number
}

// 排序选项枚举
export enum ActivityOrderBy {
  LATEST = "latest",
  TRENDING = "trending",
  FOLLOWING = "following",
}

// 动态操作类型枚举
export enum ActivityAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  PIN = "pin",
  UNPIN = "unpin",
  LIKE = "like",
  UNLIKE = "unlike",
}

// 图片上传相关类型
export interface ImageUploadConfig {
  maxFiles: number
  maxSizePerFile: number
  maxTotalSize: number
  allowedTypes: string[]
  bucketName: string
}

export interface UploadResult {
  success: boolean
  url?: string
  path?: string
  index: number
  fileName: string
  size?: number
  error?: string
}

export interface BatchUploadResponse {
  uploaded: number
  total: number
  urls: string[]
  details: Array<{
    url: string
    fileName: string
    size: number
    index: number
  }>
  failed?: Array<{
    index: number
    fileName: string
    error: string
  }>
}

export interface ActivityLikeState {
  isLiked: boolean
  count: number
}

// 前端组件 Props 类型
export interface ActivityCardProps {
  activity: ActivityWithAuthor
  onLike?: (activityId: string, nextState?: ActivityLikeState) => void
  onComment?: (activityId: string) => void
  onShare?: (activityId: string) => void
  onEdit?: (activity: ActivityWithAuthor) => void
  onDelete?: (activity: ActivityWithAuthor) => void
  showActions?: boolean
  compact?: boolean
  priority?: boolean
}

export interface ActivityComposerProps {
  onSuccess?: (activity: ActivityWithAuthor) => void
  onError?: (error: Error) => void
  initialContent?: string
  maxImages?: number
  placeholder?: string
  showPinOption?: boolean
}

export interface ActivityFeedProps {
  userId?: string
  orderBy?: ActivityOrderBy
  showComposer?: boolean
  limit?: number
  onActivityUpdate?: (activity: ActivityWithAuthor) => void
}

// 错误处理类型
export interface ActivityError {
  code: string
  message: string
  field?: string
  details?: any
}

// API 响应类型
export interface ActivityApiResponse<T = ActivityWithAuthor | ActivityWithAuthor[]> {
  success: boolean
  data?: T
  error?: ActivityError
  meta?: {
    timestamp: string
    pagination?: {
      page: number
      limit: number
      total: number
      hasMore: boolean
      nextCursor?: string | null
    }
    filters?: {
      searchTerm?: string
      tags?: string[]
      authorId?: string
      publishedFrom?: string
      publishedTo?: string
    }
  }
}

// Hook 状态类型
export interface UseActivitiesState {
  activities: ActivityWithAuthor[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  hasMore: boolean
  total: number | null
  appliedFilters: {
    searchTerm?: string
    tags?: string[]
    authorId?: string
    publishedFrom?: string
    publishedTo?: string
  } | null
  loadMore: () => void
  refresh: () => void
  mutate: SWRInfiniteKeyedMutator<ActivityApiResponse<ActivityWithAuthor[]>[]>
}

export interface UseActivityMutationsState {
  createActivity: (data: ActivityCreateData) => Promise<ActivityWithAuthor>
  updateActivity: (id: string, data: ActivityUpdateData) => Promise<ActivityWithAuthor>
  deleteActivity: (id: string) => Promise<void>
  isLoading: boolean
  error: Error | null
}

// 表单状态类型
export interface ActivityFormState {
  content: string
  images: string[]
  isPinned: boolean
  isSubmitting: boolean
  errors: Record<string, string>
}

// 过滤器类型
export interface ActivityFilters {
  orderBy: ActivityOrderBy
  authorId?: string
  dateRange?: {
    start?: Date
    end?: Date
  }
  tags?: string[]
  hasImages?: boolean
  isPinned?: boolean
  searchTerm?: string
}

// 无限滚动配置类型
export interface InfiniteScrollConfig {
  threshold?: number
  rootMargin?: string
  enabled?: boolean
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
}

// 缓存键类型
export type ActivityCacheKey =
  | string
  | ["activities", ActivityQueryParams]
  | ["activity", string]
  | ["user-activities", string, ActivityQueryParams]

// 乐观UI更新类型
export interface OptimisticActivity
  extends Omit<ActivityWithAuthor, "id" | "createdAt" | "updatedAt"> {
  id: string // 临时ID，如 "temp-123456789"
  createdAt: string
  updatedAt: string
  isPending?: boolean // 标记为待确认状态
}
