import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  listFollowers,
  listFollowing,
  FollowServiceError,
  type FollowListOptions,
} from "@/lib/interactions"
import { createPaginatedResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { getOptionalViewer, generateRequestId } from "@/lib/auth/session"
import { rateLimitCheck } from "@/lib/rate-limit/activity-limits"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { apiLogger } from "@/lib/utils/logger"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

type FollowListType = "followers" | "following"

interface HandleOptions {
  req: NextRequest
  params: { userId: string }
  type: FollowListType
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.floor(parsed)
}

function buildValidationError(message: string, requestId: string) {
  return createErrorResponse(ErrorCode.VALIDATION_ERROR, message, undefined, 422, { requestId })
}

export async function handleFollowListRequest({
  req,
  params,
  type,
}: HandleOptions): Promise<NextResponse> {
  const { userId } = params
  const requestId = generateRequestId()
  const searchParams = req.nextUrl.searchParams
  const limitParam = parsePositiveInteger(searchParams.get("limit"))
  const pageParam = parsePositiveInteger(searchParams.get("page"))
  const cursor = searchParams.get("cursor") || undefined

  // Linus 原则：Never break userspace
  // 默认返回 total 以保持向后兼容，仅在 includeTotal=false 时跳过 COUNT(*)
  // 新客户端应明确传 includeTotal=false 来优化性能
  const includeTotalParam = searchParams.get("includeTotal")
  const includeTotal = includeTotalParam !== "false"

  // Linus 原则：Never break userspace
  // 保留 page 参数以维持向后兼容，但实际分页由游标驱动
  // 响应中返回 page 字段，避免破坏现有客户端契约
  if (limitParam !== null && limitParam > MAX_LIMIT) {
    return buildValidationError(`limit 不能超过 ${MAX_LIMIT}`, requestId)
  }

  if (limitParam === null && searchParams.get("limit")) {
    return buildValidationError("limit 必须为正整数", requestId)
  }

  const limit = limitParam ?? DEFAULT_LIMIT
  const page = pageParam ?? 1
  const shouldApplyOffset = !cursor && page > 1
  const offset = shouldApplyOffset ? (page - 1) * limit : undefined

  // Linus 原则：实用主义
  // 读操作使用 read 配额（100次/分钟），而非写操作的 follow 配额（30次/分钟）
  // 符合设计文档 Phase9-关注系统设计.md:126-130 的限流策略
  const rateLimit = await rateLimitCheck(req, "read")
  if (!rateLimit.success) {
    await auditLogger.logEvent({
      action: "USER_FOLLOW_LIST_VIEW",
      resource: `${type}:${userId}`,
      success: false,
      errorMessage: rateLimit.message,
      requestId,
      ipAddress: getClientIP(req),
      userAgent: getClientUserAgent(req),
      details: {
        rateLimited: true,
        backend: rateLimit.backend,
      },
    })

    // Linus 原则：实用主义
    // 使用真实的重置时间计算 Retry-After，而非硬编码 60 秒
    // 让客户端获得准确的重试时间，提升用户体验
    const retryAfterSeconds = rateLimit.resetTime
      ? Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : 60

    const response = createErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      rateLimit.message || "请求过于频繁，请稍后再试",
      undefined,
      429,
      { requestId }
    )
    response.headers.set("Retry-After", String(Math.max(1, retryAfterSeconds)))
    return response
  }

  try {
    const targetExists = await prisma.user.count({
      where: { id: userId },
    })

    if (targetExists === 0) {
      await auditLogger.logEvent({
        action: "USER_FOLLOW_LIST_VIEW",
        resource: `${type}:${userId}`,
        success: false,
        errorMessage: "目标用户不存在",
        requestId,
        ipAddress: getClientIP(req),
        userAgent: getClientUserAgent(req),
      })

      return createErrorResponse(ErrorCode.NOT_FOUND, "目标用户不存在", undefined, 404, {
        requestId,
      })
    }

    // Linus 原则：实用主义
    // 仅在客户端显式请求时执行 COUNT(*)，避免高关注用户场景下的热点查询
    // 对于无限滚动场景，客户端通常只需要 hasMore 标志，不需要总量
    const total = includeTotal
      ? await prisma.follow.count({
          where: type === "followers" ? { followingId: userId } : { followerId: userId },
        })
      : null

    const listOptions: FollowListOptions = cursor
      ? { limit, cursor }
      : offset !== undefined
        ? { limit, offset }
        : { limit }

    const listResult =
      type === "followers"
        ? await listFollowers(userId, listOptions)
        : await listFollowing(userId, listOptions)

    const viewer = await getOptionalViewer({ request: req })

    await auditLogger.logEvent({
      action: "USER_FOLLOW_LIST_VIEW",
      resource: `${type}:${userId}`,
      success: true,
      userId: viewer?.id,
      requestId,
      ipAddress: getClientIP(req),
      userAgent: getClientUserAgent(req),
      details: {
        limit,
        page,
        cursorProvided: Boolean(cursor),
        resultCount: listResult.items.length,
      },
    })

    performanceMonitor.recordMetric({
      type: MetricType.FEED_FOLLOWING_RESULT_COUNT,
      value: listResult.items.length,
      unit: "count",
      timestamp: new Date(),
      context: {
        endpoint: req.nextUrl.pathname,
        method: req.method,
        userId: viewer?.id,
        additionalData: {
          listType: type,
          targetUserId: userId,
          requestId,
        },
      },
    })

    // Linus 原则：Never break userspace
    // 保留 page 字段以维持向后兼容，实际分页由游标驱动
    // 游标优先：如果提供 cursor，则忽略 page；否则 page 仅用于客户端显示
    // total 字段可选：仅在 includeTotal=true 时返回，避免不必要的 COUNT(*) 查询
    const paginationNextCursor = listResult.nextCursor ?? null

    return createPaginatedResponse(
      listResult.items,
      {
        page,
        limit,
        total,
        hasMore: listResult.hasMore,
        nextCursor: paginationNextCursor,
      },
      {
        requestId,
        user: viewer
          ? {
              id: viewer.id,
              email: viewer.email ?? undefined,
              name: viewer.name ?? undefined,
            }
          : undefined,
      }
    )
  } catch (error) {
    if (error instanceof FollowServiceError) {
      const statusCode = error.code === "INVALID_CURSOR" ? 400 : 400
      const message =
        error.code === "INVALID_CURSOR" ? "分页游标无效" : error.message || "关注列表获取失败"

      await auditLogger.logEvent({
        action: "USER_FOLLOW_LIST_VIEW",
        resource: `${type}:${userId}`,
        success: false,
        errorMessage: message,
        requestId,
        ipAddress: getClientIP(req),
        userAgent: getClientUserAgent(req),
        details: {
          errorCode: error.code,
        },
      })

      return createErrorResponse(ErrorCode.VALIDATION_ERROR, message, undefined, statusCode, {
        requestId,
      })
    }

    apiLogger.error("跟随列表接口异常", error as Error, {
      requestId,
      userId,
      listType: type,
    })

    await auditLogger.logEvent({
      action: "USER_FOLLOW_LIST_VIEW",
      resource: `${type}:${userId}`,
      success: false,
      errorMessage: "服务器内部错误",
      requestId,
      ipAddress: getClientIP(req),
      userAgent: getClientUserAgent(req),
    })

    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "服务器内部错误", undefined, 500, {
      requestId,
    })
  }
}
