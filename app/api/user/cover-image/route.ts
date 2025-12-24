import { NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { createRouteHandlerClient } from "@/lib/supabase"
import { prisma } from "@/lib/prisma"
import { assertPolicy } from "@/lib/auth/session"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { validateImageFile, generateFileName, formatFileSize } from "@/lib/upload/image-utils"
import { createSignedUrlIfNeeded, parseStorageTarget } from "@/lib/storage/signed-url"
import { CSRFProtection } from "@/lib/security"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { logger } from "@/lib/utils/logger"
import { getClientIp } from "@/lib/api/get-client-ip"

const COVER_BUCKET = "activity-images"
const COVER_PATH_PREFIX = "covers"
const MAX_COVER_SIZE = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const SIGN_EXPIRES_IN = 60 * 60 // 1 hour

function buildPolicyContext(request: NextRequest) {
  const ipValue = getClientIp(request)
  const ip = ipValue === "unknown" ? undefined : ipValue
  const ua = request.headers.get("user-agent") || undefined

  return {
    path: request.nextUrl.pathname,
    ip,
    ua,
  }
}

function rejectIfCsrfInvalid(request: NextRequest) {
  // Server Action 内部调用跳过 CSRF 检查
  if (request.headers.get("X-Internal-Request") === "server-action") {
    return null
  }

  if (CSRFProtection.validateToken(request)) return null

  logger.warn("CSRF token missing or invalid for cover upload", {
    module: "api/user/cover-image",
    path: request.nextUrl.pathname,
    method: request.method,
  })

  return createErrorResponse(ErrorCode.FORBIDDEN, "CSRF token 缺失或无效")
}

function getCoverFile(formData: FormData): File | null {
  const candidate = formData.get("cover") ?? formData.get("coverImage") ?? formData.get("file")
  if (candidate instanceof File) return candidate
  return null
}

function validateCoverFile(file: File): { isValid: boolean; error?: string } {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { isValid: false, error: "仅支持 JPG/PNG/WebP 图片" }
  }

  if (file.size === 0) {
    return { isValid: false, error: "封面文件为空" }
  }

  if (file.size > MAX_COVER_SIZE) {
    return { isValid: false, error: `封面大小不能超过 ${formatFileSize(MAX_COVER_SIZE)}` }
  }

  const base = validateImageFile(file)
  if (!base.isValid) {
    return { isValid: false, error: base.error }
  }

  return { isValid: true }
}

function buildCoverPath(userId: string, file: File) {
  const fileName = generateFileName(file)
  return `${COVER_PATH_PREFIX}/${userId}/${Date.now()}-${fileName}`
}

function extractUserCoverPath(raw?: string | null, userId?: string): string | null {
  const target = parseStorageTarget(raw)
  if (!target || target.bucket !== COVER_BUCKET) return null
  const normalized = target.path.startsWith(`${COVER_PATH_PREFIX}/`)
    ? target.path
    : `${COVER_PATH_PREFIX}/${target.path}`
  if (userId && !normalized.startsWith(`${COVER_PATH_PREFIX}/${userId}/`)) return null
  return normalized
}

async function deleteCoverFile(path: string) {
  try {
    const supabase = await createRouteHandlerClient()
    const { error } = await supabase.storage.from(COVER_BUCKET).remove([path])
    if (error) {
      logger.warn("删除封面图失败", { module: "api/user/cover-image", path, error: error.message })
    }
  } catch (error) {
    logger.warn("删除封面图异常", {
      module: "api/user/cover-image",
      path,
      error: (error as Error)?.message,
    })
  }
}

async function handlePost(request: NextRequest) {
  try {
    const csrfError = rejectIfCsrfInvalid(request)
    if (csrfError) return csrfError

    const [viewer, authError] = await assertPolicy("user-active", buildPolicyContext(request))
    if (!viewer) {
      if (authError?.code === "ACCOUNT_BANNED") {
        return createErrorResponse(ErrorCode.FORBIDDEN, "您的账户已被限制，无法上传封面")
      }
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录")
    }

    const formData = await request.formData()
    const file = getCoverFile(formData)
    if (!file) {
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "请选择要上传的封面图")
    }

    const validation = validateCoverFile(file)
    if (!validation.isValid) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, validation.error || "封面文件无效")
    }

    const supabase = await createRouteHandlerClient()
    const path = buildCoverPath(viewer.id, file)

    const uploadResult = await supabase.storage.from(COVER_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    })

    if (uploadResult.error) {
      logger.error("封面上传失败", uploadResult.error)
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, "封面上传失败，请稍后重试")
    }

    let oldCoverPath: string | null = null
    try {
      const existing = await prisma.user.findUnique({
        where: { id: viewer.id },
        select: { coverImage: true },
      })

      if (!existing) {
        await deleteCoverFile(path)
        return createErrorResponse(ErrorCode.TARGET_NOT_FOUND, "用户不存在")
      }

      oldCoverPath = extractUserCoverPath(existing?.coverImage ?? null, viewer.id)
      const updated = await prisma.user.update({
        where: { id: viewer.id },
        data: { coverImage: path },
        select: { id: true, coverImage: true },
      })

      const signedUrl = await createSignedUrlIfNeeded(path, SIGN_EXPIRES_IN, COVER_BUCKET)

      if (oldCoverPath) {
        void deleteCoverFile(oldCoverPath)
      }

      revalidateTag("user:self")
      revalidateTag(`user:${viewer.id}`)

      return createSuccessResponse({
        id: updated.id,
        coverImage: updated.coverImage,
        signedUrl: signedUrl ?? updated.coverImage,
      })
    } catch (error) {
      logger.error("更新封面图数据库记录失败，开始回滚", error as Error)
      await deleteCoverFile(path)
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, "封面上传失败，请稍后重试")
    }
  } catch (error) {
    logger.error("封面上传接口异常", error as Error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "服务器内部错误")
  }
}

async function handleDelete(request: NextRequest) {
  try {
    const csrfError = rejectIfCsrfInvalid(request)
    if (csrfError) return csrfError

    const [viewer, authError] = await assertPolicy("user-active", buildPolicyContext(request))
    if (!viewer) {
      if (authError?.code === "ACCOUNT_BANNED") {
        return createErrorResponse(ErrorCode.FORBIDDEN, "您的账户已被限制，无法删除封面")
      }
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录")
    }

    const existing = await prisma.user.findUnique({
      where: { id: viewer.id },
      select: { coverImage: true },
    })

    const coverPath = extractUserCoverPath(existing?.coverImage ?? null, viewer.id)
    if (!existing || !existing.coverImage) {
      return createSuccessResponse({
        id: viewer.id,
        coverImage: null,
        deleted: false,
      })
    }

    if (coverPath) {
      await deleteCoverFile(coverPath)
    }

    const updated = await prisma.user.update({
      where: { id: viewer.id },
      data: { coverImage: null },
      select: { id: true, coverImage: true },
    })

    revalidateTag("user:self")
    revalidateTag(`user:${viewer.id}`)

    return createSuccessResponse({
      id: updated.id,
      coverImage: null,
      deleted: true,
    })
  } catch (error) {
    logger.error("删除封面图失败", error as Error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "删除封面图失败")
  }
}

export const POST = withApiResponseMetrics(handlePost)
export const DELETE = withApiResponseMetrics(handleDelete)
