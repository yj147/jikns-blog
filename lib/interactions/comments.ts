/**
 * 通用评论服务
 * 为文章和动态提供统一的评论功能
 *
 * ============================================================================
 * 软删除可见性策略（设计决策）
 * ============================================================================
 *
 * 本模块采用"软删除可见（占位符模式）"策略：
 *
 * 1. **核心原则**：
 *    - 软删除的评论对用户可见，显示为 "[该评论已删除]" 占位符
 *    - 保持对话完整性：如果评论有回复，删除后仍显示占位符以维持上下文
 *    - 计数器包含软删除：commentsCount 统计所有评论（含软删除），与用户看到的数量一致
 *
 * 2. **实现细节**：
 *    - `listComments`：返回所有评论（包括软删除），不过滤 deletedAt
 *    - `formatComment`：将 deletedAt 非空的评论内容替换为占位符，设置 isDeleted=true
 *    - `getCommentCount`：统计所有评论，不过滤 deletedAt
 *    - `deleteComment`：有回复时软删（设置 deletedAt），无回复时硬删（DELETE）
 *    - 数据库触发器：只在 INSERT/DELETE 时更新计数，UPDATE（软删）不影响计数
 *
 * 3. **设计理由**：
 *    - 符合主流平台惯例（Reddit/Twitter/微信）
 *    - 避免"幽灵回复"问题（回复的父评论消失导致上下文丢失）
 *    - 用户体验一致：看到的评论数与计数器显示的数字一致
 *    - 简化前端逻辑：不需要处理评论数量跳变
 *
 * 4. **影响范围**：
 *    - API 响应：软删除评论会出现在列表中，isDeleted=true
 *    - 计数器：Activity.commentsCount 包含软删除评论
 *    - 触发器：软删除（UPDATE deletedAt）不触发计数变更
 *    - 测试用例：期望软删除评论可见（见 tests/integration/comments-service.test.ts:545）
 *
 * ============================================================================
 */

import { prisma } from "@/lib/prisma"
import { cleanXSS } from "@/lib/security/xss-cleaner"
import type { Comment, User, Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"
import type { CommentTargetType } from "@/lib/dto/comments.dto"

export enum CommentErrorCode {
  TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
  PARENT_NOT_FOUND = "PARENT_NOT_FOUND",
  PARENT_DELETED = "PARENT_DELETED",
  PARENT_MISMATCH = "PARENT_MISMATCH",
  COMMENT_NOT_FOUND = "COMMENT_NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  TARGET_MISSING_REFERENCE = "TARGET_MISSING_REFERENCE",
}

export class CommentServiceError extends Error {
  code: CommentErrorCode
  status: number
  context?: Record<string, unknown>

  constructor(
    code: CommentErrorCode,
    message: string,
    status: number,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = "CommentServiceError"
    this.code = code
    this.status = status
    this.context = context
  }
}

// 评论查询选项
export interface CommentQueryOptions {
  targetType: CommentTargetType
  targetId: string
  cursor?: string
  limit?: number
  includeReplies?: boolean
  includeAuthor?: boolean
  parentId?: string | null
}

// 评论创建数据
export interface CreateCommentData {
  targetType: CommentTargetType
  targetId: string
  content: string
  authorId: string
  parentId?: string
}

// 评论响应类型
export interface CommentWithAuthor extends Comment {
  author: Pick<User, "id" | "name" | "avatarUrl" | "email" | "role"> | null
  replies?: CommentWithAuthor[]
  isDeleted: boolean
  targetType: CommentTargetType
  targetId: string
  _count?: {
    replies: number
  }
  childrenCount: number
}

/**
 * 验证父评论的有效性
 *
 * 检查：
 * 1. 父评论是否存在
 * 2. 父评论是否已被软删除
 * 3. 父评论是否属于同一目标（Post 或 Activity）
 *
 * @throws {CommentServiceError} 如果验证失败
 */
async function validateParentComment(
  parentId: string,
  targetType: CommentTargetType,
  targetId: string
): Promise<void> {
  const parentComment = await prisma.comment.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      postId: true,
      activityId: true,
      deletedAt: true,
    },
  })

  if (!parentComment) {
    throw new CommentServiceError(
      CommentErrorCode.PARENT_NOT_FOUND,
      "Parent comment not found",
      404,
      {
        parentId,
      }
    )
  }

  if (parentComment.deletedAt) {
    throw new CommentServiceError(
      CommentErrorCode.PARENT_DELETED,
      "Cannot reply to a deleted comment",
      409,
      {
        parentId,
      }
    )
  }

  // 确保父评论属于同一目标
  const parentTargetId = targetType === "post" ? parentComment.postId : parentComment.activityId
  if (parentTargetId !== targetId) {
    throw new CommentServiceError(
      CommentErrorCode.PARENT_MISMATCH,
      "Parent comment does not belong to the same target",
      400,
      {
        parentId,
        targetType,
        targetId,
        parentTargetId,
      }
    )
  }
}

