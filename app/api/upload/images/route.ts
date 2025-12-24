import { logger } from "@/lib/utils/logger"
import { NextRequest } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase"
import { assertPolicy } from "@/lib/auth/session"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { validateImageFile, generateFileName, formatFileSize } from "@/lib/upload/image-utils"
import { createSignedUrlIfNeeded } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { CSRFProtection } from "@/lib/security"
import { getClientIp } from "@/lib/api/get-client-ip"

// 上传配置
const uploadConfig = {
  maxFiles: 9, // 最多9张图片
  maxSizePerFile: 10 * 1024 * 1024, // 单张10MB
  maxTotalSize: 50 * 1024 * 1024, // 总计50MB
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  bucketName: "activity-images",
}

const avatarConfig = {
  maxFiles: 1,
  maxSizePerFile: 5 * 1024 * 1024, // 单张5MB
  pathPrefix: "avatars",
}

const SIGNED_URL_EXPIRES_IN = 60 * 60 // 1 小时

type UploadPurpose = "default" | "avatar"

function getUploadPurpose(request: NextRequest): UploadPurpose {
  const purpose = request.nextUrl.searchParams.get("purpose")?.toLowerCase()
  return purpose === "avatar" ? "avatar" : "default"
}

function validateAvatarFile(file: File) {
  if (file.size > avatarConfig.maxSizePerFile) {
    return {
      isValid: false,
      error: `头像大小超过限制（${formatFileSize(avatarConfig.maxSizePerFile)}）`,
    }
  }

  return validateImageFile(file)
}

function buildUploadPath(purpose: UploadPurpose, userId: string, fileName: string) {
  if (purpose === "avatar") {
    return `${avatarConfig.pathPrefix}/${userId}/${Date.now()}-${fileName}`
  }

  return `activities/${userId}/${Date.now()}/${fileName}`
}

function rejectIfCsrfInvalid(request: NextRequest) {
  // Server Action 内部调用跳过 CSRF 检查
  if (request.headers.get("X-Internal-Request") === "server-action") {
    return null
  }

  if (CSRFProtection.validateToken(request)) return null

  logger.warn("CSRF token missing or invalid for upload", {
    module: "api/upload/images",
    path: request.nextUrl.pathname,
    method: request.method,
  })

  return createErrorResponse(ErrorCode.FORBIDDEN, "CSRF token 缺失或无效")
}

