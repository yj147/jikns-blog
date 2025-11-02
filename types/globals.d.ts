/**
 * 全局类型扩展和环境声明
 */

// ============================================================================
// DOM 和浏览器 API 扩展
// ============================================================================

declare global {
  // Navigator API 扩展 - 网络连接信息
  interface Navigator {
    connection?: {
      effectiveType: "2g" | "3g" | "4g" | "slow-2g"
      downlink: number
      rtt: number
      saveData?: boolean
    }
    // 设备内存信息
    deviceMemory?: number
    // 硬件并发数
    hardwareConcurrency?: number
  }

  // Window 对象扩展
  interface Window {
    // 主题切换回调
    __theme?: "light" | "dark" | "system"
    __onThemeChange?: (theme: string) => void

    // 性能监控
    __performance_observer?: PerformanceObserver

    // 错误跟踪
    __error_boundary?: {
      captureError: (error: Error, errorInfo: any) => void
      reportError: (error: Error, context: any) => void
    }

    // 开发模式标识
    __DEV__?: boolean

    // 构建信息
    __BUILD_INFO__?: {
      version: string
      commit: string
      buildTime: string
      environment: "development" | "production" | "test"
    }
  }

  // CSS 自定义属性扩展
  interface CSSStyleDeclaration {
    // CSS 变量访问
    getPropertyValue(property: `--${string}`): string
    setProperty(property: `--${string}`, value: string, priority?: string): void
    removeProperty(property: `--${string}`): string
  }

  // 环境变量类型扩展
  namespace NodeJS {
    interface ProcessEnv {
      // Next.js 环境变量
      NODE_ENV: "development" | "production" | "test"

      // Supabase 配置
      NEXT_PUBLIC_SUPABASE_URL: string
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_ROLE_KEY: string

      // 数据库配置
      DATABASE_URL: string
      DIRECT_URL?: string

      // 认证配置
      NEXTAUTH_SECRET: string
      NEXTAUTH_URL: string

      // GitHub OAuth
      GITHUB_CLIENT_ID: string
      GITHUB_CLIENT_SECRET: string

      // 邮件服务配置
      EMAIL_FROM?: string
      EMAIL_SERVER_USER?: string
      EMAIL_SERVER_PASSWORD?: string
      EMAIL_SERVER_HOST?: string
      EMAIL_SERVER_PORT?: string

      // 分析和监控
      GOOGLE_ANALYTICS_ID?: string
      SENTRY_DSN?: string

      // 上传服务
      CLOUDINARY_CLOUD_NAME?: string
      CLOUDINARY_API_KEY?: string
      CLOUDINARY_API_SECRET?: string

      // Redis 缓存
      REDIS_URL?: string

      // 其他配置
      SITE_URL?: string
      SITE_NAME?: string
      ADMIN_EMAIL?: string
    }
  }
}

// ============================================================================
// 模块声明
// ============================================================================

// 图片文件类型声明
declare module "*.png" {
  const content: string
  export default content
}

declare module "*.jpg" {
  const content: string
  export default content
}

declare module "*.jpeg" {
  const content: string
  export default content
}

declare module "*.gif" {
  const content: string
  export default content
}

declare module "*.webp" {
  const content: string
  export default content
}

declare module "*.svg" {
  import { ComponentType, SVGProps } from "react"
  const content: ComponentType<SVGProps<SVGElement>>
  export default content
}

declare module "*.ico" {
  const content: string
  export default content
}

// 样式文件类型声明
declare module "*.css" {
  const content: Record<string, string>
  export default content
}

declare module "*.scss" {
  const content: Record<string, string>
  export default content
}

declare module "*.sass" {
  const content: Record<string, string>
  export default content
}

declare module "*.less" {
  const content: Record<string, string>
  export default content
}

// 文档文件类型声明
declare module "*.md" {
  const content: string
  export default content
}

declare module "*.mdx" {
  import { ComponentType } from "react"
  const content: ComponentType
  export default content
}

// 音频/视频文件类型声明
declare module "*.mp3" {
  const content: string
  export default content
}

declare module "*.mp4" {
  const content: string
  export default content
}

declare module "*.webm" {
  const content: string
  export default content
}

// JSON 文件类型声明
declare module "*.json" {
  const content: Record<string, any>
  export default content
}

// ============================================================================
// React 类型扩展
// ============================================================================

declare module "react" {
  // 自定义 Hook 类型
  interface FunctionComponent<P = {}> {
    displayName?: string
    defaultProps?: Partial<P>
  }

  // 组件 Props 扩展
  interface HTMLAttributes<T> {
    // 数据属性
    [key: `data-${string}`]: string | number | boolean | undefined

    // ARIA 属性扩展
    "aria-label"?: string
    "aria-describedby"?: string
    "aria-expanded"?: boolean
    "aria-hidden"?: boolean
    "aria-selected"?: boolean
    "aria-checked"?: boolean
    "aria-disabled"?: boolean
    "aria-required"?: boolean
    "aria-invalid"?: boolean
    "aria-live"?: "off" | "polite" | "assertive"
    "aria-atomic"?: boolean
    "aria-relevant"?: string
    "aria-busy"?: boolean
  }

  // CSS Properties 扩展
  interface CSSProperties {
    // CSS 变量
    [key: `--${string}`]: string | number | undefined

    // CSS Grid 属性
    gridTemplateAreas?: string
    gridArea?: string

    // CSS Container Queries
    containerType?: "normal" | "size" | "inline-size"
    containerName?: string

    // CSS Scroll Snap
    scrollSnapType?: string
    scrollSnapAlign?: string

    // Webkit 特定属性
    WebkitLineClamp?: number
    WebkitBoxOrient?: "horizontal" | "vertical"
    WebkitBoxDirection?: "normal" | "reverse"
    WebkitBoxPack?: "start" | "end" | "center" | "justify"
    WebkitBoxAlign?: "start" | "end" | "center" | "baseline" | "stretch"
  }
}

// ============================================================================
// 第三方库类型扩展
// ============================================================================

// Next.js 路由器扩展
declare module "next/router" {
  interface NextRouter {
    // 自定义路由状态
    isPreview?: boolean
    locale?: string
    locales?: string[]
    defaultLocale?: string
  }
}

// Next.js 应用扩展
declare module "next/app" {
  interface AppProps {
    // 自定义 App Props
    emotionCache?: any
    pageProps: Record<string, any> & {
      initialData?: any
      error?: any
    }
  }
}

// ============================================================================
// 工具类型
// ============================================================================

// 严格的对象类型，不允许额外属性
type StrictObject<T> = T & Record<never, never>

// 可选链安全类型
type SafeAccess<T, K extends keyof T> = T extends null | undefined ? undefined : T[K]

// 深度只读类型
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// 品牌类型助手
type Brand<K, T> = K & { __brand: T }

// ============================================================================
// 应用特定的全局类型
// ============================================================================

// 用户角色枚举
type UserRole = "USER" | "ADMIN"

// 用户状态枚举
type UserStatus = "ACTIVE" | "BANNED" | "PENDING"

// 博客文章状态
type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"

// 评论状态
type CommentStatus = "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN"

// 通知类型
type NotificationType = "comment" | "like" | "follow" | "mention" | "system" | "security"

// API 错误代码
type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"

// 排序方向
type SortOrder = "asc" | "desc"

// 主题模式
type ThemeMode = "light" | "dark" | "system"

// 语言代码
type LanguageCode = "en" | "zh-CN" | "zh-TW" | "ja" | "ko"

export {}
