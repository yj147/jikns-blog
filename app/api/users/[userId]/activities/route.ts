import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { generateRequestId } from "@/lib/auth/session"
import { signActivityImages, signAvatarUrl } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()

  try {
    const { userId } = await params
    const searchParams = request.nextUrl.searchParams

    const page = parsePositiveInt(searchParams.get("page"), 1)
    const limit = parsePositiveInt(searchParams.get("limit"), 10)
    const skip = (page - 1) * limit

    const where = {
      authorId: userId,
      deletedAt: null as Date | null,
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          imageUrls: true,
          isPinned: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
        },
      }),
      prisma.activity.count({ where }),
    ])

    const data = await Promise.all(
      activities.map(async (activity) => {
        const [signedImages, signedAvatar] = await Promise.all([
          signActivityImages(activity.imageUrls),
          signAvatarUrl(activity.author.avatarUrl),
        ])

        return {
          id: activity.id,
          content: activity.content,
          imageUrls: signedImages,
          tags: activity.tags
            .map(({ tag }) => tag)
            .filter((tag): tag is { id: string; name: string; slug: string } => Boolean(tag)),
          pinned: activity.isPinned,
          createdAt: activity.createdAt,
          author: {
            id: activity.author.id,
            name: activity.author.name,
            image: signedAvatar ?? activity.author.avatarUrl,
          },
          _count: activity._count,
        }
      })
    )

    const hasMore = page * limit < total

    apiLogger.info("user activities fetched", {
      requestId,
      userId,
      page,
      limit,
      total,
      returned: data.length,
    })

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    })
  } catch (error) {
    apiLogger.error("user activities fetch failed", { requestId }, error)

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "获取用户动态失败",
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
