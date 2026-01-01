/**
 * 通用评论服务
 * 为文章和动态提供统一的评论功能
 *
 * ============================================================================
 * 软删除可见性策略（2025-11 更新）
 * ============================================================================
 *
 * 自 2025-11 起，评论采用“软删除隐藏”策略：
 *
 * 1. **核心原则**：
 *    - 软删除评论会被 `deletedAt` 标记，但不会再向客户端返回
 *    - API 仍暴露 `isDeleted` 字段用于内部审计
 *    - commentsCount 仍包含软删除记录，保持与历史数据一致
 *
 * 2. **实现细节**：
 *    - `listComments`：默认过滤 `deletedAt != null` 的记录
 *    - `formatComment`：只设置 `isDeleted`，不再修改 `content`
 *    - `deleteComment`：有回复时软删（仅写 `deletedAt`），无回复时硬删
 *    - 数据库触发器：仍只在 INSERT/DELETE 时更新计数
 *
 * 3. **设计理由**：
 *    - 用户期望删除后彻底消失，避免“占位符”影响体验
 *    - 仍保留软删除以避免删除有回复的节点导致计数错乱
 *    - 权限审计依旧可通过 `isDeleted`/`deletedAt` 追踪操作
 *
 * 4. **影响范围**：
 *    - API：软删除评论不再出现在列表响应，但 `isDeleted` 字段保留
 *    - 计数器：`Activity.commentsCount` 继续包含软删除，避免突然跳变
 *    - 测试：更新 `formatComment` 及列表相关断言以符合新策略
 *
 * ============================================================================
 */

import { prisma } from "@/lib/prisma"
import { cleanXSS } from "@/lib/security/xss-cleaner"
import type { Comment, User, Prisma } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"
import type { CommentTargetType } from "@/lib/dto/comments.dto"
import { notify } from "@/lib/services/notification"
import { createSignedUrls } from "@/lib/storage/signed-url"

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
  author: Pick<User, "id" | "name" | "avatarUrl"> | null
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
 * 4. 返回父评论作者 ID 供通知复用
 *
 * @throws {CommentServiceError} 如果验证失败
 */
async function validateParentComment(
  parentId: string,
  targetType: CommentTargetType,
  targetId: string
): Promise<string> {
  const parentComment = await prisma.comment.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      postId: true,
      activityId: true,
      deletedAt: true,
      authorId: true,
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

  return parentComment.authorId
}

