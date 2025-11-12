import { NextRequest } from "next/server"
import { validateApiPermissions } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"

type SettingsMap = Record<string, any>

function normalizeSettings(records: Array<{ key: string; value: unknown; updatedAt: Date }>) {
  const data: SettingsMap = {}
  for (const record of records) {
    data[record.key] = record.value
  }
  const latestUpdatedAt = records.reduce<Date | null>((acc, record) => {
    if (!acc || record.updatedAt > acc) {
      return record.updatedAt
    }
    return acc
  }, null)

  return {
    settings: data,
    updatedAt: latestUpdatedAt?.toISOString() ?? null,
  }
}

export async function GET(request: NextRequest) {
  const { success, error } = await validateApiPermissions(request, "admin")

  if (!success) {
    return createErrorResponse(
      error?.code ?? ErrorCode.FORBIDDEN,
      error?.message || "无权读取系统设置",
      undefined,
      error?.statusCode ?? 403
    )
  }

  try {
    const records = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    })

    return createSuccessResponse(normalizeSettings(records))
  } catch (err) {
    logger.error("获取系统设置失败", { module: "api/admin/settings" }, err)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取系统设置失败")
  }
}

export async function POST(request: NextRequest) {
  const { success, error, user } = await validateApiPermissions(request, "admin")

  if (!success || !user) {
    return createErrorResponse(
      error?.code ?? ErrorCode.FORBIDDEN,
      error?.message || "无权修改系统设置",
      undefined,
      error?.statusCode ?? 403
    )
  }

  try {
    const body = await request.json()
    const { key, value } = body as { key?: string; value?: unknown }

    if (!key || typeof key !== "string") {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "必须提供有效的 key")
    }

    if (value === undefined) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, "必须提供 value")
    }

    const normalizedValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)

    const existing = await prisma.systemSetting.findUnique({ where: { key } })

    const updatedSetting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: normalizedValue, updatedById: user.id },
      create: {
        key,
        value: normalizedValue,
        updatedById: user.id,
      },
    })

    const ip = getClientIP(request)
    const ua = getClientUserAgent(request)

    await auditLogger.logEvent({
      action: "SYSTEM_SETTING_UPDATED",
      resource: `setting:${key}`,
      userId: user.id,
      success: true,
      ipAddress: ip,
      userAgent: ua,
      details: {
        key,
        previousValue: existing?.value ?? null,
        newValue: value,
      },
      severity: "MEDIUM",
    })

    return createSuccessResponse({ setting: updatedSetting })
  } catch (err) {
    logger.error("更新系统设置失败", { module: "api/admin/settings", adminId: user.id }, err)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "更新系统设置失败")
  }
}
