/**
 * 收藏服务层
 * 提供文章收藏的状态查询、切换、列表功能
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"
import { PERFORMANCE_THRESHOLDS } from "@/lib/config/performance"
import { InteractionTargetNotFoundError } from "./errors"

// 导出类型定义
export type BookmarkStatus = {
  isBookmarked: boolean
  count: number
}

export type BookmarkListItem = {
  id: string
  createdAt: string
  post: {
    id: string
    slug: string
    title: string
    coverImage: string | null
    author: {
      id: string
      name: string | null
      avatarUrl: string | null
    }
  }
}

export type BookmarkListResult = {
  items: BookmarkListItem[]
  hasMore: boolean
  nextCursor?: string
}

function isKnownRequestError(
  error: unknown,
  code: string
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

/**
 * 辅助函数：验证文章是否存在且已发布
 */
async function assertPostExists(postId: string): Promise<void> {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      published: true,
    },
  })

  if (!post) {
    throw new InteractionTargetNotFoundError("post", postId)
  }
}

/**
 * 辅助函数：创建收藏记录
 * 处理并发创建场景（P2002）和外键约束（P2003）
 *
 * 注：Prisma 单条 create 操作本身是原子的，无需事务包裹
 *
 * @param requestId - 可选的请求ID，用于跨层日志关联
 */
async function doCreateBookmark(
  postId: string,
  userId: string,
  requestId?: string
): Promise<number> {
  try {
    // 性能监控：记录操作耗时
    const startTime = Date.now()

    await prisma.bookmark.create({
      data: {
        userId,
        postId,
      },
    })

    const duration = Date.now() - startTime
    const count = await prisma.bookmark.count({ where: { postId } })

    // 性能监控：操作耗时超过阈值时记录警告
    if (duration > PERFORMANCE_THRESHOLDS.DATABASE_OPERATION) {
      logger.warn("收藏操作耗时过长", {
        operation: "create_bookmark",
        postId,
        duration,
        threshold: PERFORMANCE_THRESHOLDS.DATABASE_OPERATION,
        requestId,
      })
    }

    logger.info("收藏成功", {
      postId,
      userId,
      finalCount: count,
      duration,
      requestId,
    })

    return count
  } catch (error: unknown) {
    // P2003: 外键约束失败，文章不存在
    if (isKnownRequestError(error, "P2003")) {
      throw new InteractionTargetNotFoundError("post", postId)
    }

    // P2002: 唯一约束冲突，视为已收藏（幂等）
    if (isKnownRequestError(error, "P2002")) {
      const count = await prisma.bookmark.count({ where: { postId } })
      logger.warn("收藏遇到并发唯一约束冲突，按已收藏处理", {
        postId,
        userId,
        finalCount: count,
        requestId,
      })
      return count
    }

    throw error
  }
}

/**
 * 辅助函数：删除收藏记录
 * 处理并发删除场景（P2025）
 *
 * 注：Prisma 单条 delete 操作本身是原子的，无需事务包裹
 *
 * @param requestId - 可选的请求ID，用于跨层日志关联
 */
async function doDeleteBookmark(
  bookmarkId: string,
  postId: string,
  requestId?: string
): Promise<number> {
  try {
    // 性能监控：记录操作耗时
    const startTime = Date.now()

    await prisma.bookmark.delete({
      where: { id: bookmarkId },
    })

    const duration = Date.now() - startTime
    const count = await prisma.bookmark.count({ where: { postId } })

    // 性能监控：操作耗时超过阈值时记录警告
    if (duration > PERFORMANCE_THRESHOLDS.DATABASE_OPERATION) {
      logger.warn("取消收藏操作耗时过长", {
        operation: "delete_bookmark",
        postId,
        duration,
        threshold: PERFORMANCE_THRESHOLDS.DATABASE_OPERATION,
        requestId,
      })
    }

    logger.info("取消收藏成功", {
      postId,
      bookmarkId,
      finalCount: count,
      duration,
      requestId,
    })

    return count
  } catch (error: unknown) {
    // 处理并发删除导致的记录不存在错误 (P2025)
    if (isKnownRequestError(error, "P2025")) {
      // 幂等处理：记录已被删除，视为成功
      const count = await prisma.bookmark.count({ where: { postId } })
      logger.warn("取消收藏遇到并发删除冲突，按未收藏处理", {
        postId,
        bookmarkId,
        finalCount: count,
        requestId,
      })
      return count
    }

    throw error
  }
}

/**
 * 设置收藏状态（幂等操作）
 *
 * 核心幂等方法，通过 desired 参数控制最终状态：
 * - desired=true: 确保已收藏（多次调用结果一致）
 * - desired=false: 确保未收藏（多次调用结果一致）
 *
 * 幂等性保证：
 * - 并发创建：捕获 P2002（唯一约束冲突）→ 视为成功
 * - 并发删除：deleteMany 天然幂等，不抛出 P2025
 * - 外键失败：捕获 P2003（文章不存在）→ 抛出业务异常
 *
 * @param postId - 文章ID
 * @param userId - 用户ID
 * @param desired - 期望的收藏状态（true=已收藏, false=未收藏）
 * @param requestId - 可选的请求ID，用于跨层日志关联
 * @returns 收藏状态和总数
 */
