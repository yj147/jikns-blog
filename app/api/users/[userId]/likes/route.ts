import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { generateRequestId } from "@/lib/auth/session"
import type { Prisma } from "@/lib/generated/prisma"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

interface ActivityLikeItem {
  type: "activity"
  likedAt: string
  activity: {
    id: string
    authorId: string
    content: string
    imageUrls: string[]
    isPinned: boolean
    likesCount: number
    commentsCount: number
    viewsCount: number
    createdAt: string
    updatedAt: string
    author: {
      id: string
      name: string | null
      avatarUrl: string | null
      role: "USER" | "ADMIN"
      status: string | null
    }
    isLiked?: boolean
  }
}

interface PostLikeItem {
  type: "post"
  likedAt: string
  post: {
    id: string
    slug: string
    title: string
    excerpt: string | null
    published: boolean
    isPinned: boolean
    coverImage: string | null
    viewCount: number
    publishedAt: string | null
    createdAt: string
    author: {
      id: string
      name: string | null
      avatarUrl: string | null
    }
    tags: Array<{
      id: string
      name: string
      slug: string
      color: string | null
    }>
    stats: {
      commentsCount: number
      likesCount: number
      bookmarksCount: number
    }
    contentLength: number
  }
}

type LikeResponseItem = ActivityLikeItem | PostLikeItem

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const likeInclude = {
  activity: {
    select: {
      id: true,
      authorId: true,
      content: true,
      imageUrls: true,
      isPinned: true,
      likesCount: true,
      commentsCount: true,
      viewsCount: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
        },
      },
    },
  },
  post: {
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      published: true,
      isPinned: true,
      coverImage: true,
      viewCount: true,
      publishedAt: true,
      createdAt: true,
      content: true,
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
              color: true,
            },
          },
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
          bookmarks: true,
        },
      },
    },
  },
} satisfies Prisma.LikeInclude

type LikeWithRelations = Prisma.LikeGetPayload<{ include: typeof likeInclude }>

function mapActivityLike(
  activity: NonNullable<LikeWithRelations["activity"]>,
  likedAt: Date,
  likedByOwner: boolean
): ActivityLikeItem {
  return {
    type: "activity",
    likedAt: likedAt.toISOString(),
    activity: {
      id: activity.id,
      authorId: activity.authorId,
      content: activity.content,
      imageUrls: activity.imageUrls ?? [],
      isPinned: activity.isPinned ?? false,
      likesCount: activity.likesCount ?? 0,
      commentsCount: activity.commentsCount ?? 0,
      viewsCount: activity.viewsCount ?? 0,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      author: {
        id: activity.author?.id ?? "",
        name: activity.author?.name ?? null,
        avatarUrl: activity.author?.avatarUrl ?? null,
        role: activity.author?.role === "ADMIN" ? "ADMIN" : "USER",
        status: activity.author?.status ?? null,
      },
      isLiked: likedByOwner,
    },
  }
}

function mapPostLike(
  post: NonNullable<LikeWithRelations["post"]>,
  likedAt: Date
): PostLikeItem {
  const tags =
    post.tags
      ?.map((relation) => relation.tag)
      .filter((tag): tag is { id: string; name: string; slug: string; color: string | null } => !!tag)
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color ?? null,
      })) ?? []

  return {
    type: "post",
    likedAt: likedAt.toISOString(),
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      published: post.published,
      isPinned: post.isPinned,
      coverImage: post.coverImage,
      viewCount: post.viewCount ?? 0,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      author: {
        id: post.author?.id ?? "",
        name: post.author?.name ?? null,
        avatarUrl: post.author?.avatarUrl ?? null,
      },
      tags,
      stats: {
        commentsCount: post._count?.comments ?? 0,
        likesCount: post._count?.likes ?? 0,
        bookmarksCount: post._count?.bookmarks ?? 0,
      },
      contentLength: post.content?.length ?? 0,
    },
  }
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
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT)
    const skip = (page - 1) * limit

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!userExists) {
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

    const where = {
      authorId: userId,
      OR: [
        { activity: { is: { deletedAt: null } } },
        { post: { is: { published: true } } },
      ],
    }

    const [likes, total] = await Promise.all([
      prisma.like.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: likeInclude,
      }),
      prisma.like.count({ where }),
    ])

    const data: LikeResponseItem[] = likes
      .map((like) => {
        if (like.activity) {
          return mapActivityLike(like.activity, like.createdAt, like.authorId === userId)
        }
        if (like.post) {
          return mapPostLike(like.post, like.createdAt)
        }
        return null
      })
      .filter((item): item is LikeResponseItem => Boolean(item))

    const hasMore = page * limit < total

    apiLogger.info("user likes fetched", {
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
    apiLogger.error("user likes fetch failed", { requestId }, error)

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "获取点赞列表失败",
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