export async function createComment(data: CreateCommentData): Promise<CommentWithAuthor> {
  try {
    // XSS 清理
    const cleanContent = cleanXSS(data.content)

    // 验证目标是否存在
    const targetOwnerId = await validateCommentTarget(data.targetType, data.targetId)
    if (!targetOwnerId) {
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

    let parentAuthorId: string | null = null

    // 如果是回复，验证父评论
    if (data.parentId) {
      parentAuthorId = await validateParentComment(data.parentId, data.targetType, data.targetId)
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

    if (targetOwnerId && targetOwnerId !== data.authorId) {
      await notify(targetOwnerId, "COMMENT", {
        actorId: data.authorId,
        commentId: comment.id,
        // 必须传递 postId 或 activityId 作为通知目标
        postId: data.targetType === "post" ? data.targetId : null,
        activityId: data.targetType === "activity" ? data.targetId : null,
      })
    }

    if (
      data.parentId &&
      parentAuthorId &&
      parentAuthorId !== data.authorId &&
      parentAuthorId !== targetOwnerId
    ) {
      await notify(parentAuthorId, "COMMENT", {
        actorId: data.authorId,
        commentId: comment.id,
        postId: data.targetType === "post" ? data.targetId : null,
        activityId: data.targetType === "activity" ? data.targetId : null,
      })

      logger.info("父评论作者通知发送成功", {
        commentId: comment.id,
        parentAuthorId,
      })
    }

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
export async function listComments(options: CommentQueryOptions): Promise<{
  comments: CommentWithAuthor[]
  hasMore: boolean
  nextCursor?: string
  totalCount: number
}> {
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

    const where: Prisma.CommentWhereInput = {
      ...baseWhere,
      deletedAt: null,
      ...(isFetchingReplies ? { parentId } : { parentId: null }),
    }

    const orderBy: Prisma.CommentOrderByWithRelationInput[] = isFetchingReplies
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "desc" }]

    // 计数必须过滤软删除回复，避免前端展开按钮误判
    const include: Prisma.CommentInclude = {
      _count: {
        select: {
          replies: {
            where: { deletedAt: null },
          },
        },
      },
    }

    if (includeAuthor) {
      include.author = {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
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

    const totalCountPromise = isFetchingReplies
      ? Promise.resolve(0)
      : prisma.comment.count({
          where: {
            ...baseWhere,
            deletedAt: null,
            OR: [
              { parentId: null },
              {
                parentId: { not: null },
                parent: {
                  ...baseWhere,
                  deletedAt: null,
                },
              },
            ],
          },
        })

    const [totalCount, comments] = await Promise.all([
      totalCountPromise,
      prisma.comment.findMany(queryOptions),
    ])

    // 处理分页
    const hasMore = comments.length > limit
    if (hasMore) {
      comments.pop() // 移除多余的一条
    }

    const nextCursor = hasMore ? comments[comments.length - 1]?.id : undefined

    // 批量查询未删除回复的实际计数（修复展开回复问题）
    let actualRepliesCounts: Record<string, number> = {}
    if (!isFetchingReplies && comments.length > 0) {
      const commentIds = comments.map((c) => c.id)
      const repliesCountResult = await prisma.comment.groupBy({
        by: ["parentId"],
        where: {
          parentId: { in: commentIds },
          deletedAt: null, // 只统计未删除的回复
        },
        _count: {
          id: true,
        },
      })

      actualRepliesCounts = commentIds.reduce<Record<string, number>>((acc, id) => {
        acc[id] = 0
        return acc
      }, {})

      repliesCountResult.forEach((item) => {
        actualRepliesCounts[item.parentId!] = item._count.id
      })
    }

    // 格式化顶层评论（使用实际回复计数）
    let commentsWithReplies: CommentWithAuthor[] = (comments as PrismaCommentWithAuthor[]).map(
      (comment) => formatComment(comment, actualRepliesCounts[comment.id])
    )

    // 如果需要包含回复，批量获取并组装
    if (!isFetchingReplies && includeReplies && comments.length > 0) {
      const commentIds = comments.map((c) => c.id)
      const replies = await prisma.comment.findMany({
        where: {
          parentId: { in: commentIds },
          deletedAt: null,
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

    const commentsWithSignedAvatars = await signCommentAuthors(commentsWithReplies)

    return {
      comments: commentsWithSignedAvatars,
      hasMore,
      nextCursor,
      totalCount,
    }
  } catch (error) {
    logger.error("获取评论列表失败", error)
    throw error
  }
}

async function signCommentAuthors(comments: CommentWithAuthor[]): Promise<CommentWithAuthor[]> {
  if (comments.length === 0) return comments

  const avatarInputs = new Set<string>()
  const collectAvatars = (items: CommentWithAuthor[]) => {
    for (const item of items) {
      const avatarUrl = item.author?.avatarUrl
      if (typeof avatarUrl === "string" && avatarUrl.length > 0) {
        avatarInputs.add(avatarUrl)
      }
      if (item.replies && item.replies.length > 0) {
        collectAvatars(item.replies)
      }
    }
  }
  collectAvatars(comments)

  const inputs = [...avatarInputs]
  if (inputs.length === 0) return comments

  const signed = await createSignedUrls(inputs)
  const signedMap = new Map<string, string>()
  inputs.forEach((original, index) => {
    signedMap.set(original, signed[index] ?? original)
  })

  const applySignedAvatars = (items: CommentWithAuthor[]): CommentWithAuthor[] => {
    return items.map((item) => {
      const authorAvatarUrl = item.author?.avatarUrl
      const signedAvatar =
        typeof authorAvatarUrl === "string" ? signedMap.get(authorAvatarUrl) : undefined
      return {
        ...item,
        author: item.author
          ? { ...item.author, avatarUrl: signedAvatar ?? item.author.avatarUrl }
          : null,
        replies: item.replies ? applySignedAvatars(item.replies) : undefined,
      }
    })
  }

  return applySignedAvatars(comments)
}

/**
 * 删除评论
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<{ targetType: CommentTargetType; targetId: string }> {
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

    const target = resolveCommentTarget(comment)

    // 获取目标信息用于更新计数
    // 软删除：如果有回复，只清空内容
    const hasReplies =
      (await prisma.comment.count({
        where: { parentId: commentId },
      })) > 0

    if (hasReplies) {
      // 软删除：如果有回复，只设置 deletedAt
      // 列表查询会过滤掉 deletedAt 非空的记录
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

    return target
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
): Promise<string | null> {
  if (targetType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: targetId },
      select: { id: true, authorId: true },
    })
    return post?.authorId ?? null
  } else {
    const activity = await prisma.activity.findUnique({
      where: { id: targetId },
      select: { id: true, authorId: true },
    })
    return activity?.authorId ?? null
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
  author?: Pick<User, "id" | "name" | "avatarUrl"> | null
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

type CommentTargetReference = Pick<Comment, "id" | "postId" | "activityId">

function resolveCommentTarget(comment: CommentTargetReference): {
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
 * 格式化评论对象
 *
 * 将数据库评论记录转换为 API DTO：
 * - 软删除评论：仅设置 isDeleted=true（保留原始 content 以供审计）
 * - 正常评论：保持原始 content，isDeleted=false
 *
 * @param comment 数据库评论记录
 * @param actualRepliesCount 可选的实际回复计数（未删除的），覆盖 _count.replies
 * @internal 导出仅用于单元测试
 */
export function formatComment(
  comment: PrismaCommentWithAuthor,
  actualRepliesCount?: number
): CommentWithAuthor {
  const isDeleted = Boolean(comment.deletedAt)
  const { targetType, targetId } = resolveCommentTarget(comment)
  // 优先使用传入的实际计数，否则使用 Prisma _count
  const repliesCount = actualRepliesCount ?? comment._count?.replies ?? 0

  return {
    ...comment,
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
