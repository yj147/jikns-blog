/**
 * 日期格式化工具函数
 * 支持中文友好的日期显示和国际化
 */

export interface DateFormatOptions {
  locale?: string
  timezone?: string
  format?: "full" | "long" | "medium" | "short" | "relative" | "iso"
  includeTime?: boolean
  use24Hour?: boolean
}

/**
 * 中文数字映射
 */
const chineseNumbers = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
const chineseMonths = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
]
const chineseWeekdays = ["日", "一", "二", "三", "四", "五", "六"]
const chineseWeekdaysFull = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]

/**
 * 获取当前时区的日期时间
 */
export function getCurrentDateTime(timezone?: string): Date {
  const now = new Date()

  if (timezone) {
    // 转换到指定时区
    return new Date(now.toLocaleString("en-US", { timeZone: timezone }))
  }

  return now
}

/**
 * 检查日期是否有效
 */
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * 安全地解析日期
 */
export function parseDate(input: string | number | Date): Date | null {
  if (!input) return null

  const date = new Date(input)
  return isValidDate(date) ? date : null
}

/**
 * 格式化日期为中文友好格式
 */
export function formatDateChinese(
  date: Date | string | number,
  options: DateFormatOptions = {}
): string {
  const parsedDate = typeof date === "string" || typeof date === "number" ? parseDate(date) : date

  if (!isValidDate(parsedDate)) {
    return "无效日期"
  }

  const {
    format = "medium",
    includeTime = false,
    use24Hour = true,
    timezone = "Asia/Shanghai",
  } = options

  // 转换到指定时区
  const localDate = timezone
    ? new Date(parsedDate.toLocaleString("en-US", { timeZone: timezone }))
    : parsedDate

  const year = localDate.getFullYear()
  const month = localDate.getMonth() + 1
  const day = localDate.getDate()
  const weekday = localDate.getDay()
  const hours = localDate.getHours()
  const minutes = localDate.getMinutes()
  const seconds = localDate.getSeconds()

  switch (format) {
    case "full":
      const fullResult = `${year}年${month}月${day}日 ${chineseWeekdaysFull[weekday]}`
      return includeTime
        ? `${fullResult} ${formatTime(hours, minutes, seconds, use24Hour)}`
        : fullResult

    case "long":
      const longResult = `${year}年${month}月${day}日`
      return includeTime
        ? `${longResult} ${formatTime(hours, minutes, seconds, use24Hour)}`
        : longResult

    case "medium":
      const mediumResult = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
      return includeTime
        ? `${mediumResult} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
        : mediumResult

    case "short":
      const shortResult = `${month}/${day}`
      return includeTime
        ? `${shortResult} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
        : shortResult

    case "relative":
      return formatRelativeTime(localDate)

    case "iso":
      return parsedDate.toISOString()

    default:
      return localDate.toLocaleDateString("zh-CN")
  }
}

/**
 * 格式化时间部分
 */
function formatTime(hours: number, minutes: number, seconds: number, use24Hour: boolean): string {
  if (use24Hour) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  } else {
    const period = hours >= 12 ? "下午" : "上午"
    const displayHours = hours % 12 || 12
    return `${period} ${displayHours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
}

/**
 * 格式化相对时间（中文友好）
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date = new Date()
): string {
  const targetDate = typeof date === "string" || typeof date === "number" ? parseDate(date) : date

  if (!isValidDate(targetDate)) {
    return "无效日期"
  }

  const diffMs = baseDate.getTime() - targetDate.getTime()
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  const isFuture = diffMs < 0
  const suffix = isFuture ? "后" : "前"

  // 刚刚
  if (diffSeconds < 30) {
    return "刚刚"
  }

  // 秒
  if (diffSeconds < 60) {
    return `${diffSeconds}秒${suffix}`
  }

  // 分钟
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟${suffix}`
  }

  // 小时
  if (diffHours < 24) {
    return `${diffHours}小时${suffix}`
  }

  // 天
  if (diffDays < 7) {
    return `${diffDays}天${suffix}`
  }

  // 周
  if (diffWeeks < 4) {
    return `${diffWeeks}周${suffix}`
  }

  // 月
  if (diffMonths < 12) {
    return `${diffMonths}个月${suffix}`
  }

  // 年
  return `${diffYears}年${suffix}`
}

/**
 * 获取友好的时间描述
 */
