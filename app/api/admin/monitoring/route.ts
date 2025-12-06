import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateApiPermissions } from "@/lib/permissions"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { logger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { generateRequestId } from "@/lib/utils/request-id"
import { performanceMonitor } from "@/lib/performance-monitor"
import { getCached, setCached } from "@/lib/cache/simple-cache"
import type { MonitoringResponse } from "@/types/monitoring"

const MONITORING_CACHE_KEY = "admin:monitoring"
const MONITORING_CACHE_TTL = 30000

async function handleGet(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  const { success, error, user } = await validateApiPermissions(request, "admin")

  if (!success || !user) {
    const code =
      error?.code === "AUTHENTICATION_REQUIRED" ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN

    return createErrorResponse(
      code,
      error?.error || error?.message || "无权访问监控数据",
      { requestId, reason: error },
      error?.statusCode,
      { requestId }
    )
  }

  try {
    const cached = getCached<MonitoringResponse>(MONITORING_CACHE_KEY)
    if (cached) {
      return createSuccessResponse(cached, {
        requestId,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      })
    }

    const now = new Date()
    const countsPromise = prisma.$transaction([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count({ where: { deletedAt: null } }),
      prisma.activity.count({ where: { deletedAt: null } }),
    ])

    const performancePromise = performanceMonitor
      .getPerformanceReport(24)
      .catch((perfError) => {
        logger.warn("获取性能报告失败，回退为仅计数", { requestId, error: perfError })
        return null
      })

    const [[users, posts, comments, activities], performanceReport] = await Promise.all([
      countsPromise,
      performancePromise,
    ])

    const payload: MonitoringResponse = {
      users,
      posts,
      comments,
      activities,
      generatedAt: now.toISOString(),
      uptime: process.uptime(),
      ...(performanceReport ? { performanceReport } : {}),
    }

    setCached(MONITORING_CACHE_KEY, payload, MONITORING_CACHE_TTL)

    return createSuccessResponse(payload, {
      requestId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    })
  } catch (err) {
    logger.error("获取监控聚合数据失败", { requestId, adminId: user.id }, err)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取监控数据失败", { requestId }, 500, {
      requestId,
    })
  }
}

export const GET = withApiResponseMetrics(handleGet)
