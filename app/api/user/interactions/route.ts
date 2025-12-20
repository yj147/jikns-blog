/**
 * 用户互动 API
 * 提供点赞、评论、关注、收藏等社交功能
 */

import { NextRequest } from "next/server"
import { withApiAuth, createSuccessResponse, createErrorResponse } from "@/lib/api-guards"
import { prisma } from "@/lib/prisma"
import { XSSProtection } from "@/lib/security"
import type { AuthenticatedUser } from "@/lib/auth/session"
import { UserStatus, Role } from "@/lib/generated/prisma"
import { ActivityPermissions } from "@/lib/permissions/activity-permissions"
import { logger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

/**
 * 处理点赞/取消点赞
 */
async function handleLikeHandler(request: NextRequest, user: AuthenticatedUser, parsedBody?: any) {
  try {
    const body = parsedBody ?? (await request.json())
    const { targetType, targetId, action } = body

    // 验证输入
    if (!targetType || !targetId || !action || !["like", "unlike"].includes(action)) {
      return createErrorResponse(
        "参数错误：目标类型、目标ID和操作是必需的",
        "INVALID_PARAMETERS",
        400
      )
    }

    if (!["POST", "ACTIVITY"].includes(targetType)) {
      return createErrorResponse("不支持的目标类型", "UNSUPPORTED_TARGET_TYPE", 400)
    }

    // 验证目标是否存在并进行权限校验
    if (targetType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: targetId, published: true },
        select: {
          id: true,
          authorId: true,
          published: true,
          author: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      })

      if (!post) {
        return createErrorResponse("目标内容不存在", "TARGET_NOT_FOUND", 404)
      }

      if (post.authorId === user.id) {
        return createErrorResponse("不能给自己的内容点赞", "CANNOT_LIKE_SELF", 400)
      }

      if (post.author?.status && post.author.status !== UserStatus.ACTIVE) {
        return createErrorResponse("作者状态异常，无法点赞", "AUTHOR_INACTIVE", 403)
      }
    } else {
      const activity = await prisma.activity.findUnique({
        where: { id: targetId, deletedAt: null },
        select: {
          id: true,
          authorId: true,
          deletedAt: true,
          isPinned: true,
          author: {
            select: {
              id: true,
              status: true,
              role: true,
            },
          },
        },
      })

      if (!activity) {
        return createErrorResponse("目标内容不存在", "TARGET_NOT_FOUND", 404)
      }

      const permissionSubject = {
        id: activity.id,
        authorId: activity.authorId,
        deletedAt: activity.deletedAt,
        isPinned: activity.isPinned ?? false,
        author: {
          id: activity.author?.id ?? activity.authorId,
          status: activity.author?.status ?? UserStatus.ACTIVE,
          role: activity.author?.role ?? Role.USER,
        },
      }

      if (!ActivityPermissions.canLike(user, permissionSubject)) {
        const code = user.id === activity.authorId ? "CANNOT_LIKE_SELF" : "LIKE_NOT_ALLOWED"
        const message = code === "CANNOT_LIKE_SELF" ? "不能给自己的内容点赞" : "当前动态无法点赞"
        return createErrorResponse(message, code, code === "CANNOT_LIKE_SELF" ? 400 : 403)
      }
    }

    // 检查是否已经点赞
    const existingLike = await prisma.like.findFirst({
      where: {
        authorId: user.id,
        ...(targetType === "POST" ? { postId: targetId } : { activityId: targetId }),
      },
    })

    if (action === "like") {
      // 点赞操作
      if (existingLike) {
        return createErrorResponse("您已经点赞过了", "ALREADY_LIKED", 409)
      }

      const newLike = await prisma.like.create({
        data: {
          authorId: user.id,
          ...(targetType === "POST" ? { postId: targetId } : { activityId: targetId }),
        },
      })

      // 获取最新的点赞数量
      const likeCount = await prisma.like.count({
        where: {
          ...(targetType === "POST" ? { postId: targetId } : { activityId: targetId }),
        },
      })

      return createSuccessResponse(
        {
          action: "liked",
          likeId: newLike.id,
          likeCount,
          targetType,
          targetId,
        },
        user
      )
    } else {
      // 取消点赞操作
      if (!existingLike) {
        return createErrorResponse("您还没有点赞", "NOT_LIKED_YET", 409)
      }

      await prisma.like.delete({
        where: { id: existingLike.id },
      })

      // 获取最新的点赞数量
      const likeCount = await prisma.like.count({
        where: {
          ...(targetType === "POST" ? { postId: targetId } : { activityId: targetId }),
        },
      })

      return createSuccessResponse(
        {
          action: "unliked",
          likeCount,
          targetType,
          targetId,
        },
        user
      )
    }
  } catch (error) {
    logger.error(
      "处理点赞失败",
      { module: "api/user/interactions", action: "like", userId: user.id },
      error
    )
    return createErrorResponse("处理点赞失败", "HANDLE_LIKE_FAILED", 500)
  }
}

/**
 * 处理关注/取消关注
 */