export async function createComment(data: CreateCommentData): Promise<CommentWithAuthor> {
  try {
    // XSS 清理
    const cleanContent = cleanXSS(data.content)

    // 验证目标是否存在
    const targetExists = await validateCommentTarget(data.targetType, data.targetId)
    if (!targetExists) {
      throw new CommentServiceError(
        CommentErrorCode.TARGET_NOT_FOUND,
        `${data.targetType} ${data.targetId} not found`,
        404,
        {
          targetType: data.targetType,
          targetId: data.targetId,
        }
      )
    }

    // 如果是回复，验证父评论
    if (data.parentId) {
      await validateParentComment(data.parentId, data.targetType, data.targetId)
    }

    // 使用事务创建评论并更新计数
    const comment = await prisma.$transaction(async (tx) => {
      // 1. 创建评论
      const newComment = await tx.comment.create({
        data: {
          content: cleanContent,
          authorId: data.authorId,
          parentId: data.parentId,
          ...(data.targetType === "post"
            ? { postId: data.targetId }
            : { activityId: data.targetId }),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
              role: true,
            },
          },
        },
      })

      // 触发器会自动更新 activity.commentsCount

      return newComment
    })

    logger.info("评论创建成功", {
      commentId: comment.id,
      targetType: data.targetType,
      targetId: data.targetId,
      authorId: data.authorId,
    })
    return formatComment(comment as PrismaCommentWithAuthor)
  } catch (error) {
    if (error instanceof CommentServiceError) {
      logger.warn("创建评论失败", {
        code: error.code,
        status: error.status,
        context: error.context,
      })
    } else {
      logger.error("创建评论失败", error)
    }
    throw error
  }
}

/**
 * 获取评论列表
 */
export async function listComments(
  options: CommentQueryOptions
): Promise<{ comments: CommentWithAuthor[]; hasMore: boolean; nextCursor?: string }> {
  try {
    const {
      targetType,
      targetId,
      cursor,
      limit = 20,
      includeReplies = false,
      includeAuthor = true,
      parentId,
    } = options

    const isFetchingReplies = !!parentId
    const baseWhere = targetType === "post" ? { postId: targetId } : { activityId: targetId }

    const where: Prisma.CommentWhereInput = isFetchingReplies
      ? { ...baseWhere, parentId }
      : { ...baseWhere, parentId: null }

    const orderBy: Prisma.CommentOrderByWithRelationInput[] = isFetchingReplies
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "desc" }]

    const include: Prisma.CommentInclude = {
      _count: {
        select: { replies: true },
      },
    }

    if (includeAuthor) {
      include.author = {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          email: true,
          role: true,
        },
      }
    }

    const queryOptions: Prisma.CommentFindManyArgs = {
      where,
      take: limit + 1,
      orderBy,
      include,
    }

    if (cursor) {
      queryOptions.cursor = { id: cursor }
      queryOptions.skip = 1
    }

    const comments = await prisma.comment.findMany(queryOptions)

    // 处理分页
    const hasMore = comments.length > limit
    if (hasMore) {
      comments.pop() // 移除多余的一条
    }

    const nextCursor = hasMore ? comments[comments.length - 1]?.id : undefined

    // 格式化顶层评论
    let commentsWithReplies: CommentWithAuthor[] = (comments as PrismaCommentWithAuthor[]).map(
      (comment) => formatComment(comment)
    )

    // 如果需要包含回复，批量获取并组装
    if (!isFetchingReplies && includeReplies && comments.length > 0) {
      const commentIds = comments.map((c) => c.id)
      const replies = await prisma.comment.findMany({
        where: {
          parentId: { in: commentIds },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include,
      })

      // 使用辅助函数组装回复
      commentsWithReplies = assembleReplies(
        commentsWithReplies,
        replies as PrismaCommentWithAuthor[]
      )
    }

    return {
      comments: commentsWithReplies,
      hasMore,
      nextCursor,
    }
  } catch (error) {
    logger.error("获取评论列表失败", error)
    throw error
  }
}

