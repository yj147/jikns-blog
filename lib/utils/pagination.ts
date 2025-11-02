/**
 * 分页相关工具函数
 * 支持游标分页和偏移分页两种模式
 */

export interface CursorPaginationOptions {
  cursor?: string
  limit?: number
  direction?: "forward" | "backward"
}

export interface OffsetPaginationOptions {
  page?: number
  pageSize?: number
}

export interface PaginationResult<T> {
  data: T[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount?: number
}

export interface CursorPaginationResult<T> extends PaginationResult<T> {
  nextCursor?: string
  previousCursor?: string
}

export interface OffsetPaginationResult<T> extends PaginationResult<T> {
  currentPage: number
  totalPages: number
  pageSize: number
}

/**
 * 创建游标分页参数
 */
export function createCursorPagination(
  options: CursorPaginationOptions = {}
): Required<CursorPaginationOptions> {
  return {
    cursor: options.cursor || "",
    limit: Math.min(options.limit || 20, 100), // 最大限制100条
    direction: options.direction || "forward",
  }
}

/**
 * 创建偏移分页参数
 */
export function createOffsetPagination(
  options: OffsetPaginationOptions = {}
): Required<OffsetPaginationOptions> {
  const page = Math.max(options.page || 1, 1)
  const pageSize = Math.min(Math.max(options.pageSize || 20, 1), 100)

  return { page, pageSize }
}

/**
 * 计算偏移量
 */
export function calculateOffset(page: number, pageSize: number): number {
  return Math.max((page - 1) * pageSize, 0)
}

/**
 * 计算总页数
 */
export function calculateTotalPages(totalCount: number, pageSize: number): number {
  return Math.ceil(totalCount / pageSize)
}

/**
 * 生成游标（基于ID或时间戳）
 */
export function generateCursor(id: string | number, timestamp?: Date): string {
  const cursorData = timestamp ? `${id}_${timestamp.toISOString()}` : String(id)
  return Buffer.from(cursorData).toString("base64")
}

/**
 * 解析游标
 */
export function parseCursor(cursor: string): { id: string; timestamp?: Date } | null {
  try {
    // 验证 base64 格式
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cursor)) {
      return null
    }

    const decoded = Buffer.from(cursor, "base64").toString("utf-8")

    // 检查解码后的内容是否包含有效字符
    if (!/^[\w\-._:]+$/.test(decoded)) {
      return null
    }

    const [id, timestampStr] = decoded.split("_")

    if (!id) return null

    return {
      id,
      timestamp: timestampStr ? new Date(timestampStr) : undefined,
    }
  } catch {
    return null
  }
}

/**
 * 创建分页元数据（用于API响应）
 */
export function createPaginationMeta<T>(
  data: T[],
  totalCount: number,
  options: OffsetPaginationOptions
): OffsetPaginationResult<T> {
  const { page, pageSize } = createOffsetPagination(options)
  const totalPages = calculateTotalPages(totalCount, pageSize)

  return {
    data,
    currentPage: page,
    pageSize,
    totalPages,
    totalCount,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }
}

/**
 * 创建游标分页元数据
 */
export function createCursorPaginationMeta<T>(
  data: T[],
  options: CursorPaginationOptions,
  getItemId: (item: T) => string,
  getItemTimestamp?: (item: T) => Date
): CursorPaginationResult<T> {
  const { limit, direction } = createCursorPagination(options)
  const hasNextPage = data.length === limit
  const hasPreviousPage = direction === "backward" || Boolean(options.cursor)

  let nextCursor: string | undefined
  let previousCursor: string | undefined

  if (data.length > 0) {
    const lastItem = data[data.length - 1]
    const firstItem = data[0]

    nextCursor = hasNextPage
      ? generateCursor(getItemId(lastItem), getItemTimestamp?.(lastItem))
      : undefined

    previousCursor = hasPreviousPage
      ? generateCursor(getItemId(firstItem), getItemTimestamp?.(firstItem))
      : undefined
  }

  return {
    data,
    hasNextPage,
    hasPreviousPage,
    nextCursor,
    previousCursor,
  }
}

/**
 * 验证分页参数
 */
export function validatePaginationOptions(options: OffsetPaginationOptions): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (options.page !== undefined && (options.page < 1 || !Number.isInteger(options.page))) {
    errors.push("页码必须是正整数")
  }

  if (
    options.pageSize !== undefined &&
    (options.pageSize < 1 || options.pageSize > 100 || !Number.isInteger(options.pageSize))
  ) {
    errors.push("页面大小必须是1-100之间的整数")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 验证游标分页参数
 */
export function validateCursorPaginationOptions(options: CursorPaginationOptions): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (
    options.limit !== undefined &&
    (options.limit < 1 || options.limit > 100 || !Number.isInteger(options.limit))
  ) {
    errors.push("限制数量必须是1-100之间的整数")
  }

  if (options.cursor && !parseCursor(options.cursor)) {
    errors.push("游标格式无效")
  }

  if (options.direction && !["forward", "backward"].includes(options.direction)) {
    errors.push("方向参数必须是 forward 或 backward")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