export async function setBookmark(
  postId: string,
  userId: string,
  desired: boolean,
  requestId?: string
): Promise<BookmarkStatus> {
  if (desired) {
    // desired=true: 确保已收藏（复用 doCreateBookmark 辅助函数）
    await assertPostExists(postId)
    const count = await doCreateBookmark(postId, userId, requestId)
    return { isBookmarked: true, count }
  } else {
    // desired=false: 确保未收藏（deleteMany 天然幂等）
    await prisma.bookmark.deleteMany({
      where: { userId, postId },
    })

    const count = await prisma.bookmark.count({ where: { postId } })
    return { isBookmarked: false, count }
  }
}

/**
 * 确保已收藏（幂等操作）
 *
 * 如果用户已收藏，直接返回当前状态；
 * 如果用户未收藏，则执行收藏操作。
 *
 * 符合 HTTP PUT 的幂等性要求：多次调用结果一致。
 *
 * @param postId - 文章ID
 * @param userId - 用户ID
 * @param requestId - 可选的请求ID，用于跨层日志关联
 * @returns 收藏状态和总数
 *
 * @example
 * // 多次调用返回相同结果
 * const result1 = await ensureBookmarked("post-123", "user-1")
 * const result2 = await ensureBookmarked("post-123", "user-1")
 * // result1.isBookmarked === result2.isBookmarked === true
 */
export async function ensureBookmarked(
  postId: string,
  userId: string,
  requestId?: string
): Promise<BookmarkStatus> {
  return setBookmark(postId, userId, true, requestId)
}

/**
 * 确保未收藏（幂等操作）
 *
 * 如果用户未收藏，直接返回当前状态；
 * 如果用户已收藏，则执行取消收藏操作。
 *
 * 符合 HTTP DELETE 的幂等性要求：多次调用结果一致。
 *
 * @param postId - 文章ID
 * @param userId - 用户ID
 * @param requestId - 可选的请求ID，用于跨层日志关联
 * @returns 收藏状态和总数
 *
 * @example
 * // 多次调用返回相同结果
 * const result1 = await ensureUnbookmarked("post-123", "user-1")
 * const result2 = await ensureUnbookmarked("post-123", "user-1")
 * // result1.isBookmarked === result2.isBookmarked === false
 */
export async function ensureUnbookmarked(
  postId: string,
  userId: string,
  requestId?: string
): Promise<BookmarkStatus> {
  return setBookmark(postId, userId, false, requestId)
}

/**
 * 切换收藏状态
 * @param postId - 文章ID
 * @param userId - 用户ID
 * @param requestId - 可选的请求ID，用于跨层日志关联
 * @returns 收藏状态和总数
 */
export async function toggleBookmark(
  postId: string,
  userId: string,
  requestId?: string
): Promise<BookmarkStatus> {
  // 查找现有的收藏记录
  const existingBookmark = await prisma.bookmark.findUnique({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  })

  if (existingBookmark) {
    // 取消收藏（复用 doDeleteBookmark 辅助函数）
    const count = await doDeleteBookmark(existingBookmark.id, postId, requestId)
    return { isBookmarked: false, count }
  } else {
    // 添加收藏（复用 assertPostExists 和 doCreateBookmark 辅助函数）
    await assertPostExists(postId)
    const count = await doCreateBookmark(postId, userId, requestId)
    return { isBookmarked: true, count }
  }
}

/**
 * 获取收藏状态
 * @param postId - 文章ID
 * @param userId - 用户ID（可选）
 * @returns 收藏状态和总数
 */
export async function getBookmarkStatus(postId: string, userId?: string): Promise<BookmarkStatus> {
  // 获取收藏总数
  const count = await prisma.bookmark.count({
    where: { postId },
  })

  // 匿名用户返回未收藏状态
  if (!userId) {
    return {
      isBookmarked: false,
      count,
    }
  }

  // 登录用户查询实际收藏状态
  const bookmark = await prisma.bookmark.findUnique({
    where: {
      userId_postId: {
        userId,
        postId,
      },
    },
  })

  return {
    isBookmarked: !!bookmark,
    count,
  }
}

/**
 * 获取用户的收藏列表
 * @param userId - 用户ID
 * @param opts - 分页选项
 * @returns 收藏列表和分页信息
 */
export async function getUserBookmarks(
  userId: string,
  opts?: {
    cursor?: string
    limit?: number
  }
): Promise<BookmarkListResult> {
  // limit 边界裁剪（1..100），确保服务层直调也稳健
  const limit = Math.min(Math.max(opts?.limit !== undefined ? opts.limit : 10, 1), 100)
  const cursor = opts?.cursor

  // 构建查询条件 - 使用显式的关系过滤
  const where = {
    userId,
    post: {
      is: {
        published: true,
      },
    },
  }

  // 查询收藏列表（取 limit + 1 用于判断是否有下一页）
  const bookmarks = await prisma.bookmark.findMany({
    where,
    // 稳定排序：createdAt desc + id desc，降低同秒写入的游标跳项风险
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor && {
      cursor: {
        id: cursor,
      },
      skip: 1,
    }),
    include: {
      post: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  })

  // 判断是否有下一页
  const hasMore = bookmarks.length > limit
  const items = hasMore ? bookmarks.slice(0, limit) : bookmarks

  // 转换为返回格式
  const formattedItems: BookmarkListItem[] = items.map((bookmark) => ({
    id: bookmark.id,
    createdAt: bookmark.createdAt.toISOString(),
    post: {
      id: bookmark.post.id,
      slug: bookmark.post.slug,
      title: bookmark.post.title,
      coverImage: bookmark.post.coverImage,
      author: {
        id: bookmark.post.author.id,
        name: bookmark.post.author.name,
        avatarUrl: bookmark.post.author.avatarUrl,
      },
    },
  }))

  return {
    items: formattedItems,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1].id : undefined,
  }
}
