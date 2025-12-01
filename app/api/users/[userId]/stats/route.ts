import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { generateRequestId } from "@/lib/auth/session"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()
  let userId: string | undefined

  try {
    const routeParams = await params
    userId = routeParams.userId

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!userExists) {
      apiLogger.info("user stats requested for unknown user", { requestId, userId })

      return NextResponse.json({
        success: true,
        data: {
          followers: 0,
          following: 0,
          posts: 0,
          activities: 0,
        },
      })
    }

    const [followers, following, posts, activities] = await Promise.all([
      prisma.follow.count({
        where: {
          followingId: userId,
        },
      }),
      prisma.follow.count({
        where: {
          followerId: userId,
        },
      }),
      prisma.post.count({
        where: {
          authorId: userId,
          published: true,
        },
      }),
      prisma.activity.count({
        where: {
          authorId: userId,
          deletedAt: null as Date | null,
        },
      }),
    ])

    apiLogger.info("user stats fetched", {
      requestId,
      userId,
      followers,
      following,
      posts,
      activities,
    })

    return NextResponse.json({
      success: true,
      data: {
        followers,
        following,
        posts,
        activities,
      },
    })
  } catch (error) {
    apiLogger.error("user stats fetch failed", { requestId, userId }, error)

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "获取用户统计失败",
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
