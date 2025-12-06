import { NextRequest } from "next/server"
import { validateApiPermissions } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { logger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { signAvatarUrl } from "@/lib/storage/signed-url"

interface AdminStatsPayload {
  totals: {
    users: number
    posts: number
    comments: number
    activities: number
  }
  summary: {
    activeUsers: number
    bannedUsers: number
    adminUsers: number
    draftPosts: number
  }
  trends: {
    newUsers7d: number
    newPosts7d: number
    newComments7d: number
    newActivities7d: number
  }
  topPosts: Array<{
    id: string
    title: string
    authorName: string | null
    viewCount: number
    comments: number
    likes: number
    createdAt: string
  }>
  recentActivities: Array<{
    id: string
    content: string
    authorName: string | null
    authorAvatar: string | null
    createdAt: string
    likes: number
    comments: number
  }>
  pending: {
    reviewPosts: number
    bannedUsers: number
  }
  generatedAt: string
}

async function handleGet(request: NextRequest) {
  const { success, error, user } = await validateApiPermissions(request, "admin")

  if (!success || !user) {
    const status = error?.statusCode ?? 403
    return createErrorResponse(
      error?.code ?? ErrorCode.FORBIDDEN,
      error?.message || "无权访问管理统计",
      undefined,
      status
    )
  }

  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      adminUsers,
      totalPosts,
      draftPosts,
      totalComments,
      totalActivities,
      newUsers7d,
      newPosts7d,
      newComments7d,
      newActivities7d,
      topPostsRaw,
      recentActivitiesRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "BANNED" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.post.count(),
      prisma.post.count({ where: { published: false } }),
      prisma.comment.count(),
      prisma.activity.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.post.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.comment.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.activity.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.post.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          createdAt: true,
          author: { select: { name: true } },
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { viewCount: "desc" },
        take: 5,
      }),
      prisma.activity.findMany({
        select: {
          id: true,
          content: true,
          createdAt: true,
          likesCount: true,
          commentsCount: true,
          author: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ])

    const payload: AdminStatsPayload = {
      totals: {
        users: totalUsers,
        posts: totalPosts,
        comments: totalComments,
        activities: totalActivities,
      },
      summary: {
        activeUsers,
        bannedUsers,
        adminUsers,
        draftPosts,
      },
      trends: {
        newUsers7d,
        newPosts7d,
        newComments7d,
        newActivities7d,
      },
      topPosts: topPostsRaw.map((post) => ({
        id: post.id,
        title: post.title,
        authorName: post.author?.name ?? "匿名",
        viewCount: post.viewCount,
        comments: post._count.comments,
        likes: post._count.likes,
        createdAt: post.createdAt.toISOString(),
      })),
      recentActivities: await Promise.all(
        recentActivitiesRaw.map(async (activity) => ({
          id: activity.id,
          content: activity.content,
          authorName: activity.author?.name ?? "匿名",
          authorAvatar: await signAvatarUrl(activity.author?.avatarUrl ?? null),
          createdAt: activity.createdAt.toISOString(),
          likes: activity.likesCount,
          comments: activity.commentsCount,
        }))
      ),
      pending: {
        reviewPosts: draftPosts,
        bannedUsers,
      },
      generatedAt: now.toISOString(),
    }

    return createSuccessResponse(payload)
  } catch (err) {
    logger.error("获取管理统计数据失败", { module: "api/admin/stats", adminId: user.id }, err)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取管理统计数据失败")
  }
}

export const GET = withApiResponseMetrics(handleGet)
