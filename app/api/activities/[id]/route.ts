import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import type { AuthenticatedUser } from "@/lib/auth/session"
import { activityUpdateSchema, type ActivityWithAuthor } from "@/types/activity"
import {
  createSuccessResponse,
  createErrorResponse,
  ErrorCode,
} from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { ActivityPermissions } from "@/lib/permissions/activity-permissions"
import { rateLimitCheckForAction } from "@/lib/rate-limit/activity-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { extractActivityHashtags, syncActivityTags } from "@/lib/services/activity-tags"
import { signAvatarUrl, signActivityImages } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

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

const DEFAULT_RATE_LIMIT_MESSAGE = "请求过于频繁，请稍后再试"

// GET /api/activities/[id] - 获取单条动态
async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    const viewer = toAuthenticatedUser(currentUser)

    const activity = await prisma.activity.findUnique({
      where: { id, deletedAt: null },
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

    if (!activity) {
      return createErrorResponse(ErrorCode.NOT_FOUND, "动态不存在", undefined, 404)
    }

    // 签名头像和图片 URL
    const [signedAvatar, signedImages] = await Promise.all([
      signAvatarUrl(activity.author.avatarUrl),
      signActivityImages(activity.imageUrls),
    ])

    const permissionSubject = {
      id: activity.id,
      authorId: activity.authorId,
      isPinned: activity.isPinned,
      deletedAt: null,
      author: activity.author,
    }

    const result: ActivityWithAuthor = {
      id: activity.id,
      authorId: activity.authorId,
      content: activity.content,
      imageUrls: signedImages,
      isPinned: activity.isPinned,
      likesCount: activity.likesCount,
      commentsCount: activity.commentsCount,
      viewsCount: activity.viewsCount,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      author: {
        id: activity.author.id,
        name: activity.author.name,
        avatarUrl: signedAvatar,
        role: activity.author.role === "ADMIN" ? "ADMIN" : "USER",
        status: activity.author.status,
      },
      canEdit: ActivityPermissions.canUpdate(viewer, permissionSubject),
      canDelete: ActivityPermissions.canDelete(viewer, permissionSubject),
    }

    return createSuccessResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/activities/[id] - 更新动态
async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = getClientIP(request) ?? undefined

  try {
    const { id } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录", undefined, 401)
    }

    if (currentUser.status !== "ACTIVE") {
      return createErrorResponse(
        ErrorCode.ACCOUNT_BANNED,
        "账户状态异常，请联系管理员",
        undefined,
        403
      )
    }

    const viewer = toAuthenticatedUser(currentUser)!

    // 检查速率限制
    const rateLimit = await rateLimitCheckForAction("update", {
      userId: currentUser.id,
      ip: ipAddress,
    })
    if (!rateLimit.success) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        rateLimit.message || DEFAULT_RATE_LIMIT_MESSAGE,
        { retryAfter: rateLimit.resetTime?.toISOString() }
      )
    }

    // 查找动态
    const activity = await prisma.activity.findUnique({
      where: { id, deletedAt: null },
      include: {
        author: {
          select: { id: true, role: true, status: true },
        },
      },
    })

    if (!activity) {
      return createErrorResponse(ErrorCode.NOT_FOUND, "动态不存在", undefined, 404)
    }

    const permissionSubject = {
      id: activity.id,
      authorId: activity.authorId,
      isPinned: activity.isPinned,
      deletedAt: null,
      author: activity.author,
    }

    // 权限检查
    const canUpdate = ActivityPermissions.canUpdate(viewer, permissionSubject)

    if (!canUpdate) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "无权编辑此动态", undefined, 403)
    }

    // 解析请求体
    const body = await request.json()
    const parsed = activityUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "数据验证失败",
        { details: parsed.error.flatten() },
        400
      )
    }

    const updateData: Record<string, unknown> = {}

    if (parsed.data.content !== undefined) {
      updateData.content = parsed.data.content
    }

    if (parsed.data.imageUrls !== undefined) {
      updateData.imageUrls = parsed.data.imageUrls
    }

    // 只有管理员可以设置置顶
    if (parsed.data.isPinned !== undefined && currentUser.role === "ADMIN") {
      updateData.isPinned = parsed.data.isPinned
    }

    // 更新动态
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.activity.update({
        where: { id },
        data: updateData,
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

      // 同步 hashtags
      if (parsed.data.content) {
        const hashtags = extractActivityHashtags(parsed.data.content)
        if (hashtags.length > 0) {
          await syncActivityTags({ tx, activityId: id, rawTagNames: hashtags })
        }
      }

      return result
    })

    auditLogger.logEventAsync({
      action: "UPDATE_ACTIVITY",
      resource: `activity:${id}`,
      success: true,
      userId: currentUser.id,
      ipAddress,
      userAgent: getClientUserAgent(request),
      details: {
        updatedFields: Object.keys(updateData),
      },
    })

    // 签名 URL
    const [signedAvatar, signedImages] = await Promise.all([
      signAvatarUrl(updated.author.avatarUrl),
      signActivityImages(updated.imageUrls),
    ])

    const updatedPermissionSubject = {
      id: updated.id,
      authorId: updated.authorId,
      isPinned: updated.isPinned,
      deletedAt: null,
      author: updated.author,
    }

    const result: ActivityWithAuthor = {
      id: updated.id,
      authorId: updated.authorId,
      content: updated.content,
      imageUrls: signedImages,
      isPinned: updated.isPinned,
      likesCount: updated.likesCount,
      commentsCount: updated.commentsCount,
      viewsCount: updated.viewsCount,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      author: {
        id: updated.author.id,
        name: updated.author.name,
        avatarUrl: signedAvatar,
        role: updated.author.role === "ADMIN" ? "ADMIN" : "USER",
        status: updated.author.status,
      },
      canEdit: true,
      canDelete: ActivityPermissions.canDelete(viewer, updatedPermissionSubject),
    }

    return createSuccessResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/activities/[id] - 删除动态
async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipAddress = getClientIP(request) ?? undefined

  try {
    const { id } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录", undefined, 401)
    }

    if (currentUser.status !== "ACTIVE") {
      return createErrorResponse(
        ErrorCode.ACCOUNT_BANNED,
        "账户状态异常，请联系管理员",
        undefined,
        403
      )
    }

    const viewer = toAuthenticatedUser(currentUser)!

    // 查找动态
    const activity = await prisma.activity.findUnique({
      where: { id, deletedAt: null },
      include: {
        author: {
          select: { id: true, role: true, status: true },
        },
      },
    })

    if (!activity) {
      return createErrorResponse(ErrorCode.NOT_FOUND, "动态不存在", undefined, 404)
    }

    const permissionSubject = {
      id: activity.id,
      authorId: activity.authorId,
      isPinned: activity.isPinned,
      deletedAt: null,
      author: activity.author,
    }

    // 权限检查
    const canDelete = ActivityPermissions.canDelete(viewer, permissionSubject)

    if (!canDelete) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "无权删除此动态", undefined, 403)
    }

    // 软删除
    const deletedAt = new Date()
    await prisma.activity.update({
      where: { id },
      data: { deletedAt },
    })

    auditLogger.logEventAsync({
      action: "DELETE_ACTIVITY",
      resource: `activity:${id}`,
      success: true,
      userId: currentUser.id,
      ipAddress,
      userAgent: getClientUserAgent(request),
      details: {
        softDelete: true,
        wasPinned: activity.isPinned,
      },
    })

    return createSuccessResponse({
      id,
      deletedAt: deletedAt.toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const PUT = withApiResponseMetrics(handlePut)
export const DELETE = withApiResponseMetrics(handleDelete)
