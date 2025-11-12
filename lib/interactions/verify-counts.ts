/**
 * 计数校验工具
 * 用于定期检查 Activity 表的冗余计数字段是否与实际数据一致
 *
 * 使用场景：
 * - Vercel Cron Job 定期执行
 * - 手动运行检查数据一致性
 * - 数据库迁移后的验证
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"

/**
 * 计数不一致的记录
 */
export interface CountMismatch {
  activityId: string
  field: "likesCount" | "commentsCount"
  expected: number
  actual: number
  diff: number
}

/**
 * 校验结果
 */
export interface VerifyResult {
  totalChecked: number
  mismatches: CountMismatch[]
  hasIssues: boolean
}

/**
 * 校验 Activity 的 likesCount 字段
 *
 * 对比 Activity.likesCount 与 Like 表中的实际点赞数
 * 返回所有不一致的记录
 *
 * 性能优化：使用批量聚合避免 N+1 查询
 * - 原实现：1000 条记录 = 1000 次 count 查询
 * - 优化后：1000 条记录 = 1 次 findMany + 1 次 groupBy
 *
 * @param limit - 每次检查的最大记录数（默认 1000）
 * @returns 校验结果
 */
export async function verifyActivityLikesCount(limit: number = 1000): Promise<VerifyResult> {
  try {
    logger.info("开始校验 Activity.likesCount", { limit })

    // 获取所有未删除的 Activity
    const activities = await prisma.activity.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        likesCount: true,
      },
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    })

    if (activities.length === 0) {
      return {
        totalChecked: 0,
        mismatches: [],
        hasIssues: false,
      }
    }

    // 批量聚合点赞数（避免 N+1 查询）
    const activityIds = activities.map((a) => a.id)
    const likeCounts = await prisma.like.groupBy({
      by: ["activityId"],
      where: {
        activityId: { in: activityIds },
      },
      _count: {
        _all: true,
      },
    })

    // 构建 Map 用于 O(1) 查找
    const likeCountMap = new Map<string, number>(
      likeCounts.map((lc) => [lc.activityId!, lc._count._all])
    )

    // 在内存中比对计数
    const mismatches: CountMismatch[] = []
    for (const activity of activities) {
      const actualCount = likeCountMap.get(activity.id) || 0
      const storedCount = activity.likesCount || 0

      if (actualCount !== storedCount) {
        mismatches.push({
          activityId: activity.id,
          field: "likesCount",
          expected: actualCount,
          actual: storedCount,
          diff: actualCount - storedCount,
        })
      }
    }

    const result: VerifyResult = {
      totalChecked: activities.length,
      mismatches,
      hasIssues: mismatches.length > 0,
    }

    if (result.hasIssues) {
      logger.warn("发现 Activity.likesCount 不一致", {
        totalChecked: result.totalChecked,
        mismatchCount: mismatches.length,
        mismatches: mismatches.slice(0, 10),
      })
    } else {
      logger.info("Activity.likesCount 校验通过", {
        totalChecked: result.totalChecked,
      })
    }

    return result
  } catch (error) {
    logger.error("校验 Activity.likesCount 失败", error)
    throw error
  }
}

/**
 * 校验 Activity 的 commentsCount 字段
 *
 * 对比 Activity.commentsCount 与 Comment 表中的实际评论数
 * 返回所有不一致的记录
 *
 * 性能优化：使用批量聚合避免 N+1 查询
 * - 原实现：1000 条记录 = 1000 次 count 查询
 * - 优化后：1000 条记录 = 1 次 findMany + 1 次 groupBy
 *
 * @param limit - 每次检查的最大记录数（默认 1000）
 * @returns 校验结果
 */
