import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { assertPolicy, generateRequestId, type AuthenticatedUser } from "@/lib/auth/session"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"
import { getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"
import type { User } from "@/lib/generated/prisma"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function getUnreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId,
      readAt: null,
    },
  })
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

async function handlePatch(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined
  const { id: notificationId } = await params

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError || !user) {
      const errorCode = authError ? mapAuthErrorCode(authError) : ErrorCode.UNAUTHORIZED
      return createErrorResponse(errorCode, authError?.message || "未登录", undefined, authError?.statusCode)
    }

    if (!notificationId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "缺少通知 ID")
    }

    const updated = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    })

    const unreadCount = await getUnreadCount(user.id)

    return createSuccessResponse(
      { updated: updated.count, unreadCount },
      { requestId, user: toResponseUser(user) }
    )
  } catch (error) {
    logger.error("单条通知标记已读失败", { requestId, notificationId, error })
    return handleApiError(error)
  }
}

export const PATCH = withApiResponseMetrics(handlePatch)
