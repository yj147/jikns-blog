import { calculateReadingMinutes } from "./reading-time"

/**
 * 博客相关工具函数 - Phase 5.2
 * 日期格式化、URL生成、内容处理等辅助函数
 */

/**
 * 格式化日期为中文格式
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "未知日期"

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(dateString))
  } catch {
    return "日期格式错误"
  }
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "未知时间"

  try {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes <= 1 ? "刚刚" : `${diffMinutes}分钟前`
      }
      return `${diffHours}小时前`
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else if (diffDays < 30) {
      const diffWeeks = Math.floor(diffDays / 7)
      return `${diffWeeks}周前`
    } else {
      return formatDate(dateString)
    }
  } catch {
    return "时间格式错误"
  }
}

/**
 * 计算阅读时间（基于中文阅读速度）
 * @param contentOrLength 文章内容字符串 或 内容长度数字
 */
export function calculateReadTime(contentOrLength: string | number | null): string {
  const minutes = calculateReadingMinutes(contentOrLength)

  if (minutes <= 1) {
    return "1分钟阅读"
  }

  if (minutes < 60) {
    return `${minutes}分钟阅读`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}小时${remainingMinutes}分钟阅读`
}

/**
 * 生成博客文章URL
 */
export function createBlogUrl(slug: string, query?: Record<string, string>): string {
  const baseUrl = `/blog/${slug}`
  if (!query || Object.keys(query).length === 0) {
    return baseUrl
  }

  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })

  return `${baseUrl}?${params.toString()}`
}

/**
 * 生成博客列表URL
 */
export function createBlogListUrl(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value))
    }
  })

  const queryString = params.toString()
  return queryString ? `/blog?${queryString}` : "/blog"
}

/**
 * 提取摘要（如果没有摘要，从内容中生成）
 */
export function extractExcerpt(content: string, excerptLength: number = 150): string {
  if (!content) return ""

  // 移除Markdown语法
  const plainText = content
    .replace(/#{1,6}\s+/g, "") // 移除标题
    .replace(/\*\*(.*?)\*\*/g, "$1") // 移除粗体
    .replace(/\*(.*?)\*/g, "$1") // 移除斜体
    .replace(/`(.*?)`/g, "$1") // 移除内联代码
    .replace(/```[\s\S]*?```/g, "") // 移除代码块
    .replace(/!\[.*?\]\(.*?\)/g, "") // 移除图片
    .replace(/\[.*?\]\(.*?\)/g, "$1") // 移除链接，保留文本
    .replace(/\n+/g, " ") // 替换换行为空格
    .trim()

  return plainText.length > excerptLength
    ? `${plainText.substring(0, excerptLength)}...`
    : plainText
}

/**
 * 格式化数字（浏览量、点赞数等）
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * 生成随机颜色（用于标签等）
 */
export function generateTagColor(tagName: string): string {
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-yellow-100 text-yellow-800",
    "bg-indigo-100 text-indigo-800",
    "bg-red-100 text-red-800",
    "bg-orange-100 text-orange-800",
  ]

  // 基于标签名生成一致的颜色
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

/**
 * 验证是否为有效的搜索查询
 */
export function isValidSearchQuery(query: string): boolean {
  if (!query || query.trim().length === 0) return false
  if (query.trim().length > 100) return false

  // 检查是否包含恶意内容
  const maliciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i]
  return !maliciousPatterns.some((pattern) => pattern.test(query))
}

/**
 * 清理搜索查询
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, "") // 移除HTML标签字符
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, "") // 只保留字母、数字、空格、中文和连字符
    .substring(0, 100) // 限制长度
}

/**
 * 解析搜索参数
 */
export function parseSearchParams(searchParams: URLSearchParams) {
  return {
    page: parseInt(searchParams.get("page") || "1", 10),
    q: sanitizeSearchQuery(searchParams.get("q") || ""),
    tag: searchParams.get("tag") || "",
    sort: searchParams.get("sort") || "publishedAt",
    author: searchParams.get("author") || "",
  }
}

/**
 * 生成SEO友好的页面标题
 */
export function generatePageTitle(
  baseTitle: string,
  query?: string,
  tag?: string,
  page?: number
): string {
  let title = baseTitle

  if (query) {
    title = `"${query}" 搜索结果 - ${title}`
  }

  if (tag) {
    title = `${tag} 标签文章 - ${title}`
  }

  if (page && page > 1) {
    title = `${title} - 第${page}页`
  }

  return title
}

/**
 * 生成SEO描述
 */
export function generatePageDescription(query?: string, tag?: string, postsCount?: number): string {
  if (query) {
    return `找到 ${postsCount || 0} 篇关于"${query}"的文章，探索更多精彩内容。`
  }

  if (tag) {
    return `浏览 ${postsCount || 0} 篇关于"${tag}"的文章，深入了解相关话题。`
  }

  return "探索技术前沿，分享深度思考，与你一起成长。发现优质的技术文章和深度见解。"
}
