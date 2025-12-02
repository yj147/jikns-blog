import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import type { AuthenticatedUser } from "@/lib/auth/session"
import {
  ActivityWithAuthor,
  activityQuerySchema,
  activityCreateSchema,
  type ActivityWithAuthorForPermission,
  type ActivityQueryParams,
} from "@/types/activity"
import {
  createSuccessResponse,
  createErrorResponse,
  ErrorCode,
  type PaginationMeta,
} from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { listActivities, type ActivityListItem } from "@/lib/repos/activity-repo"
import { getBatchLikeStatus } from "@/lib/interactions/likes"
import { ActivityPermissions } from "@/lib/permissions/activity-permissions"
import { rateLimitCheckForAction } from "@/lib/rate-limit/activity-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { extractActivityHashtags, syncActivityTags } from "@/lib/services/activity-tags"
import { getActivityFixture, shouldUseFixtureExplicitly } from "@/lib/fixtures/activity-fixture"
import { logger } from "@/lib/utils/logger"
import { signActivityListItems, signActivityListItem } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { generateRequestId } from "@/lib/utils/request-id"

const DEFAULT_RATE_LIMIT_MESSAGE = "请求过于频繁，请稍后再试"

async function handleGet(request: NextRequest) {
  try {
    let user: Awaited<ReturnType<typeof getCurrentUser>> | null = null
    try {
      user = await getCurrentUser()
    } catch (error) {
      logger.warn("getCurrentUser failed, falling back to anonymous viewer", {
        error: error instanceof Error ? error.message : String(error),
      })
      user = null
    }
    const viewer = toAuthenticatedUser(user)
    const ipAddress = getClientIP(request) ?? undefined
    const rateLimit = await rateLimitCheckForAction("read", {
      userId: user?.id ?? null,
      ip: ipAddress,
    })
    if (!rateLimit.success) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        rateLimit.message || DEFAULT_RATE_LIMIT_MESSAGE,
        {
          retryAfter: rateLimit.resetTime?.toISOString(),
        }
      )
    }

    const parsed = activityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        issue?.message || "参数验证失败",
        {
          field: issue?.path?.join("."),
        }
      )
    }

    const queryParams = parsed.data as ActivityQueryParams

    if (queryParams.orderBy === "following" && !viewer) {
      return createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        "请先登录后再查看关注动态",
        undefined,
        401
      )
    }

    const followingUserId =
      queryParams.orderBy === "following" && viewer ? viewer.id : undefined

    const fixtureParam = request.nextUrl.searchParams.get("__fixture")
    const envFixture = process.env.ACTIVITY_API_FIXTURE || null
    const resolvedFixtureName = shouldUseFixtureExplicitly(fixtureParam)
      ? fixtureParam
      : envFixture && shouldUseFixtureExplicitly(envFixture)
        ? envFixture
        : null

    if (resolvedFixtureName) {
      logger.info("Activity API served fixture dataset", {
        fixture: resolvedFixtureName,
        source: fixtureParam ? "query" : "env",
      })

      const fixtureResult = getActivityFixture({
        name: resolvedFixtureName,
        limit: queryParams.limit,
        page: queryParams.page,
        cursor: queryParams.cursor || null,
        hasImages:
          typeof queryParams.hasImages === "boolean" ? queryParams.hasImages : null,
        isPinned: typeof queryParams.isPinned === "boolean" ? queryParams.isPinned : null,
        orderBy: queryParams.orderBy,
      })

      return respondWithFixture(fixtureResult, viewer, resolvedFixtureName, queryParams)
    }

    const repoResult = await listActivities({
      page: queryParams.page,
      limit: queryParams.limit,
      orderBy: queryParams.orderBy,
      authorId: queryParams.authorId || undefined,
      cursor: queryParams.cursor || undefined,
      isPinned: typeof queryParams.isPinned === "boolean" ? queryParams.isPinned : undefined,
      hasImages: typeof queryParams.hasImages === "boolean" ? queryParams.hasImages : undefined,
      searchTerm: queryParams.q || undefined,
      tags: queryParams.tags && queryParams.tags.length > 0 ? queryParams.tags : undefined,
      publishedFrom: queryParams.dateFrom || undefined,
      publishedTo: queryParams.dateTo || undefined,
      followingUserId,
      includeBannedAuthors: viewer?.role === "ADMIN",
    })

    const signedItems = await signActivityListItems(repoResult.items)

    let likeStatusMap: Map<
      string,
      {
        isLiked: boolean
        count: number
      }
    > | null = null

    if (user && repoResult.items.length > 0) {
      likeStatusMap = await getBatchLikeStatus(
        "activity",
        repoResult.items.map((item) => item.id),
        user.id
      )
    }

    const data: ActivityWithAuthor[] = signedItems.map((item) =>
      mapActivityResponse(item, viewer, likeStatusMap?.get(item.id) ?? null)
    )

    const pagination: PaginationMeta = {
      page: queryParams.page,
      limit: queryParams.limit,
      total: repoResult.totalCount,
      hasMore: repoResult.hasMore,
      nextCursor: repoResult.nextCursor ?? null,
    }

    return createSuccessResponse(data, {
      pagination,
      filters: repoResult.appliedFilters ?? undefined,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

async function handlePost(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录", undefined, 401)
    }

    if (user.status !== "ACTIVE") {
      return createErrorResponse(ErrorCode.ACCOUNT_BANNED, "账户状态异常，请联系管理员", undefined, 403)
    }

    const ipAddress = getClientIP(request) ?? undefined
    const rateLimit = await rateLimitCheckForAction("create", {
      userId: user.id,
      ip: ipAddress,
    })
    if (!rateLimit.success) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        rateLimit.message || DEFAULT_RATE_LIMIT_MESSAGE,
        {
          retryAfter: rateLimit.resetTime?.toISOString(),
        }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = activityCreateSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        issue?.message || "参数验证失败",
        {
          field: issue?.path?.join("."),
        }
      )
    }

    const viewer = toAuthenticatedUser(user)!
    const requestedPin = parsed.data.isPinned ?? false
    const canPin = ActivityPermissions.canPin(viewer, {
      id: "temp",
      authorId: user.id,
      deletedAt: null,
      isPinned: requestedPin,
      author: {
        id: user.id,
        role: user.role,
        status: user.status,
      },
    })

    if (requestedPin && !canPin) {
      await auditLogger.logEvent({
        action: "PIN_ACTIVITY_DENIED",
        resource: "activity:new",
        success: false,
        details: {
          requestedPin: true,
          reason: "INSUFFICIENT_PERMISSIONS",
        },
        userId: user.id,
        ipAddress,
        userAgent: getClientUserAgent(request),
        requestId,
      })
    }

    const hashtags = extractActivityHashtags(parsed.data.content)
    const normalizedImageUrls = parsed.data.imageUrls ?? []

    const { activity: created } = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          authorId: user.id,
          content: parsed.data.content,
          imageUrls: normalizedImageUrls,
          isPinned: canPin ? requestedPin : false,
        },
        include: {
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
      })

      if (hashtags.length > 0) {
        await syncActivityTags({
          tx,
          activityId: activity.id,
          rawTagNames: hashtags,
        })
      }

      return { activity }
    })

    await auditLogger.logEvent({
      action: "CREATE_ACTIVITY",
      resource: `activity:${created.id}`,
      success: true,
      userId: user.id,
      ipAddress,
      userAgent: getClientUserAgent(request),
      details: {
        hasImages: normalizedImageUrls.length > 0,
        pinGranted: canPin && requestedPin,
      },
    })

    const listItem: ActivityListItem = {
      id: created.id,
      authorId: created.authorId,
      content: created.content,
      imageUrls: created.imageUrls,
      isPinned: created.isPinned,
      likesCount: created.likesCount,
      commentsCount: created.commentsCount,
      viewsCount: created.viewsCount,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      author: {
        id: created.author.id,
        name: created.author.name,
        avatarUrl: created.author.avatarUrl,
        role: created.author.role,
        status: created.author.status,
      },
    }

    const signedItem = await signActivityListItem(listItem)
    const response = mapActivityResponse(signedItem, viewer, null)
    return createSuccessResponse(response)
  } catch (error) {
    return handleApiError(error)
  }
}

