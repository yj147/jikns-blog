import { NextRequest } from "next/server"
import { z } from "zod"
import { MetricType } from "@/lib/generated/prisma"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { validateApiPermissions } from "@/lib/permissions"
import { getMetricsTimeseries } from "@/lib/repos/metrics-repo"
import { MetricsBucket, MetricsCompareWindow } from "@/lib/dto/metrics.dto"
import { logger } from "@/lib/utils/logger"

const MetricsQuerySchema = z.object({
  type: z.nativeEnum(MetricType).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  bucket: z.enum(["60s", "5m", "1h"]).optional(),
  compareWindow: z.enum(["1h", "24h"]).optional(),
})

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()

  const permission = await validateApiPermissions(request, "admin")
  if (!permission.success || !permission.user) {
    const status = permission.error?.statusCode ?? 403
    const code =
      permission.error?.code === "AUTHENTICATION_REQUIRED"
        ? ErrorCode.UNAUTHORIZED
        : ErrorCode.FORBIDDEN

    return createErrorResponse(
      code,
      permission.error?.error || permission.error?.message || "需要管理员权限",
      { requestId, reason: permission.error },
      status,
      { requestId }
    )
  }

  const parsed = MetricsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      issue?.message || "参数验证失败",
      { field: issue?.path?.join("."), requestId },
      400,
      { requestId }
    )
  }

  try {
    const startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : undefined
    const endTime = parsed.data.endTime ? new Date(parsed.data.endTime) : undefined

    if (startTime && endTime && startTime >= endTime) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "startTime 必须早于 endTime",
        { requestId },
        400,
        { requestId }
      )
    }

    const result = await getMetricsTimeseries({
      type: parsed.data.type,
      startTime,
      endTime,
      bucket: parsed.data.bucket as MetricsBucket | undefined,
      compareWindow: parsed.data.compareWindow as MetricsCompareWindow | undefined,
    })

    return createSuccessResponse(result, {
      requestId,
      user: {
        id: permission.user.id,
        email: permission.user.email,
        role: permission.user.role,
        status: permission.user.status,
      },
      filters: {
        type: parsed.data.type,
        startTime: result.range.startTime,
        endTime: result.range.endTime,
        bucket: parsed.data.bucket ?? "5m",
        compareWindow: parsed.data.compareWindow,
      },
    })
  } catch (error) {
    logger.error("获取性能指标失败", { requestId }, error as Error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取性能指标失败", { requestId }, 500, {
      requestId,
    })
  }
}
