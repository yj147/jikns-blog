import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { generateRequestId } from "@/lib/auth/session"
import { calculateReadingMinutes } from "@/lib/utils/reading-time"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { createSignedUrls } from "@/lib/storage/signed-url"

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
  const totalStart = performance.now()

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

    const dbStart = performance.now()
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          publishedAt: true,
          createdAt: true,
          viewCount: true,
          contentTokens: true,
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
    const dbMs = performance.now() - dbStart

    const coverInputs = Array.from(
      new Set(
        posts
          .map((post) => post.coverImage)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    const signStart = performance.now()
    const signedCoverImages =
      coverInputs.length > 0
        ? await createSignedUrls(coverInputs, POST_IMAGE_SIGN_EXPIRES_IN, "post-images")
        : []
    const signMs = performance.now() - signStart

    const coverMap = new Map<string, string>()
    coverInputs.forEach((original, index) => {
      coverMap.set(original, signedCoverImages[index] ?? original)
    })

    const normalizedPosts = posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      signedCoverImage: post.coverImage ? (coverMap.get(post.coverImage) ?? post.coverImage) : null,
      publishedAt: (post.publishedAt ?? post.createdAt)?.toISOString() ?? null,
      viewCount: post.viewCount,
      readTimeMinutes: calculateReadingMinutes(post.contentTokens ?? post.excerpt ?? post.title),
      tags: post.tags
        .map((relation) => relation.tag)
        .filter((tag): tag is { id: string; name: string; slug: string } =>
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

    const response = NextResponse.json({
      success: true,
      data: normalizedPosts,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    })
    const totalMs = performance.now() - totalStart
    response.headers.set(
      "Server-Timing",
      `db;dur=${dbMs.toFixed(1)}, sign;dur=${signMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`
    )
    response.headers.set("x-perf-db-ms", dbMs.toFixed(1))
    response.headers.set("x-perf-sign-ms", signMs.toFixed(1))
    response.headers.set("x-perf-total-ms", totalMs.toFixed(1))
    return response
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