export function getFriendlyTimeDescription(date: Date | string | number): string {
  const targetDate = typeof date === "string" || typeof date === "number" ? parseDate(date) : date

  if (!isValidDate(targetDate)) {
    return "未知时间"
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const targetDateOnly = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  )

  const hours = targetDate.getHours()
  const minutes = targetDate.getMinutes()
  const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`

  if (targetDateOnly.getTime() === today.getTime()) {
    return `今天 ${timeStr}`
  } else if (targetDateOnly.getTime() === yesterday.getTime()) {
    return `昨天 ${timeStr}`
  } else if (now.getTime() - targetDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return `${chineseWeekdaysFull[targetDate.getDay()]} ${timeStr}`
  } else if (now.getFullYear() === targetDate.getFullYear()) {
    return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
  } else {
    return `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
  }
}

/**
 * 获取日期范围的中文描述
 */
export function formatDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number,
  options: DateFormatOptions = {}
): string {
  const start =
    typeof startDate === "string" || typeof startDate === "number"
      ? parseDate(startDate)
      : startDate
  const end =
    typeof endDate === "string" || typeof endDate === "number" ? parseDate(endDate) : endDate

  if (!isValidDate(start) || !isValidDate(end)) {
    return "无效日期范围"
  }

  const startFormatted = formatDateChinese(start, options)
  const endFormatted = formatDateChinese(end, options)

  return `${startFormatted} 至 ${endFormatted}`
}

/**
 * 获取月份的中文名称
 */
export function getChineseMonthName(monthIndex: number): string {
  if (monthIndex < 0 || monthIndex > 11) {
    return "无效月份"
  }
  return chineseMonths[monthIndex]
}

/**
 * 获取星期的中文名称
 */
export function getChineseWeekdayName(weekdayIndex: number, full: boolean = false): string {
  if (weekdayIndex < 0 || weekdayIndex > 6) {
    return "无效星期"
  }
  return full ? chineseWeekdaysFull[weekdayIndex] : `星期${chineseWeekdays[weekdayIndex]}`
}

/**
 * 计算年龄
 */
export function calculateAge(birthDate: Date | string | number): number {
  const birth =
    typeof birthDate === "string" || typeof birthDate === "number"
      ? parseDate(birthDate)
      : birthDate

  if (!isValidDate(birth)) {
    return 0
  }

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return Math.max(0, age)
}

/**
 * 检查是否是今天
 */
export function isToday(date: Date | string | number): boolean {
  const targetDate = typeof date === "string" || typeof date === "number" ? parseDate(date) : date

  if (!isValidDate(targetDate)) {
    return false
  }

  const today = new Date()
  return (
    targetDate.getDate() === today.getDate() &&
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getFullYear() === today.getFullYear()
  )
}

/**
 * 检查是否是昨天
 */
export function isYesterday(date: Date | string | number): boolean {
  const targetDate = typeof date === "string" || typeof date === "number" ? parseDate(date) : date

  if (!isValidDate(targetDate)) {
    return false
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return (
    targetDate.getDate() === yesterday.getDate() &&
    targetDate.getMonth() === yesterday.getMonth() &&
    targetDate.getFullYear() === yesterday.getFullYear()
  )
}

/**
 * 检查是否是本周
 */
export function isThisWeek(date: Date | string | number): boolean {
  const targetDate = typeof date === "string" || typeof date === "number" ? parseDate(date) : date

  if (!isValidDate(targetDate)) {
    return false
  }

  const today = new Date()
  const weekStart = new Date(today)
  const dayOfWeek = today.getDay()
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // 周一开始
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return targetDate >= weekStart && targetDate <= weekEnd
}

/**
 * 获取时间戳（秒）
 */
export function getTimestamp(date?: Date | string | number): number {
  const targetDate = date
    ? typeof date === "string" || typeof date === "number"
      ? parseDate(date)
      : date
    : new Date()

  if (!isValidDate(targetDate)) {
    return 0
  }

  return Math.floor(targetDate.getTime() / 1000)
}

/**
 * 从时间戳创建日期
 */
export function fromTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000)
}

/**
 * 格式化持续时间
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 0) {
    return "0秒"
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)

  const hours = totalHours % 24
  const minutes = totalMinutes % 60
  const seconds = totalSeconds % 60

  const parts = []

  if (days > 0) {
    parts.push(`${days}天`)
  }

  if (hours > 0) {
    parts.push(`${hours}小时`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}分钟`)
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}秒`)
  }

  return parts.join(" ")
}