export async function verifyActivityCommentsCount(limit: number = 1000): Promise<VerifyResult> {
  try {
    logger.info("开始校验 Activity.commentsCount", { limit })

    // 获取所有未删除的 Activity
    const activities = await prisma.activity.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        commentsCount: true,
      },
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    })

    if (activities.length === 0) {
      return {
        totalChecked: 0,
        mismatches: [],
        hasIssues: false,
      }
    }

    // 批量聚合评论数（避免 N+1 查询）
    const activityIds = activities.map((a) => a.id)
    const commentCounts = await prisma.comment.groupBy({
      by: ["activityId"],
      where: {
        activityId: { in: activityIds },
      },
      _count: {
        _all: true,
      },
    })

    // 构建 Map 用于 O(1) 查找
    const commentCountMap = new Map<string, number>(
      commentCounts.map((cc) => [cc.activityId!, cc._count._all])
    )

    // 在内存中比对计数
    const mismatches: CountMismatch[] = []
    for (const activity of activities) {
      const actualCount = commentCountMap.get(activity.id) || 0
      const storedCount = activity.commentsCount || 0

      if (actualCount !== storedCount) {
        mismatches.push({
          activityId: activity.id,
          field: "commentsCount",
          expected: actualCount,
          actual: storedCount,
          diff: actualCount - storedCount,
        })
      }
    }

    const result: VerifyResult = {
      totalChecked: activities.length,
      mismatches,
      hasIssues: mismatches.length > 0,
    }

    if (result.hasIssues) {
      logger.warn("发现 Activity.commentsCount 不一致", {
        totalChecked: result.totalChecked,
        mismatchCount: mismatches.length,
        mismatches: mismatches.slice(0, 10),
      })
    } else {
      logger.info("Activity.commentsCount 校验通过", {
        totalChecked: result.totalChecked,
      })
    }

    return result
  } catch (error) {
    logger.error("校验 Activity.commentsCount 失败", error)
    throw error
  }
}

/**
 * 修复 Activity 的计数不一致问题
 *
 * 根据实际数据重新计算并更新 Activity 的计数字段
 *
 * 安全性改进：
 * - 原实现：使用字符串拼接构造 CASE 语句，存在 SQL 注入风险
 * - 优化后：使用 Prisma 事务和参数化更新，完全类型安全
 *
 * 性能特性：
 * - 使用事务保证原子性
 * - 批量更新减少网络往返
 * - Prisma 自动处理参数化
 *
 * @param mismatches - 不一致的记录列表
 * @returns 修复的记录数
 */
export async function fixCountMismatches(mismatches: CountMismatch[]): Promise<number> {
  try {
    logger.info("开始修复计数不一致", { count: mismatches.length })

    if (mismatches.length === 0) {
      return 0
    }

    // 按字段类型分组
    const likesMismatches = mismatches.filter((m) => m.field === "likesCount")
    const commentsMismatches = mismatches.filter((m) => m.field === "commentsCount")

    // 使用 Prisma 事务批量更新（安全且类型安全）
    // 消除特殊情况：统一处理 likesCount 和 commentsCount
    await prisma.$transaction([
      // 更新 likesCount
      ...likesMismatches.map((m) =>
        prisma.activity.update({
          where: { id: m.activityId },
          data: { likesCount: m.expected },
        })
      ),
      // 更新 commentsCount
      ...commentsMismatches.map((m) =>
        prisma.activity.update({
          where: { id: m.activityId },
          data: { commentsCount: m.expected },
        })
      ),
    ])

    const fixedCount = mismatches.length

    logger.info("计数不一致修复完成", {
      fixedCount,
      likesFixed: likesMismatches.length,
      commentsFixed: commentsMismatches.length,
    })
    return fixedCount
  } catch (error) {
    logger.error("修复计数不一致失败", error)
    throw error
  }
}

/**
 * 完整的计数校验和修复流程
 *
 * 执行所有计数校验，并可选择自动修复不一致的记录
 *
 * @param options - 配置选项
 * @returns 校验和修复结果
 */
export async function verifyAndFixCounts(options: { limit?: number; autoFix?: boolean }): Promise<{
  likesResult: VerifyResult
  commentsResult: VerifyResult
  fixedCount: number
}> {
  const { limit = 1000, autoFix = false } = options

  // 校验点赞数
  const likesResult = await verifyActivityLikesCount(limit)

  // 校验评论数
  const commentsResult = await verifyActivityCommentsCount(limit)

  let fixedCount = 0

  // 自动修复（如果启用）
  if (autoFix && (likesResult.hasIssues || commentsResult.hasIssues)) {
    const allMismatches = [...likesResult.mismatches, ...commentsResult.mismatches]
    fixedCount = await fixCountMismatches(allMismatches)
  }

  return {
    likesResult,
    commentsResult,
    fixedCount,
  }
}
