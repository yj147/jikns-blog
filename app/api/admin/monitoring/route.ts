import { NextRequest } from "next/server"
import { unstable_cache } from "next/cache"
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

type MonitoringRange = "1h" | "24h" | "7d"
type MonitoringScope = "env" | "sha"

function resolveHours(request: NextRequest): number {
  const range = request.nextUrl.searchParams.get("range") as MonitoringRange | null
  if (range === "1h") return 1
  if (range === "24h") return 24
  if (range === "7d") return 24 * 7

  const hoursParam = request.nextUrl.searchParams.get("hours")
  const parsed = hoursParam ? Number(hoursParam) : Number.NaN
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.max(parsed, 0.05), 24 * 30)
  }

  return 24
}

function resolveScope(request: NextRequest): MonitoringScope {
  const raw = request.nextUrl.searchParams.get("scope")
  if (raw === "sha" || raw === "deployment") {
    return "sha"
  }
  return "env"
}

function normalizeShaTag(sha: string | null | undefined): string | null {
  if (!sha) return null
  return `sha:${sha.slice(0, 7)}`
}

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
    const hours = resolveHours(request)
    const scope = resolveScope(request)
    const shaTag =
      scope === "sha"
        ? normalizeShaTag(
            request.nextUrl.searchParams.get("sha") ?? process.env.VERCEL_GIT_COMMIT_SHA
          )
        : null
    const requiredTags = shaTag ? [shaTag] : []
    const cacheKey = `${MONITORING_CACHE_KEY}:${hours}:${scope}:${shaTag ?? "no-sha"}`

    const cached = getCached<MonitoringResponse>(cacheKey)
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
    const envKey = process.env.VERCEL_ENV ?? "local"

    const countsPromise = unstable_cache(
      () =>
        Promise.all([
          prisma.user.count(),
          prisma.post.count(),
          prisma.comment.count({ where: { deletedAt: null } }),
          prisma.activity.count({ where: { deletedAt: null } }),
        ]),
      ["admin-monitoring-counts", envKey],
      { revalidate: 60 }
    )()
    const performancePromise = unstable_cache(
      () => performanceMonitor.getPerformanceReport(hours, { requiredTags }),
      ["admin-monitoring-report", envKey, scope, String(hours), shaTag ?? "no-sha"],
      { revalidate: 30 }
    )().catch((perfError) => {
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

    setCached(cacheKey, payload, MONITORING_CACHE_TTL)

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

// 监控接口本身会被后台轮询；不采样避免“自监控污染监控”
export const GET = withApiResponseMetrics(handleGet, { sampleRate: 0 })
