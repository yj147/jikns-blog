import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { NotificationType, type User } from "@/lib/generated/prisma"
import { assertPolicy, generateRequestId, type AuthenticatedUser } from "@/lib/auth/session"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"
import { getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"
import { signAvatarUrl } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const VALID_TYPES = new Set<NotificationType>(Object.values(NotificationType))

type NotificationView = {
  id: string
  type: NotificationType
  readAt: Date | null
  createdAt: Date
  recipientId: string
  actorId: string
  postId?: string | null
  commentId?: string | null
  targetUrl?: string | null
  activityId?: string | null
  actor: {
    id: string
    name: string | null
    avatarUrl: string | null
    email: string | null
  }
  post?: {
    id: string
    title: string | null
    slug: string | null
  } | null
  comment?: {
    id: string
    content: string | null
    postId: string | null
    activityId: string | null
  } | null
}

function buildTargetUrl(record: any): string | null {
  const postSlugOrId = record.post?.slug ?? record.postId ?? record.comment?.postId ?? null
  const activityId = record.activityId ?? record.comment?.activityId ?? null

  if (record.type === NotificationType.FOLLOW) {
    const actorId = record.actor?.id ?? record.actorId
    return actorId ? `/profile/${actorId}` : null
  }

  if (record.type === NotificationType.COMMENT) {
    if (activityId) {
      return `/feed?highlight=${activityId}`
    }
    return postSlugOrId ? `/blog/${postSlugOrId}#comments` : null
  }

  if (record.type === NotificationType.LIKE) {
    if (activityId) {
      return `/feed?highlight=${activityId}`
    }
    return postSlugOrId ? `/blog/${postSlugOrId}` : null
  }

  return null
}

function mapNotification(record: any): NotificationView {
  const targetUrl = record.targetUrl ?? buildTargetUrl(record)

  if (!record.actor && record.actorId) {
    logger.warn("通知记录缺少 actor 关联", {
      notificationId: record.id,
      actorId: record.actorId,
    })
  }

  return {
    id: record.id,
    type: record.type,
    readAt: record.readAt,
    createdAt: record.createdAt,
    recipientId: record.recipientId,
    actorId: record.actorId,
    postId: record.postId,
    commentId: record.commentId,
    activityId: record.activityId ?? record.comment?.activityId ?? null,
    targetUrl,
    actor: {
      id: record.actor?.id ?? record.actorId,
      name: record.actor?.name ?? null,
      avatarUrl: record.actor?.avatarUrl ?? null,
      email: record.actor?.email ?? null,
    },
    post: record.post
      ? {
          id: record.post.id,
          title: record.post.title,
          slug: record.post.slug ?? null,
        }
      : null,
    comment: record.comment
      ? {
          id: record.comment.id,
          content: record.comment.content,
          postId: record.comment.postId ?? null,
          activityId: record.comment.activityId ?? null,
        }
      : null,
  }
}

async function getUnreadStats(recipientId: string, filterType?: NotificationType) {
  const [total, filtered] = await Promise.all([
    prisma.notification.count({
      where: { recipientId, readAt: null },
    }),
    prisma.notification.count({
      where: { recipientId, readAt: null, ...(filterType ? { type: filterType } : {}) },
    }),
  ])

  return { total, filtered }
}

function parseType(raw: string | null): NotificationType | undefined {
  if (!raw) return undefined
  const upper = raw.toUpperCase() as NotificationType
  if (!VALID_TYPES.has(upper)) return undefined
  return upper
}

function parseLimit(raw: string | null): number {
  const fallback = DEFAULT_LIMIT
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, MAX_LIMIT)
}

function parseIds(searchParams: URLSearchParams): string[] {
  const ids = new Set<string>()
  const single = searchParams.get("id")
  if (single) ids.add(single.trim())

  const list = searchParams
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  list?.forEach((id) => ids.add(id))

  searchParams
    .getAll("id")
    .map((id) => id.trim())
    .filter(Boolean)
    .forEach((id) => ids.add(id))

  return [...ids]
}

function toResponseUser(user: AuthenticatedUser): Partial<User> {
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role,
    status: user.status,
  }
}

async function signNotificationAvatars(
  notifications: NotificationView[]
): Promise<NotificationView[]> {
  return Promise.all(
    notifications.map(async (notification) => {
      const signedAvatar = await signAvatarUrl(notification.actor?.avatarUrl ?? null)

      if (!notification.actor) {
        return notification
      }

      return {
        ...notification,
        actor: {
          ...notification.actor,
          avatarUrl: signedAvatar ?? notification.actor.avatarUrl,
        },
      }
    })
  )
}

async function handleGet(request: NextRequest) {
  const requestId = generateRequestId()
  const searchParams = request.nextUrl.searchParams
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError || !user) {
      const errorCode = authError ? mapAuthErrorCode(authError) : ErrorCode.UNAUTHORIZED
      return createErrorResponse(
        errorCode,
        authError?.message || "未登录",
        undefined,
        authError?.statusCode
      )
    }

    const type = parseType(searchParams.get("type"))
    const limit = parseLimit(searchParams.get("limit"))
    const cursor = searchParams.get("cursor") ?? undefined
    const ids = parseIds(searchParams)

    if (searchParams.get("type") && !type) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "不支持的通知类型")
    }

    const where = {
      recipientId: user.id,
      ...(type ? { type } : {}),
      ...(ids.length ? { id: { in: ids } } : {}),
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(ids.length
        ? {}
        : {
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          }),
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
            postId: true,
            activityId: true,
          },
        },
      },
    })

    const hasMore = !ids.length && notifications.length > limit
    const items = ids.length
      ? notifications
      : hasMore
        ? notifications.slice(0, limit)
        : notifications
    const nextCursor = !ids.length && hasMore ? (items[items.length - 1]?.id ?? null) : null
    const stats = await getUnreadStats(user.id, type)
    const signedItems = await signNotificationAvatars(items.map(mapNotification))

    return createSuccessResponse(
      {
        items: signedItems,
        pagination: {
          limit,
          total: -1,
          hasMore: ids.length ? false : hasMore,
          nextCursor: ids.length ? null : nextCursor,
        },
        unreadCount: stats.total,
        filteredUnreadCount: stats.filtered,
      },
      {
        requestId,
        filters: type ? { type } : undefined,
        user: toResponseUser(user),
      }
    )
  } catch (error) {
    logger.error("获取通知列表失败", { requestId, error })
    return handleApiError(error)
  }
}

async function handlePatch(request: NextRequest) {
  const requestId = generateRequestId()
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError || !user) {
      const errorCode = authError ? mapAuthErrorCode(authError) : ErrorCode.UNAUTHORIZED
      return createErrorResponse(
        errorCode,
        authError?.message || "未登录",
        undefined,
        authError?.statusCode
      )
    }

    const body = await request.json().catch(() => null)
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : []
    const uniqueIds = [...new Set(ids)]

    if (!uniqueIds.length) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "ids 不能为空")
    }

    const ownedCount = await prisma.notification.count({
      where: { id: { in: uniqueIds }, recipientId: user.id },
    })

    if (ownedCount !== uniqueIds.length) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "存在不属于当前用户的通知")
    }

    const updated = await prisma.notification.updateMany({
      where: {
        id: { in: uniqueIds },
        recipientId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    })

    const stats = await getUnreadStats(user.id)

    return createSuccessResponse(
      { updated: updated.count, unreadCount: stats.total },
      { requestId, user: toResponseUser(user) }
    )
  } catch (error) {
    logger.error("批量标记通知已读失败", { requestId, error })
    return handleApiError(error)
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const PATCH = withApiResponseMetrics(handlePatch)
