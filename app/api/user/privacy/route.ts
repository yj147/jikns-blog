import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { validateApiPermissions } from "@/lib/permissions"
import { privacySettingsSchema } from "@/types/user-settings"
import { logger } from "@/lib/utils/logger"
import { ZodError } from "zod"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError(error: unknown) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "参数校验失败",
      code: "VALIDATION_ERROR",
    },
    { status: 400 }
  )
}

async function handleGet(request: NextRequest) {
  const { success, error, user } = await validateApiPermissions(request, "auth")
  if (!success || !user) {
    return NextResponse.json(error, { status: error?.statusCode ?? 401 })
  }

  try {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { privacySettings: true },
    })

    const settings = privacySettingsSchema.parse(record?.privacySettings ?? {})

    return NextResponse.json({ data: settings })
  } catch (err) {
    logger.error("获取隐私设置失败", { userId: user.id }, err)
    return NextResponse.json({ error: "获取隐私设置失败" }, { status: 500 })
  }
}

async function handlePut(request: NextRequest) {
  const { success, error, user } = await validateApiPermissions(request, "auth")
  if (!success || !user) {
    return NextResponse.json(error, { status: error?.statusCode ?? 401 })
  }

  try {
    const body = await request.json()
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { privacySettings: true },
    })

    const merged = privacySettingsSchema.parse({
      ...(isRecord(existing?.privacySettings) ? existing.privacySettings : {}),
      ...(isRecord(body) ? body : {}),
    })

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { privacySettings: merged },
      select: { privacySettings: true },
    })

    revalidateTag("user:self")
    revalidateTag(`user:${user.id}`)

    return NextResponse.json({ data: updated.privacySettings, message: "隐私设置已更新" })
  } catch (err) {
    logger.error("更新隐私设置失败", { userId: user.id }, err)
    return err instanceof ZodError ? validationError(err) : NextResponse.json({ error: "更新隐私设置失败" }, { status: 500 })
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const PUT = withApiResponseMetrics(handlePut)