// POST /api/upload/images - 批量图片上传
async function handlePost(request: NextRequest) {
  try {
    const csrfError = rejectIfCsrfInvalid(request)
    if (csrfError) return csrfError

    const uploadPurpose = getUploadPurpose(request)

    const [activeUser, authError] = await assertPolicy("user-active", buildPolicyContext(request))
    if (!activeUser) {
      if (authError?.code === "ACCOUNT_BANNED") {
        return createErrorResponse(ErrorCode.FORBIDDEN, "您的账户已被限制，无法上传图片")
      }
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录")
    }

    // 解析 FormData
    const formData = await request.formData()
    const files = formData.getAll("files").filter((item): item is File => item instanceof File)

    // 验证文件数量
    if (files.length === 0) {
      return createErrorResponse(
        ErrorCode.INVALID_PARAMETERS,
        uploadPurpose === "avatar" ? "请选择要上传的头像" : "请选择要上传的图片"
      )
    }

    const maxFiles = uploadPurpose === "avatar" ? avatarConfig.maxFiles : uploadConfig.maxFiles
    if (files.length > maxFiles) {
      const message =
        uploadPurpose === "avatar"
          ? "头像仅支持单文件上传"
          : `最多上传${uploadConfig.maxFiles}张图片`

      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, message)
    }

    // 验证总文件大小
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const maxTotalSize =
      uploadPurpose === "avatar" ? avatarConfig.maxSizePerFile : uploadConfig.maxTotalSize
    if (totalSize > maxTotalSize) {
      const message =
        uploadPurpose === "avatar"
          ? `头像大小超过限制（${formatFileSize(avatarConfig.maxSizePerFile)}）`
          : "文件总大小超过限制（50MB）"

      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, message)
    }

    const supabase = await createRouteHandlerClient()

    // 并行上传所有文件
    const uploadPromises = files.map(async (file, index) => {
      try {
        // 验证单个文件
        const validation =
          uploadPurpose === "avatar" ? validateAvatarFile(file) : validateImageFile(file)
        if (!validation.isValid) {
          return {
            success: false,
            error: validation.error,
            index,
            fileName: file.name,
          }
        }

        // 生成存储路径
        const fileName = generateFileName(file, index)
        const path = buildUploadPath(uploadPurpose, activeUser.id, fileName)

        // 上传到 Supabase Storage
        const { error } = await supabase.storage.from(uploadConfig.bucketName).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })

        if (error) {
          logger.error(`文件上传失败 ${file.name}:`, error as Error)
          return {
            success: false,
            error: error.message,
            index,
            fileName: file.name,
          }
        }

        const signedUrl = await createSignedUrlIfNeeded(path, SIGNED_URL_EXPIRES_IN)

        return {
          success: true,
          url: signedUrl,
          signedUrl,
          signedUrlExpiresIn: SIGNED_URL_EXPIRES_IN,
          path,
          index,
          fileName: file.name,
          size: file.size,
        }
      } catch (error) {
        logger.error(`处理文件失败 ${file.name}:`, error as Error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
          index,
          fileName: file.name,
        }
      }
    })

    // 等待所有上传完成
    const results = await Promise.all(uploadPromises)

    // 分离成功和失败的结果
    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    // 如果全部失败
    if (successful.length === 0) {
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "所有文件上传失败", {
        failed: failed.map((f) => ({
          index: f.index,
          fileName: f.fileName,
          error: f.error,
        })),
      })
    }

    return createSuccessResponse({
      uploaded: successful.length,
      total: files.length,
      urls: successful
        .map((r) => r.signedUrl || r.url || null)
        .filter((item): item is string => Boolean(item)),
      details: successful.map((r) => ({
        path: r.path,
        signedUrl: r.signedUrl,
        signedUrlExpiresIn: r.signedUrlExpiresIn,
        fileName: r.fileName,
        size: r.size,
        index: r.index,
      })),
      ...(failed.length > 0 && {
        failed: failed.map((f) => ({
          index: f.index,
          fileName: f.fileName,
          error: f.error,
        })),
      }),
    })
  } catch (error) {
    logger.error("批量上传异常:", error as Error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "服务器内部错误")
  }
}

// DELETE /api/upload/images - 删除图片
async function handleDelete(request: NextRequest) {
  try {
    const csrfError = rejectIfCsrfInvalid(request)
    if (csrfError) return csrfError

    // 用户认证
    const [viewer] = await assertPolicy("any", buildPolicyContext(request))
    if (!viewer) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录")
    }

    const { searchParams } = new URL(request.url)
    const imagePath = searchParams.get("path")

    if (!imagePath) {
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "缺少图片路径参数")
    }

    // 验证路径是否属于当前用户
    const canDeleteActivities = imagePath.startsWith(`activities/${viewer.id}/`)
    const canDeleteAvatars = imagePath.startsWith(`${avatarConfig.pathPrefix}/${viewer.id}/`)

    if (!canDeleteActivities && !canDeleteAvatars) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "无权限删除此图片")
    }

    const supabase = await createRouteHandlerClient()

    // 删除文件
    const { error } = await supabase.storage.from(uploadConfig.bucketName).remove([imagePath])

    if (error) {
      logger.error("删除图片失败:", error as Error)
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, "删除图片失败")
    }

    return createSuccessResponse({
      deleted: true,
      path: imagePath,
    })
  } catch (error) {
    logger.error("删除图片异常:", error as Error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "服务器内部错误")
  }
}

export const POST = withApiResponseMetrics(handlePost)
export const DELETE = withApiResponseMetrics(handleDelete)

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