/**
 * 删除评论
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<void> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        postId: true,
        activityId: true,
      },
    })

    if (!comment) {
      throw new CommentServiceError(CommentErrorCode.COMMENT_NOT_FOUND, "Comment not found", 404, {
        commentId,
      })
    }

    // 权限检查：只有作者或管理员可以删除
    if (!isAdmin && comment.authorId !== userId) {
      throw new CommentServiceError(
        CommentErrorCode.UNAUTHORIZED,
        "Unauthorized to delete this comment",
        403,
        {
          commentId,
          userId,
        }
      )
    }

    // 获取目标信息用于更新计数
    // 软删除：如果有回复，只清空内容
    const hasReplies =
      (await prisma.comment.count({
        where: { parentId: commentId },
      })) > 0

    if (hasReplies) {
      // 软删除：如果有回复，只设置 deletedAt
      // formatComment 函数会在读取时自动替换 content 为 "[该评论已删除]"
      // 数据库触发器会自动更新 activity.commentsCount
      await prisma.comment.update({
        where: { id: commentId },
        data: {
          deletedAt: new Date(),
        },
      })
    } else {
      // 硬删除：删除评论记录（触发器会自动更新 activity.commentsCount）
      await prisma.comment.delete({
        where: { id: commentId },
      })
    }

    logger.info("评论删除成功", {
      commentId,
      userId,
      isAdmin,
      softDelete: hasReplies,
    })
  } catch (error) {
    if (error instanceof CommentServiceError) {
      logger.warn("删除评论失败", {
        code: error.code,
        status: error.status,
        context: error.context,
      })
    } else {
      logger.error("删除评论失败", error)
    }
    throw error
  }
}

/**
 * 验证评论目标是否存在
 */
async function validateCommentTarget(
  targetType: CommentTargetType,
  targetId: string
): Promise<boolean> {
  if (targetType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      select: { id: true },
    })
    return !!post
  } else {
    const activity = await prisma.activity.findUnique({
      where: { id: targetId },
      select: { id: true },
    })
    return !!activity
  }
}

/**
 * 获取评论计数
 *
 * 注意：根据软删除可见性策略，计数包含软删除的评论。
 * 这确保了用户看到的评论数量（含占位符）与计数器显示的数字一致。
 */
export async function getCommentCount(
  targetType: CommentTargetType,
  targetId: string
): Promise<number> {
  return prisma.comment.count({
    where: {
      ...(targetType === "post" ? { postId: targetId } : { activityId: targetId }),
      // 不过滤 deletedAt：计数包含软删除评论
    },
  })
}

export type PrismaCommentWithAuthor = Comment & {
  author?: Pick<User, "id" | "name" | "avatarUrl" | "email" | "role"> | null
  _count?: {
    replies?: number
  } | null
}

/**
 * 组装回复到对应的顶层评论
 *
 * 将回复列表按 parentId 分组，然后附加到对应的顶层评论上。
 * 同时更新每个评论的 _count.replies 为实际回复数量。
 *
 * @param topLevelComments - 顶层评论列表
 * @param replies - 所有回复的列表
 * @returns 包含回复的评论列表
 */
function assembleReplies(
  topLevelComments: CommentWithAuthor[],
  replies: PrismaCommentWithAuthor[]
): CommentWithAuthor[] {
  // 按 parentId 分组回复
  const repliesMap = new Map<string, CommentWithAuthor[]>()

  replies.forEach((reply) => {
    if (!reply.parentId) {
      return
    }

    const formattedReply = formatComment(reply)
    if (!repliesMap.has(reply.parentId)) {
      repliesMap.set(reply.parentId, [])
    }
    repliesMap.get(reply.parentId)!.push(formattedReply)
  })

  // 将回复附加到对应的顶层评论
  return topLevelComments.map((comment) => {
    const mappedReplies = repliesMap.get(comment.id) || []
    return {
      ...comment,
      replies: mappedReplies,
      _count: {
        replies: Math.max(comment._count?.replies ?? 0, mappedReplies.length),
      },
    }
  })
}

function resolveCommentTarget(comment: PrismaCommentWithAuthor): {
  targetType: CommentTargetType
  targetId: string
} {
  if (comment.postId) {
    return {
      targetType: "post",
      targetId: comment.postId,
    }
  }

  if (comment.activityId) {
    return {
      targetType: "activity",
      targetId: comment.activityId,
    }
  }

  throw new CommentServiceError(
    CommentErrorCode.TARGET_MISSING_REFERENCE,
    "Comment missing target reference",
    500,
    {
      commentId: comment.id,
    }
  )
}

/**
 * 格式化评论对象，处理软删除占位符
 *
 * 将数据库评论记录转换为 API DTO：
 * - 软删除评论：替换 content 为 "[该评论已删除]"，设置 isDeleted=true
 * - 正常评论：保持原始 content，设置 isDeleted=false
 *
 * @internal 导出仅用于单元测试
 */
export function formatComment(comment: PrismaCommentWithAuthor): CommentWithAuthor {
  const isDeleted = Boolean(comment.deletedAt)
  const { targetType, targetId } = resolveCommentTarget(comment)
  const repliesCount = comment._count?.replies ?? 0

  return {
    ...comment,
    content: isDeleted ? "[该评论已删除]" : comment.content,
    author: comment.author ?? null,
    isDeleted,
    targetType,
    targetId,
    _count: {
      replies: repliesCount,
    },
    childrenCount: repliesCount,
    replies: undefined,
  }
}
