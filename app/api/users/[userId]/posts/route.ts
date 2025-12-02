import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { generateRequestId } from "@/lib/auth/session"
import { calculateReadingMinutes } from "@/lib/utils/reading-time"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { createSignedUrlIfNeeded } from "@/lib/storage/signed-url"

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const POST_IMAGE_SIGN_EXPIRES_IN = 60 * 60

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
      published: true,
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!userExists) {
      apiLogger.info("user posts requested for unknown user", { requestId, userId })

      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      })
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          publishedAt: true,
          createdAt: true,
          viewCount: true,
          content: true,
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
      prisma.post.count({ where }),
    ])

    const signedCoverImages = await Promise.all(
      posts.map((post) =>
        createSignedUrlIfNeeded(post.coverImage, POST_IMAGE_SIGN_EXPIRES_IN, "post-images")
      )
    )

    const normalizedPosts = posts.map((post, index) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      signedCoverImage: signedCoverImages[index],
      publishedAt: (post.publishedAt ?? post.createdAt)?.toISOString() ?? null,
      viewCount: post.viewCount,
      readTimeMinutes: calculateReadingMinutes(post.content),
      tags: post.tags
        .map((relation) => relation.tag)
        .filter(
          (tag): tag is { id: string; name: string; slug: string } =>
            Boolean(tag?.id && tag?.name)
        ),
      _count: post._count,
    }))

    const hasMore = page * limit < total

    apiLogger.info("user posts fetched", {
      requestId,
      userId,
      page,
      limit,
      total,
      returned: posts.length,
    })

    return NextResponse.json({
      success: true,
      data: normalizedPosts,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    })
  } catch (error) {
    apiLogger.error("user posts fetch failed", { requestId }, error)

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "获取用户文章失败",
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