async function handleFollowHandler(
  request: NextRequest,
  user: AuthenticatedUser,
  parsedBody?: any
) {
  try {
    const body = parsedBody ?? (await request.json())
    const { targetUserId, action } = body

    // 验证输入
    if (!targetUserId || !action || !["follow", "unfollow"].includes(action)) {
      return createErrorResponse("参数错误：目标用户ID和操作是必需的", "INVALID_PARAMETERS", 400)
    }

    // 防止用户关注自己
    if (targetUserId === user.id) {
      return createErrorResponse("不能关注自己", "CANNOT_FOLLOW_SELF", 400)
    }

    // 验证目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId, status: "ACTIVE" },
      select: { id: true, email: true, name: true },
    })

    if (!targetUser) {
      return createErrorResponse("目标用户不存在或已被封禁", "TARGET_USER_NOT_FOUND", 404)
    }

    // 检查是否已经关注
    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: user.id,
        followingId: targetUserId,
      },
    })

    if (action === "follow") {
      // 关注操作
      if (existingFollow) {
        return createErrorResponse("您已经关注过该用户了", "ALREADY_FOLLOWING", 409)
      }

      await prisma.follow.create({
        data: {
          followerId: user.id,
          followingId: targetUserId,
        },
      })

      // 获取最新的关注者数量
      const followerCount = await prisma.follow.count({
        where: { followingId: targetUserId },
      })

      return createSuccessResponse(
        {
          action: "followed",
          targetUser,
          followerCount,
        },
        user
      )
    } else {
      // 取消关注操作
      if (!existingFollow) {
        return createErrorResponse("您还没有关注该用户", "NOT_FOLLOWING_YET", 409)
      }

      await prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: targetUserId,
          },
        },
      })

      // 获取最新的关注者数量
      const followerCount = await prisma.follow.count({
        where: { followingId: targetUserId },
      })

      return createSuccessResponse(
        {
          action: "unfollowed",
          targetUser,
          followerCount,
        },
        user
      )
    }
  } catch (error) {
    logger.error(
      "处理关注失败",
      { module: "api/user/interactions", action: "follow", userId: user.id },
      error
    )
    return createErrorResponse("处理关注失败", "HANDLE_FOLLOW_FAILED", 500)
  }
}

/**
 * 处理收藏/取消收藏
 */
async function handleBookmarkHandler(
  request: NextRequest,
  user: AuthenticatedUser,
  parsedBody?: any
) {
  try {
    const body = parsedBody ?? (await request.json())
    const { postId, action } = body

    // 验证输入
    if (!postId || !action || !["bookmark", "unbookmark"].includes(action)) {
      return createErrorResponse("参数错误：文章ID和操作是必需的", "INVALID_PARAMETERS", 400)
    }

    // 验证文章是否存在且已发布
    const post = await prisma.post.findUnique({
      where: { id: postId, published: true },
      select: { id: true, title: true, authorId: true },
    })

    if (!post) {
      return createErrorResponse("文章不存在或未发布", "POST_NOT_FOUND", 404)
    }

    // 检查是否已经收藏
    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        userId: user.id,
        postId: postId,
      },
    })

    if (action === "bookmark") {
      // 收藏操作
      if (existingBookmark) {
        return createErrorResponse("您已经收藏过这篇文章了", "ALREADY_BOOKMARKED", 409)
      }

      const newBookmark = await prisma.bookmark.create({
        data: {
          userId: user.id,
          postId: postId,
        },
      })

      // 获取最新的收藏数量
      const bookmarkCount = await prisma.bookmark.count({
        where: { postId: postId },
      })

      return createSuccessResponse(
        {
          action: "bookmarked",
          bookmarkId: newBookmark.id,
          post: { id: post.id, title: post.title },
          bookmarkCount,
        },
        user
      )
    } else {
      // 取消收藏操作
      if (!existingBookmark) {
        return createErrorResponse("您还没有收藏这篇文章", "NOT_BOOKMARKED_YET", 409)
      }

      await prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      })

      // 获取最新的收藏数量
      const bookmarkCount = await prisma.bookmark.count({
        where: { postId: postId },
      })

      return createSuccessResponse(
        {
          action: "unbookmarked",
          post: { id: post.id, title: post.title },
          bookmarkCount,
        },
        user
      )
    }
  } catch (error) {
    logger.error(
      "处理收藏失败",
      { module: "api/user/interactions", action: "bookmark", userId: user.id },
      error
    )
    return createErrorResponse("处理收藏失败", "HANDLE_BOOKMARK_FAILED", 500)
  }
}

/**
 * 主路由处理器
 */
async function interactionHandler(request: NextRequest, user: AuthenticatedUser) {
  const body = await request.json()
  const { type } = body

  switch (type) {
    case "like":
      return handleLikeHandler(request, user, body)
    case "follow":
      return handleFollowHandler(request, user, body)
    case "bookmark":
      return handleBookmarkHandler(request, user, body)
    default:
      return createErrorResponse("不支持的互动类型", "UNSUPPORTED_INTERACTION_TYPE", 400)
  }
}

// 导出 HTTP 方法处理器
const postHandler = withApiAuth(interactionHandler, "auth")
export const POST = withApiResponseMetrics(postHandler)

// 处理 CORS 预检请求
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}
