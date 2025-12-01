import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"

export interface QuickStats {
  monthlyPosts: number
  totalViews: number
  totalLikes: number
  totalComments: number
}

export const EMPTY_QUICK_STATS: QuickStats = {
  monthlyPosts: 0,
  totalViews: 0,
  totalLikes: 0,
  totalComments: 0,
}

export async function getQuickStats(userId: string): Promise<QuickStats> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  try {
    const [monthlyPosts, viewAggregate, totalLikes, totalComments] = await Promise.all([
      prisma.post.count({
        where: {
          authorId: userId,
          publishedAt: {
            gte: monthStart,
          },
        },
      }),
      prisma.post.aggregate({
        where: { authorId: userId },
        _sum: {
          viewCount: true,
        },
      }),
      prisma.like.count({
        where: {
          post: {
            authorId: userId,
          },
        },
      }),
      prisma.comment.count({
        where: {
          deletedAt: null,
          post: {
            authorId: userId,
          },
        },
      }),
    ])

    return {
      monthlyPosts,
      totalViews: viewAggregate._sum.viewCount ?? 0,
      totalLikes,
      totalComments,
    }
  } catch (error) {
    logger.error(
      "Failed to load quick stats",
      { module: "profile:stats", userId },
      error instanceof Error ? error : new Error(String(error))
    )
    return { ...EMPTY_QUICK_STATS }
  }
}