async function handleDelete(request: NextRequest) {
  const activityId = request.nextUrl.searchParams.get("id")?.trim()

  if (!activityId) {
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      "缺少动态ID",
      { field: "id" },
      400
    )
  }

  try {
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录", undefined, 401)
    }

    if (user.status !== "ACTIVE") {
      return createErrorResponse(
        ErrorCode.ACCOUNT_BANNED,
        "账户状态异常，请联系管理员",
        undefined,
        403
      )
    }

    const ipAddress = getClientIP(request) ?? undefined
    const rateLimit = await rateLimitCheckForAction("delete", {
      userId: user.id,
      ip: ipAddress,
    })

    if (!rateLimit.success) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        rateLimit.message || DEFAULT_RATE_LIMIT_MESSAGE,
        {
          retryAfter: rateLimit.resetTime?.toISOString(),
        }
      )
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        authorId: true,
        isPinned: true,
        deletedAt: true,
        author: {
          select: {
            id: true,
            role: true,
            status: true,
          },
        },
      },
    })

    if (!activity || activity.deletedAt) {
      return createErrorResponse(
        ErrorCode.ACTIVITY_NOT_FOUND,
        "动态不存在或已删除",
        { id: activityId },
        404
      )
    }

    const viewer = toAuthenticatedUser(user)
    const permissionSubject: ActivityWithAuthorForPermission = {
      id: activity.id,
      authorId: activity.authorId,
      deletedAt: activity.deletedAt,
      isPinned: activity.isPinned,
      author: {
        id: activity.author.id,
        role: activity.author.role,
        status: activity.author.status,
      },
    }

    if (!ActivityPermissions.canDelete(viewer, permissionSubject)) {
      await auditLogger.logEvent({
        action: "DELETE_ACTIVITY_DENIED",
        resource: `activity:${activity.id}`,
        userId: user.id,
        success: false,
        ipAddress,
        userAgent: getClientUserAgent(request),
        details: {
          reason: "INSUFFICIENT_PERMISSIONS",
          targetAuthor: activity.authorId,
        },
      })

      return createErrorResponse(ErrorCode.FORBIDDEN, "无权删除此动态", undefined, 403)
    }

    const deletedAt = new Date()

    await prisma.$transaction(async (tx) => {
      const tagLinks = await tx.activityTag.findMany({
        where: { activityId: activity.id },
        select: { tagId: true },
      })
      const tagIds = Array.from(new Set(tagLinks.map((link) => link.tagId)))

      if (tagIds.length > 0) {
        await tx.activityTag.deleteMany({ where: { activityId: activity.id } })
        await tx.tag.updateMany({
          where: { id: { in: tagIds } },
          data: { activitiesCount: { decrement: 1 } },
        })
      }

      // 级联清理点赞，保持计数一致
      await tx.like.deleteMany({
        where: { activityId: activity.id },
      })

      await tx.activity.update({
        where: { id: activity.id },
        data: {
          deletedAt,
          isPinned: false,
          likesCount: 0,
        },
      })
    })

    await auditLogger.logEvent({
      action: "DELETE_ACTIVITY",
      resource: `activity:${activity.id}`,
      userId: user.id,
      success: true,
      ipAddress,
      userAgent: getClientUserAgent(request),
      details: {
        softDelete: true,
        wasPinned: activity.isPinned,
      },
    })

    return createSuccessResponse({
      id: activity.id,
      deletedAt: deletedAt.toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function toAuthenticatedUser(user: Awaited<ReturnType<typeof getCurrentUser>>): AuthenticatedUser | null {
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name: user.name,
    avatarUrl: user.avatarUrl,
  }
}

function mapActivityResponse(
  item: ActivityListItem,
  viewer: AuthenticatedUser | null,
  likeStatus: { isLiked?: boolean; count?: number } | null
): ActivityWithAuthor {
  const permissionSubject: ActivityWithAuthorForPermission = {
    id: item.id,
    authorId: item.authorId,
    isPinned: item.isPinned,
    deletedAt: null,
    author: {
      id: item.author.id,
      role: item.author.role,
      status: item.author.status,
    },
  }

  const likesCount = typeof likeStatus?.count === "number" ? likeStatus.count : item.likesCount
  const isLiked = Boolean(likeStatus?.isLiked)

  const authorDisplayName = deriveAuthorDisplayName(item.author)

  return {
    id: item.id,
    authorId: item.authorId,
    content: item.content,
    imageUrls: item.imageUrls,
    isPinned: item.isPinned,
    likesCount,
    commentsCount: item.commentsCount,
    viewsCount: item.viewsCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    author: {
      id: item.author.id,
      name: authorDisplayName,
      avatarUrl: item.author.avatarUrl,
      role: item.author.role === "ADMIN" ? "ADMIN" : "USER",
      status: item.author.status,
    },
    isLiked,
    canEdit: ActivityPermissions.canUpdate(viewer, permissionSubject),
    canDelete: ActivityPermissions.canDelete(viewer, permissionSubject),
  }
}

function deriveAuthorDisplayName(author: ActivityListItem["author"]): string {
  const trimmed = author.name?.trim()
  if (trimmed) {
    return trimmed
  }

  return `用户${author.id.substring(0, 6)}`
}

function respondWithFixture(
  fixtureResult: {
    items: ActivityListItem[]
    hasMore: boolean
    nextCursor: string | null
    totalCount: number
  },
  viewer: AuthenticatedUser | null,
  fixtureName: string | null,
  parsedParams: ActivityQueryParams,
  isFallback = false
) {
  const data: ActivityWithAuthor[] = fixtureResult.items.map((item) =>
    mapActivityResponse(item, viewer, null)
  )

  const pagination: PaginationMeta = {
    page: parsedParams.page,
    limit: parsedParams.limit,
    total: fixtureResult.totalCount,
    hasMore: fixtureResult.hasMore,
    nextCursor: fixtureResult.nextCursor,
  }

  return createSuccessResponse(data, {
    pagination,
    filters: {
      source: "fixture",
      fixture: fixtureName ?? "demo",
      fallback: isFallback,
    },
  })
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)
export const DELETE = withApiResponseMetrics(handleDelete)
