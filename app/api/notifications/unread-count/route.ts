import { NextRequest } from "next/server"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { assertPolicy, generateRequestId, type AuthenticatedUser } from "@/lib/auth/session"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { mapAuthErrorCode } from "@/lib/api/auth-error-mapper"
import { getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"
import type { User } from "@/lib/generated/prisma"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const UNREAD_COUNT_CACHE_SECONDS = 10

async function getUnreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId,
      readAt: null,
    },
  })
}

async function getCachedUnreadCount(recipientId: string): Promise<number> {
  return unstable_cache(
    () => getUnreadCount(recipientId),
    ["api-notifications-unread-count", recipientId],
    { revalidate: UNREAD_COUNT_CACHE_SECONDS, tags: [`notifications:user:${recipientId}`] }
  )()
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

async function handleGet(request: NextRequest) {
  const totalStart = performance.now()
  const requestId = generateRequestId()
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined
  let policyMs = 0
  let queryMs = 0

  try {
    const policyStart = performance.now()
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })
    policyMs = performance.now() - policyStart

    if (authError || !user) {
      const errorCode = authError ? mapAuthErrorCode(authError) : ErrorCode.UNAUTHORIZED
      return createErrorResponse(
        errorCode,
        authError?.message || "未登录",
        undefined,
        authError?.statusCode
      )
    }

    const queryStart = performance.now()
    const unreadCount =
      process.env.NODE_ENV === "production"
        ? await getCachedUnreadCount(user.id)
        : await getUnreadCount(user.id)
    queryMs = performance.now() - queryStart

    const response = createSuccessResponse(
      { unreadCount },
      { requestId, user: toResponseUser(user) }
    )
    const totalMs = performance.now() - totalStart
    response.headers.set(
      "Server-Timing",
      [
        `policy;dur=${policyMs.toFixed(1)}`,
        `query;dur=${queryMs.toFixed(1)}`,
        `total;dur=${totalMs.toFixed(1)}`,
      ].join(", ")
    )
    response.headers.set("x-perf-policy-ms", policyMs.toFixed(1))
    response.headers.set("x-perf-query-ms", queryMs.toFixed(1))
    response.headers.set("x-perf-total-ms", totalMs.toFixed(1))
    return response
  } catch (error) {
    logger.error("获取未读通知数失败", { requestId, error })
    return handleApiError(error)
  }
}

export const GET = withApiResponseMetrics(handleGet)
