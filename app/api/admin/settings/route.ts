import { NextRequest } from "next/server"
import { z } from "zod"
import { validateApiPermissions } from "@/lib/permissions"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { auditLogger, AuditEventType, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"
import { prisma } from "@/lib/prisma"
import { getAllSettings, setSetting, type Json } from "@/lib/services/system-settings"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ])
)

const settingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "key 不能为空")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/, "key 格式不合法"),
  value: jsonSchema,
})

async function getLatestUpdatedAt(): Promise<string | null> {
  const result = await prisma.systemSetting.aggregate({ _max: { updatedAt: true } })
  return result._max.updatedAt ? result._max.updatedAt.toISOString() : null
}

async function handleWrite(request: NextRequest) {
  const { success, error, user } = await validateApiPermissions(request, "admin")

  if (!success || !user) {
    return createErrorResponse(
      ErrorCode.FORBIDDEN,
      error?.message || "无权修改系统设置",
      undefined,
      error?.statusCode ?? 403
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch (_err) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, "请求体不是有效的 JSON")
  }

  const parsed = settingSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "设置数据校验失败"
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, message, parsed.error.format(), 400)
  }

  const { key, value } = parsed.data

  try {
    await setSetting(key, value, user.id)

    await auditLogger.logEvent({
      eventType: AuditEventType.ADMIN_ACTION,
      action: "ADMIN_SETTING_UPSERT",
      resource: `setting:${key}`,
      userId: user.id,
      ipAddress: getClientIP(request),
      userAgent: getClientUserAgent(request),
      details: { key },
      severity: "LOW",
      success: true,
    })

    return createSuccessResponse({ key, value })
  } catch (err) {
    logger.error("更新系统设置失败", { module: "api/admin/settings", key, adminId: user.id }, err)

    await auditLogger.logEvent({
      eventType: AuditEventType.ADMIN_ACTION,
      action: "ADMIN_SETTING_UPSERT_FAILED",
      resource: `setting:${key}`,
      userId: user.id,
      ipAddress: getClientIP(request),
      userAgent: getClientUserAgent(request),
      details: { key },
      severity: "MEDIUM",
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    })

    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "更新系统设置失败")
  }
}

async function handleGet(request: NextRequest) {
  const { success, error, user } = await validateApiPermissions(request, "admin")

  if (!success || !user) {
    return createErrorResponse(
      ErrorCode.FORBIDDEN,
      error?.message || "无权读取系统设置",
      undefined,
      error?.statusCode ?? 403
    )
  }

  try {
    const [settings, updatedAt] = await Promise.all([getAllSettings(), getLatestUpdatedAt()])

    return createSuccessResponse({ settings, updatedAt })
  } catch (err) {
    logger.error("获取系统设置失败", { module: "api/admin/settings", adminId: user.id }, err)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取系统设置失败")
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handleWrite)
export const PUT = withApiResponseMetrics(handleWrite)
