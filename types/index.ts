/**
 * 类型定义统一导出
 * 集中管理所有类型定义的导入和导出
 */

// ============================================================================
// 数据库相关类型
// ============================================================================
export type {
  // 基础数据模型
  User,
  Post,

  // 增强的数据模型类型
  PostWithAuthor,
  PostWithDetails,
  PostWithFullDetails,
  UserWithStats,
  TagWithCount,
  SeriesWithPosts,

  // API 输入类型
  CreatePostInput,
  UpdatePostInput,
  GetPostsParams,

  // API 返回类型
  ApiResult,
  PaginatedResult,

  // 查询构建器类型
  PostWhereInput,
  PostOrderByInput,
  PostInclude,
  PostSelect,
  UserWhereInput,
  UserOrderByInput,
  UserInclude,
  UserSelect,

  // 实用类型
  PostStatus,
  SortOrder,
  PostListItem,
  PostSEOData,

  // Supabase 数据库类型
  Database,

  // 枚举类型
  Role,
  UserStatus,
} from "./database"

// ============================================================================
// API 相关类型
// ============================================================================
export type {
  // 通用 API 响应类型
  ApiResponse,
  ApiError,
  ApiMeta,
  PaginatedApiResponse,
  PaginationMeta,

  // 查询参数类型
  PaginationParams,
  SearchParams,

  // 博客文章 API 类型
  CreatePostRequest,
  UpdatePostRequest,
  PostsSearchParams,
  PostResponse,
  PostListResponse,

  // 用户认证 API 类型
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,

  // 用户资料 API 类型
  UpdateProfileRequest,
  ChangePasswordRequest,
  UserProfileResponse,

  // 评论 API 类型
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentResponse,

  // 文件上传 API 类型
  UploadFileRequest,
  FileUploadResponse,
  UploadProgressEvent,

  // 搜索 API 类型
  SearchRequest,
  SearchResponse,
  SearchFacet,
  TagResponse,

  // 统计 API 类型
  DashboardStatsResponse,
  AnalyticsResponse,

  // WebSocket 消息类型
  WebSocketMessage,
  NotificationMessage,

  // 错误代码和状态码
  ApiErrorCode,
  HttpStatus,

  // API 配置类型
  ApiConfig,
  RequestConfig,
} from "./api"

// ============================================================================
// 评论相关类型
// ============================================================================
export type {
  CommentTargetType,
  CommentAuthor,
  CommentBase,
  CommentCounts,
  CommentStats,
  CommentRelations,
  CommentComputed,
  Comment,
  CommentRealtimePayload,
} from "./comments"

// ============================================================================
// Feed 管理类型
// ============================================================================
export type {
  FeedAuthor,
  FeedItem,
  FeedListResponse,
  FeedActionResult,
  AdminFeedActionInput,
} from "./feed"
export { adminFeedActionSchema } from "./feed"

// ============================================================================
// 组件相关类型
// ============================================================================
export type {
  // 基础组件类型
  BaseComponentProps,
  WithLoadingState,
  WithErrorState,
  WithDisabledState,

  // 按钮组件类型
  ButtonProps,

  // 表单组件类型
  FormFieldProps,
  InputProps,
  TextareaProps,
  SelectOption,
  SelectProps,

  // 数据展示组件类型
  TableColumn,
  TableProps,
  PaginationProps,

  // 卡片和列表组件类型
  CardProps,
  ListItem,
  ListProps,

  // 导航组件类型
  NavigationItem,
  NavigationProps,
  BreadcrumbItem,
  BreadcrumbProps,

  // 反馈组件类型
  AlertProps,
  ToastProps,
  ModalProps,
  ConfirmDialogProps,

  // 布局组件类型
  ContainerProps,
  GridProps,
  FlexProps,

  // 媒体组件类型
  AvatarProps,
  ImageProps,

  // 编辑器组件类型
  MarkdownEditorProps,
  RichTextEditorProps,

  // 搜索组件类型
  SearchBoxProps,

  // 过滤器组件类型
  FilterOption,
  FilterProps,

  // 进度和状态组件类型
  ProgressProps,
  SkeletonProps,
  EmptyStateProps,

  // 组合组件类型
  StatsCardProps,
  TimelineItem,
  TimelineProps,

  // 主题相关类型
  ThemeConfig,
  ThemeProviderProps,

  // 响应式类型
  ResponsiveConfig,
  MediaQuery,
} from "./components"

