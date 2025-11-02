/**
 * 工具函数库统一导出
 * 提供模块化的工具函数访问接口
 */

// 重新导出原有的 cn 函数
export { cn } from "../utils"

// 分页相关工具
export {
  type CursorPaginationOptions,
  type OffsetPaginationOptions,
  type PaginationResult,
  type CursorPaginationResult,
  type OffsetPaginationResult,
  createCursorPagination,
  createOffsetPagination,
  calculateOffset,
  calculateTotalPages,
  generateCursor,
  parseCursor,
  createPaginationMeta,
  createCursorPaginationMeta,
  validatePaginationOptions,
  validateCursorPaginationOptions,
} from "./pagination"

// Slug 生成工具
export {
  type SlugOptions,
  createSlug,
  createUniqueSlug,
  slugToTitle,
  validateSlug,
  createUniqueSlugs,
} from "./slug"

// 日期格式化工具
export {
  type DateFormatOptions,
  getCurrentDateTime,
  isValidDate,
  parseDate,
  formatDateChinese,
  formatRelativeTime,
  getFriendlyTimeDescription,
  formatDateRange,
  getChineseMonthName,
  getChineseWeekdayName,
  calculateAge,
  isToday,
  isYesterday,
  isThisWeek,
  getTimestamp,
  fromTimestamp,
  formatDuration,
} from "./date"

// 内容清洗工具
export {
  type ContentSanitizeOptions,
  type TextProcessingOptions,
  sanitizeHtml,
  sanitizeText,
  processText,
  decodeHtmlEntities,
  encodeHtmlEntities,
  truncateHtml,
  extractTextFromHtml,
  validateContentSecurity,
  generateExcerpt,
  estimateReadingTime,
  detectContentLanguage,
} from "./content"

// API 错误处理工具
export {
  ApiErrorType,
  ErrorSeverity,
  type ApiError,
  type ValidationError,
  type ApiResponse,
  type ErrorMetrics,
  createApiError,
  createValidationError,
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  nextApiErrorResponse,
  nextApiSuccessResponse,
  nextApiValidationErrorResponse,
  handleUnknownError,
  isApiError,
  generateRequestId,
  logError,
  recordErrorMetric,
  getErrorMetrics,
} from "./api-errors"

/**
 * 通用工具函数
 */

/**
 * 延迟执行函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxAttempts) {
        throw lastError
      }

      await delay(delayMs * attempt) // 指数退避
    }
  }

  throw lastError!
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

/**
 * 安全的 JSON 字符串化
 */
export function safeJsonStringify(obj: any, space?: number): string {
  try {
    return JSON.stringify(obj, null, space)
  } catch {
    return "{}"
  }
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T
  }

  if (typeof obj === "object") {
    const cloned = {} as { [key: string]: any }
    Object.keys(obj).forEach((key) => {
      cloned[key] = deepClone((obj as { [key: string]: any })[key])
    })
    return cloned as T
  }

  return obj
}

/**
 * 检查对象是否为空
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) {
    return true
  }

  if (typeof obj === "string" || Array.isArray(obj)) {
    return obj.length === 0
  }

  if (typeof obj === "object") {
    return Object.keys(obj).length === 0
  }

  return false
}

/**
 * 获取嵌套对象属性值
 */
export function getNestedValue(obj: Record<string, any>, path: string, defaultValue?: any): any {
  const keys = path.split(".")
  let result = obj

  for (const key of keys) {
    if (result === null || result === undefined || !(key in result)) {
      return defaultValue
    }
    result = result[key]
  }

  return result
}

/**
 * 设置嵌套对象属性值
 */
export function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split(".")
  const lastKey = keys.pop()!
  let current = obj

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {}
    }
    current = current[key]
  }

  current[lastKey] = value
}

/**
 * 数组去重
 */
export function unique<T>(array: T[], key?: keyof T): T[] {
  if (!key) {
    return [...new Set(array)]
  }

  const seen = new Set()
  return array.filter((item) => {
    const value = item[key]
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

/**
 * 数组分组
 */
export function groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const group = String(item[key])
      groups[group] = groups[group] || []
      groups[group].push(item)
      return groups
    },
    {} as Record<string, T[]>
  )
}

/**
 * 数组分块
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * 生成随机字符串
 */
export function generateRandomString(
  length: number = 8,
  charset: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
): string {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return result
}

/**
 * 生成 UUID v4
 */
export function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 格式化数字（添加千分位分隔符）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN")
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 高亮搜索关键词
 */
export function highlightSearchKeywords(
  text: string,
  keywords: string[],
  className: string = "highlight"
): string {
  if (!keywords.length) {
    return text
  }

  const pattern = keywords
    .filter((keyword) => keyword.trim())
    .map((keyword) => escapeRegex(keyword.trim()))
    .join("|")

  if (!pattern) {
    return text
  }

  const regex = new RegExp(`(${pattern})`, "gi")
  return text.replace(regex, `<mark class="${className}">$1</mark>`)
}
