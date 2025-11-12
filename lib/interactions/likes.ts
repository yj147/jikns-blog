/**
 * 通用点赞服务
 * 为文章和动态提供统一的点赞功能
 */

import { prisma } from "@/lib/prisma"
import { Prisma, type User } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"
import { PERFORMANCE_THRESHOLDS } from "@/lib/config/performance"
import { InteractionTargetNotFoundError } from "./errors"

// 点赞目标类型
export type LikeTargetType = "post" | "activity"

// 点赞状态
export interface LikeStatus {
  isLiked: boolean
  count: number
}

// 点赞用户信息（对外契约）
export type LikeUser = Pick<User, "id" | "name" | "avatarUrl">

function buildLikeTargetFilter(targetType: LikeTargetType, targetId: string) {
  return targetType === "post" ? { postId: targetId } : { activityId: targetId }
}

function buildLikeTargetFilterIn(targetType: LikeTargetType, targetIds: string[]) {
  return targetType === "post" ? { postId: { in: targetIds } } : { activityId: { in: targetIds } }
}

function isKnownRequestError(
  error: unknown,
  code: string
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

/**
 * 检查是否为唯一约束冲突错误
 * 仅依赖 Prisma 错误码 P2002，不使用字符串匹配
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * 辅助函数：删除点赞记录
 * 处理并发删除场景（P2025）
 *
 * 注：Prisma 单条 delete 操作本身是原子的，无需事务包裹
 * 触发器更新 activity.likesCount 在数据库层自动保证原子性
 *
 * @param requestId - 可选的请求ID，用于跨层日志关联
 */
async function doDelete(
  likeId: string,
  targetType: LikeTargetType,
  targetId: string,
  userId: string,
  requestId?: string
): Promise<number> {
  try {
    // 性能监控：记录触发器执行耗时
    const startTime = Date.now()

    // 删除点赞记录（触发器会自动更新 activity.likesCount）
    await prisma.like.delete({
      where: { id: likeId },
    })

    const duration = Date.now() - startTime
    const count = await getLikeCount(targetType, targetId)

    // 性能监控：触发器耗时超过阈值时记录警告
    if (duration > PERFORMANCE_THRESHOLDS.TRIGGER_EXECUTION) {
      logger.warn("触发器执行耗时过长", {
        operation: "delete_like",
        targetType,
        targetId,
        duration,
        threshold: PERFORMANCE_THRESHOLDS.TRIGGER_EXECUTION,
        requestId,
      })
    }

    logger.info("取消点赞成功", {
      targetType,
      targetId,
      userId,
      finalCount: count,
      duration,
      requestId,
    })
    return count
  } catch (error: unknown) {
    // 处理并发删除导致的记录不存在错误 (P2025)
    if (isKnownRequestError(error, "P2025")) {
      // 幂等处理：记录已被删除，视为成功
      const count = await getLikeCount(targetType, targetId)
      logger.info("点赞记录已被并发删除，视为成功", {
        targetType,
        targetId,
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
 * 辅助函数：创建点赞记录
 * 处理并发创建场景（P2002）和外键约束（P2003）
 *
 * 注：Prisma 单条 create 操作本身是原子的，无需事务包裹
 * 触发器更新 activity.likesCount 在数据库层自动保证原子性
 *
 * @param requestId - 可选的请求ID，用于跨层日志关联
 */
async function doCreate(
  targetFilter: { postId?: string; activityId?: string },
  userId: string,
  targetType: LikeTargetType,
  targetId: string,
  requestId?: string
): Promise<number> {
  try {
    // 性能监控：记录触发器执行耗时
    const startTime = Date.now()

    // 创建点赞记录（触发器会自动更新 activity.likesCount）
    await prisma.like.create({
      data: {
        authorId: userId,
        ...targetFilter,
      },
    })

    const duration = Date.now() - startTime
    const count = await getLikeCount(targetType, targetId)

    // 性能监控：触发器耗时超过阈值时记录警告
    if (duration > PERFORMANCE_THRESHOLDS.TRIGGER_EXECUTION) {
      logger.warn("触发器执行耗时过长", {
        operation: "create_like",
        targetType,
        targetId,
        duration,
        threshold: PERFORMANCE_THRESHOLDS.TRIGGER_EXECUTION,
        requestId,
      })
    }

    logger.info("点赞成功", {
      targetType,
      targetId,
      userId,
      finalCount: count,
      duration,
      requestId,
    })
    return count
  } catch (error: unknown) {
    // P2003: 外键约束失败，目标不存在
    if (isKnownRequestError(error, "P2003")) {
      throw new InteractionTargetNotFoundError(targetType, targetId)
    }

    // P2002: 唯一约束冲突，视为已点赞（幂等）
    if (isUniqueConstraintViolation(error)) {
      const count = await getLikeCount(targetType, targetId)
      logger.warn("点赞遇到并发唯一约束冲突，按已点赞处理", {
        targetType,
        targetId,
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
 * 切换点赞状态（点赞/取消点赞）
 *
 * 原子性保证：
 * - Prisma 单条操作本身是原子的
 * - 触发器在数据库层保证 Activity 计数的原子性更新
 *
 * 并发安全：
 * - 通过错误码（P2025、P2002）实现幂等性
 * - 取消点赞路径不依赖目标存在，避免历史点赞无法清理
 *
 * @param requestId - 可选的请求ID，用于跨层日志关联
 */
export async function toggleLike(
  targetType: LikeTargetType,
  targetId: string,
  userId: string,
  requestId?: string
): Promise<LikeStatus> {
  try {
    const targetFilter = buildLikeTargetFilter(targetType, targetId)
    const existingLike = await prisma.like.findFirst({
      where: { authorId: userId, ...targetFilter },
    })

    if (existingLike) {
      const count = await doDelete(existingLike.id, targetType, targetId, userId, requestId)
      return { isLiked: false, count }
    } else {
      await assertLikeTargetExists(targetType, targetId)
      const count = await doCreate(targetFilter, userId, targetType, targetId, requestId)
      return { isLiked: true, count }
    }
  } catch (error) {
    logger.error("切换点赞状态失败", error, { requestId, targetType, targetId, userId })
    throw error
  }
}

/**
 * 设定点赞状态（幂等操作）
 * - desired=true: 确保已点赞（捕获 P2002 视为成功）
 * - desired=false: 确保未点赞（deleteMany 天然幂等）
 *
 * @param requestId - 可选的请求ID，用于跨层日志关联
 */
export async function setLike(
  targetType: LikeTargetType,
  targetId: string,
  userId: string,
  desired: boolean,
  requestId?: string
): Promise<LikeStatus> {
  try {
    const targetFilter = buildLikeTargetFilter(targetType, targetId)

    if (desired) {
      await assertLikeTargetExists(targetType, targetId)
      const count = await doCreate(targetFilter, userId, targetType, targetId, requestId)
      return { isLiked: true, count }
    } else {
      await prisma.like.deleteMany({ where: { authorId: userId, ...targetFilter } })
      const count = await getLikeCount(targetType, targetId)
      logger.info("取消点赞成功", { targetType, targetId, userId, finalCount: count, requestId })
      return { isLiked: false, count }
    }
  } catch (error) {
    logger.error("设定点赞状态失败", error, { requestId, targetType, targetId, userId, desired })
    throw error
  }
}

/**
 * 确保已点赞（幂等操作）
 *
 * 如果用户已点赞，直接返回当前状态；
 * 如果用户未点赞，则执行点赞操作。
 *
 * 符合 HTTP PUT/POST 的幂等性要求：多次调用结果一致。
 *
 * @param targetType - 目标类型（post 或 activity）
 * @param targetId - 目标ID
 * @param userId - 用户ID
 * @param requestId - 可选的请求ID，用于跨层日志关联
 * @returns 点赞状态和计数
 *
 * @example
 * // 多次调用返回相同结果
 * const result1 = await ensureLiked("post", "123", "user1")
 * const result2 = await ensureLiked("post", "123", "user1")
 * // result1.isLiked === result2.isLiked === true
 */
export async function ensureLiked(
  targetType: LikeTargetType,
  targetId: string,
  userId: string,
  requestId?: string
): Promise<LikeStatus> {
  return setLike(targetType, targetId, userId, true, requestId)
}

/**
 * 确保未点赞（幂等操作）
 *
 * 如果用户未点赞，直接返回当前状态；
 * 如果用户已点赞，则执行取消点赞操作。
 *
 * 符合 HTTP DELETE 的幂等性要求：多次调用结果一致。
 *
 * @param targetType - 目标类型（post 或 activity）
 * @param targetId - 目标ID
 * @param userId - 用户ID
 * @param requestId - 可选的请求ID，用于跨层日志关联
 * @returns 点赞状态和计数
 *
 * @example
 * // 多次调用返回相同结果
 * const result1 = await ensureUnliked("post", "123", "user1")
 * const result2 = await ensureUnliked("post", "123", "user1")
 * // result1.isLiked === result2.isLiked === false
 */
export async function ensureUnliked(
  targetType: LikeTargetType,
  targetId: string,
  userId: string,
  requestId?: string
): Promise<LikeStatus> {
  return setLike(targetType, targetId, userId, false, requestId)
}

/**
 * 获取点赞状态
 */
export async function getLikeStatus(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string
): Promise<LikeStatus> {
  try {
    // 获取点赞数
    const count = await getLikeCount(targetType, targetId)

    // 如果提供了用户ID，检查是否已点赞
    let isLiked = false
    if (userId) {
      const like = await prisma.like.findFirst({
        where: {
          authorId: userId,
          ...buildLikeTargetFilter(targetType, targetId),
        },
      })
      isLiked = !!like
    }

    return { isLiked, count }
  } catch (error) {
    logger.error("获取点赞状态失败", error)
    throw error
  }
}

/**
 * 获取点赞用户列表
 */
export async function getLikeUsers(
  targetType: LikeTargetType,
  targetId: string,
  limit: number = 10,
  cursor?: string
): Promise<{ users: LikeUser[]; hasMore: boolean; nextCursor?: string }> {
  try {
    const queryOptions: Prisma.LikeFindManyArgs = {
      where: {
        ...buildLikeTargetFilter(targetType, targetId),
      },
      take: limit + 1,
      // 使用复合排序：先按 createdAt 降序，再按 id 降序
      // 这确保了即使有相同的 createdAt，分页也不会有重复或跳项
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }

    // 如果有游标，使用 Prisma 官方的游标模式
    if (cursor) {
      queryOptions.cursor = { id: cursor }
      queryOptions.skip = 1
    }

    type LikeWithAuthor = Prisma.LikeGetPayload<{
      include: {
        author: {
          select: {
            id: true
            name: true
            avatarUrl: true
          }
        }
      }
    }>

    const likes = (await prisma.like.findMany(queryOptions)) as LikeWithAuthor[]

    // 处理分页
    const hasMore = likes.length > limit
    const trimmedLikes = hasMore ? likes.slice(0, limit) : likes

    // 生成下一个游标（使用最后一条记录的 id）
    const lastLike = trimmedLikes[trimmedLikes.length - 1]
    const nextCursor = hasMore ? lastLike?.id : undefined

    // 映射为对外 DTO，仅暴露用户信息
    const users: LikeUser[] = trimmedLikes.map((like) => ({
      id: like.author.id,
      name: like.author.name,
      avatarUrl: like.author.avatarUrl,
    }))

    return {
      users,
      hasMore,
      nextCursor,
    }
  } catch (error) {
    logger.error("获取点赞用户列表失败", error)
    throw error
  }
}

/**
 * 批量获取点赞状态
 * 用于列表页面批量检查用户是否点赞了多个目标
 */
export async function getBatchLikeStatus(
  targetType: LikeTargetType,
  targetIds: string[],
  userId?: string
): Promise<Map<string, LikeStatus>> {
  try {
    const result = new Map<string, LikeStatus>()
    // 初始化计数
    targetIds.forEach((id) => result.set(id, { isLiked: false, count: 0 }))

    if (targetType === "activity") {
      // 活动态使用冗余计数
      const activities = await prisma.activity.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, likesCount: true },
      })
      activities.forEach((a) => {
        result.set(a.id, { isLiked: false, count: a.likesCount || 0 })
      })
    } else {
      // 文章侧没有冗余计数，按点赞表聚合
      const groups = await prisma.like.groupBy({
        by: ["postId"],
        where: { postId: { in: targetIds } },
        _count: { _all: true },
      })
      groups.forEach((g) => {
        if (g.postId) {
          result.set(g.postId, { isLiked: false, count: g._count._all })
        }
      })
    }

    // 如果提供了用户ID，批量检查是否已点赞
    if (userId) {
      const likes = await prisma.like.findMany({
        where: {
          authorId: userId,
          ...buildLikeTargetFilterIn(targetType, targetIds),
        },
        select: {
          postId: true,
          activityId: true,
        },
      })

      likes.forEach((like) => {
        const targetId = like.postId || like.activityId!
        const status = result.get(targetId)
        if (status) {
          status.isLiked = true
        }
      })
    }

    return result
  } catch (error) {
    logger.error("批量获取点赞状态失败", error)
    throw error
  }
}

/**
 * 验证点赞目标是否存在
 */
async function assertLikeTargetExists(targetType: LikeTargetType, targetId: string): Promise<void> {
  if (targetType === "post") {
    const post = await prisma.post.findFirst({
      where: {
        id: targetId,
        published: true,
      },
      select: { id: true },
    })
    if (!post) {
      throw new InteractionTargetNotFoundError("post", targetId)
    }
  } else {
    const activity = await prisma.activity.findFirst({
      where: {
        id: targetId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!activity) {
      throw new InteractionTargetNotFoundError("activity", targetId)
    }
  }
}

/**
 * 获取点赞数量
 */
export async function getLikeCount(targetType: LikeTargetType, targetId: string): Promise<number> {
  if (targetType === "activity") {
    const activity = await prisma.activity.findUnique({
      where: { id: targetId },
      select: { likesCount: true },
    })
    return activity?.likesCount || 0
  } else {
    // 文章侧无冗余计数，直接计算
    const count = await prisma.like.count({ where: { postId: targetId } })
    return count
  }
}

/**
 * 清理用户的所有点赞
 * 用于用户注销等场景
 *
 * 原子性保证：
 * - deleteMany 操作本身是原子的
 * - 数据库触发器（sync_activity_likes_count）会在每条记录删除后自动更新 activity.likesCount
 * - 触发器在数据库层保证原子性，无需应用层显式事务包裹
 * - 使用 GREATEST(likesCount - 1, 0) 防止计数变为负数
 */
export async function clearUserLikes(userId: string): Promise<void> {
  try {
    // 1. 查询用户的所有 activity 点赞
    const activityLikes = await prisma.like.findMany({
      where: {
        authorId: userId,
        activityId: { not: null },
      },
      select: { activityId: true },
    })

    // 2. 记录受影响的 activity 列表用于审计
    const affectedActivityIds = new Set<string>()
    activityLikes.forEach((like) => {
      affectedActivityIds.add(like.activityId!)
    })

    // 3. 删除所有点赞（包括 post 和 activity）
    // 触发器会自动更新 activity.likesCount
    await prisma.like.deleteMany({
      where: { authorId: userId },
    })

    logger.info("清理用户点赞成功", {
      userId,
      totalLikes: activityLikes.length,
      affectedActivities: affectedActivityIds.size,
    })
  } catch (error) {
    logger.error("清理用户点赞失败", error)
    throw error
  }
}