// ============================================================================
// 错误处理相关类型
// ============================================================================
export type {
  // 错误类型枚举
  ErrorType,
  SecurityErrorType,
  NetworkErrorType,
  BusinessErrorType,

  // 错误接口
  AppError,
  ErrorContext,
  RetryStrategy,
  RecoveryAction,
  ErrorHandlingConfig,
  ErrorHandlingResult,

  // 状态相关
  SecurityState,
  NetworkState,
  ErrorFeedback,
  ErrorAnalytics,
  ErrorToastOptions,
  ErrorBoundaryState,
  SecurityEvent,
  ApiErrorResponse,
} from "./error"

// ============================================================================
// 工具类型
// ============================================================================
export type {
  // 基础工具类型
  MakeOptional,
  MakeRequired,
  DeepPartial,
  DeepRequired,
  Nullable,
  Maybe,
  OptionalValue,
  NonNullable,
  ArrayElement,
  Awaited,
  ReturnType,
  Parameters,

  // 对象工具类型
  Exact,
  Exclude,
  Extract,
  Keys,
  Values,
  ValueOf,
  Immutable,
  Mutable,
  Flatten,

  // 字符串工具类型
  Capitalize,
  Uncapitalize,
  StringLiteral,
  PathString,
  EmailString,
  UrlString,
  HexColor,

  // 数组工具类型
  NonEmptyArray,
  ReadonlyArray,
  Tuple,
  TupleToUnion,
  Length,
  Head,
  Tail,

  // 函数工具类型
  AsyncFunction,
  EventHandler,
  Callback,
  ErrorCallback,
  CallbackWithArgs,
  ConditionalCallback,

  // 条件类型工具
  If,
  Equals,
  IsNever,
  IsAny,
  IsUnknown,
  IsFunction,
  IsObject,
  IsArray,

  // 品牌类型
  Brand,
  UserId,
  PostId,
  Timestamp,
  Email,
  Url,
  JwtToken,
  CsrfToken,

  // 高级工具类型
  DistributiveConditional,
  DeepMerge,
  Enum,
  LiteralUnion,
  KeyPath,
  GetValueByPath,

  // 环境相关类型
  Environment,
  LogLevel,
  ThemeMode,
  LanguageCode,
  TimeZone,
  CurrencyCode,

  // 状态管理相关类型
  LoadingState,
  AsyncState,
  PaginationState,
  SortState,
  FilterState,

  // 时间相关类型
  ISODateString,
  DateFormat,
  RelativeTime,
  TimeUnit,
} from "./utils"

// ============================================================================
// 常用类型别名
// ============================================================================

// ID 类型
export type ID = string | number

// 时间戳类型（避免与 utils.ts 中的 Timestamp 品牌类型冲突）
export type TimestampNumber = number

// 日期字符串类型
export type DateString = string

// URL 类型
export type URLString = string

// JSON 值类型
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

// 颜色类型
export type Color = string

// 尺寸类型
export type Size = "xs" | "sm" | "md" | "lg" | "xl"

// 变体类型
export type Variant = "default" | "primary" | "secondary" | "destructive" | "outline" | "ghost"

// 状态类型
export type Status = "idle" | "loading" | "success" | "error"

// 位置类型
export type Position = "top" | "bottom" | "left" | "right" | "center"

// 对齐类型
export type Alignment = "start" | "center" | "end" | "stretch"

// 方向类型
export type Direction = "horizontal" | "vertical"

// 模式类型
export type Mode = "light" | "dark" | "system"

// 语言类型
export type Language = "en" | "zh-CN" | "zh-TW"

// ============================================================================
// 类型守卫函数
// ============================================================================

// 类型守卫：检查是否为有效的 ID
export const isValidId = (value: unknown): value is ID => {
  return typeof value === "string" || typeof value === "number"
}

// 类型守卫：检查是否为有效的邮箱
export const isValidEmail = (value: string): value is string => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

// 类型守卫：检查是否为有效的 URL
export const isValidUrl = (value: string): value is string => {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

// 类型守卫：检查是否为非空字符串
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0
}

// 类型守卫：检查是否为有效的日期字符串
export const isValidDateString = (value: string): value is string => {
  const date = new Date(value)
  return !isNaN(date.getTime())
}

// 类型守卫：检查是否为有效的 JSON
export const isValidJson = (value: string): value is string => {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

// 类型守卫：检查是否为 API 错误响应
export const isApiErrorResponse = (
  value: unknown
): value is { error: boolean; message: string } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as any).error === "boolean" &&
    (value as any).error === true
  )
}

// ============================================================================
// 类型工具函数
// ============================================================================

// 安全的 JSON 解析
export const safeJsonParse = <T = unknown>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// 安全的数字转换
export const safeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value)
  return isNaN(num) ? fallback : num
}

// 安全的字符串转换
export const safeString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback
}

// 安全的布尔转换
export const safeBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === "boolean" ? value : fallback
}
