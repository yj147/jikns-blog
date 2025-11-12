"use server"

/**
 * 图片上传 Server Actions - Phase 5.1.4
 * 实现 Supabase Storage 集成的图片上传功能
 */

import { createClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"
import { logger } from "@/lib/utils/logger"

// 定义 ApiResponse 类型（避免导入问题）
interface ApiError {
  code: string
  message: string
  timestamp: number
  details?: any
}

interface ApiMeta {
  requestId: string
  timestamp: number
  warnings?: string[]
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

// 允许的图片类型和配置
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB (与 RLS 策略一致)
const UPLOAD_BUCKET = "post-images"
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1秒

export interface UploadImageResult {
  url: string
  publicUrl: string
  path: string
  size: number
  fileName: string
}

/**
 * 生成唯一文件名
 */
function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split(".").pop() || "jpg"
  return `${timestamp}-${randomString}.${extension}`
}

/**
 * 等待指定时间
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 验证图片文件
 */
function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // 检查文件是否为空
  if (!file || file.size === 0) {
    return {
      isValid: false,
      error: "文件为空或无效",
    }
  }

  // 检查文件名
  if (!file.name || file.name.trim().length === 0) {
    return {
      isValid: false,
      error: "文件名无效",
    }
  }

  // 检查文件类型
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `不支持的文件类型: ${file.type}。支持的格式: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    }
  }

  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB 超出限制。最大支持: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  // 检查文件扩展名和 MIME 类型是否匹配
  const fileExtension = file.name.split(".").pop()?.toLowerCase()
  const expectedExtensions: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "image/svg+xml": ["svg"],
  }

  const validExtensions = expectedExtensions[file.type] || []
  if (fileExtension && validExtensions.length > 0 && !validExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: `文件扩展名 .${fileExtension} 与文件类型 ${file.type} 不匹配`,
    }
  }

  return { isValid: true }
}

/**
 * 带重试的 Supabase Storage 上传
 */
async function uploadWithRetry(
  supabase: any,
  bucket: string,
  path: string,
  file: File,
  retries = MAX_RETRIES
): Promise<{ data: any; error: any }> {
  let lastError: any = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug("执行图片上传尝试", { path, attempt, retries })

      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })

      // 成功上传
      if (!error) {
        logger.info("图片上传成功", { path, attempt })
        return { data, error: null }
      }

      lastError = error
      logger.warn("图片上传失败", {
        path,
        attempt,
        error: error.message ?? String(error),
      })

      // 检查是否为可重试的错误
      const isRetryableError =
        error.message?.includes("network") ||
        error.message?.includes("timeout") ||
        error.message?.includes("502") ||
        error.message?.includes("503") ||
        error.message?.includes("504") ||
        error.statusCode === "502" ||
        error.statusCode === "503" ||
        error.statusCode === "504"

      // 如果不是可重试的错误，直接返回
      if (!isRetryableError) {
        logger.error("图片上传遇到不可重试错误", { path, attempt }, error)
        return { data: null, error }
      }

      // 如果不是最后一次尝试，等待后重试
      if (attempt < retries) {
        const waitTime = RETRY_DELAY * attempt // 递增等待时间
        logger.debug("等待后重试图片上传", { path, attempt, waitTime })
        await delay(waitTime)
      }
    } catch (err) {
      lastError = err
      logger.error("图片上传发生异常", { path, attempt }, err)

      // 如果不是最后一次尝试，等待后重试
      if (attempt < retries) {
        const waitTime = RETRY_DELAY * attempt
        logger.debug("等待后重试图片上传", { path, attempt, waitTime })
        await delay(waitTime)
      }
    }
  }

  logger.error("图片上传所有重试均失败", { path, retries }, lastError)
  return { data: null, error: lastError }
}

/**
 * 上传图片到 Supabase Storage
 */
export async function uploadImage(formData: FormData): Promise<ApiResponse<UploadImageResult>> {
  let user: { id: string } | null = null
  try {
    // 验证用户认证
    const authenticatedUser = await requireAuth()
    user = authenticatedUser

    const file = formData.get("file") as File

    if (!file) {
      return {
        success: false,
        error: {
          code: "MISSING_FILE",
          message: "请选择要上传的文件",
          timestamp: Date.now(),
        },
      }
    }

    // 验证文件
    const validation = validateImageFile(file)
    if (!validation.isValid) {
      return {
        success: false,
        error: {
          code: "INVALID_FILE",
          message: validation.error!,
          timestamp: Date.now(),
        },
      }
    }

    // 生成唯一文件名
    const fileName = generateUniqueFileName(file.name)
    const filePath = `${authenticatedUser.id}/${fileName}`

    // 创建 Supabase 客户端
    const supabase = createClient()

    // 上传文件到 Storage（使用重试机制）
    const { data: uploadData, error: uploadError } = await uploadWithRetry(
      supabase,
      UPLOAD_BUCKET,
      filePath,
      file
    )

    if (uploadError) {
      logger.error(
        "Supabase Storage 上传失败",
        { path: filePath, userId: authenticatedUser.id },
        uploadError
      )

      // 根据错误类型返回更详细的错误信息
      let errorCode = "UPLOAD_FAILED"
      let errorMessage = `图片上传失败: ${uploadError.message || "未知错误"}`

      if (uploadError.statusCode === "403" || uploadError.message?.includes("policy")) {
        errorCode = "PERMISSION_DENIED"
        errorMessage = "没有权限上传文件，请检查登录状态或联系管理员"
      } else if (uploadError.statusCode === "413" || uploadError.message?.includes("too large")) {
        errorCode = "FILE_TOO_LARGE"
        errorMessage = `文件过大，请选择小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的图片`
      } else if (
        uploadError.message?.includes("network") ||
        uploadError.message?.includes("timeout")
      ) {
        errorCode = "NETWORK_ERROR"
        errorMessage = "网络连接失败，请检查网络后重试"
      } else if (uploadError.statusCode?.startsWith("5")) {
        errorCode = "SERVER_ERROR"
        errorMessage = "服务器暂时不可用，请稍后重试"
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          timestamp: Date.now(),
          details: uploadError,
        },
      }
    }

    // 获取公共访问 URL
    const { data: publicUrlData } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(filePath)

    if (!publicUrlData.publicUrl) {
      return {
        success: false,
        error: {
          code: "URL_GENERATION_FAILED",
          message: "生成图片访问链接失败",
          timestamp: Date.now(),
        },
      }
    }

    const result: UploadImageResult = {
      url: publicUrlData.publicUrl,
      publicUrl: publicUrlData.publicUrl,
      path: filePath,
      size: file.size,
      fileName: file.name,
    }

    return {
      success: true,
      data: result,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    logger.error("上传图片操作失败", { userId: user?.id }, error)

    // 处理各种常见错误情况
    if (error instanceof Error) {
      // Next.js body size limit 错误
      if (error.message.includes("Body exceeded") || error.message.includes("1 MB limit")) {
        return {
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: `文件过大，请选择小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的图片`,
            timestamp: Date.now(),
          },
        }
      }

      // HTTP 413 Payload Too Large 错误
      if (error.message.includes("413") || error.message.includes("Payload Too Large")) {
        return {
          success: false,
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: `文件大小超出服务器限制，请选择更小的图片文件`,
            timestamp: Date.now(),
          },
        }
      }

      // 网络超时错误
      if (error.message.includes("timeout") || error.message.includes("TIMEOUT")) {
        return {
          success: false,
          error: {
            code: "UPLOAD_TIMEOUT",
            message: `上传超时，请检查网络连接后重试`,
            timestamp: Date.now(),
          },
        }
      }

      // 网络连接错误
      if (
        error.message.includes("network") ||
        error.message.includes("NETWORK") ||
        error.message.includes("fetch")
      ) {
        return {
          success: false,
          error: {
            code: "NETWORK_ERROR",
            message: `网络连接失败，请检查网络后重试`,
            timestamp: Date.now(),
          },
        }
      }

      // CORS 错误
      if (error.message.includes("CORS") || error.message.includes("cors")) {
        return {
          success: false,
          error: {
            code: "CORS_ERROR",
            message: `跨域请求被阻止，请联系管理员`,
            timestamp: Date.now(),
          },
        }
      }
    }

    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "图片上传失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 删除 Storage 中的图片
 */
export async function deleteImage(
  filePath: string
): Promise<ApiResponse<{ path: string; message: string }>> {
  try {
    // 验证用户认证
    await requireAuth()

    if (!filePath) {
      return {
        success: false,
        error: {
          code: "MISSING_PATH",
          message: "请提供文件路径",
          timestamp: Date.now(),
        },
      }
    }

    // 创建 Supabase 客户端
    const supabase = createClient()

    // 从 Storage 删除文件
    const { error: deleteError } = await supabase.storage.from(UPLOAD_BUCKET).remove([filePath])

    if (deleteError) {
      logger.error("Supabase Storage 删除失败", { path: filePath }, deleteError)
      return {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: `删除图片失败: ${deleteError.message}`,
          timestamp: Date.now(),
        },
      }
    }

    return {
      success: true,
      data: {
        path: filePath,
        message: "图片删除成功",
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    logger.error("删除图片操作失败", { path: filePath }, error)
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "删除图片失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 批量上传图片（用于粘贴和拖拽多个文件）
 */
export async function uploadMultipleImages(
  formData: FormData
): Promise<ApiResponse<UploadImageResult[]>> {
  try {
    // 验证用户认证
    const user = await requireAuth()

    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return {
        success: false,
        error: {
          code: "MISSING_FILES",
          message: "请选择要上传的文件",
          timestamp: Date.now(),
        },
      }
    }

    // 限制批量上传数量
    if (files.length > 10) {
      return {
        success: false,
        error: {
          code: "TOO_MANY_FILES",
          message: "一次最多上传10个文件",
          timestamp: Date.now(),
        },
      }
    }

    const results: UploadImageResult[] = []
    const errors: string[] = []

    // 创建 Supabase 客户端
    const supabase = createClient()

    // 串行上传每个文件以避免并发限制
    for (const file of files) {
      // 验证单个文件
      const validation = validateImageFile(file)
      if (!validation.isValid) {
        errors.push(`${file.name}: ${validation.error}`)
        continue
      }

      try {
        // 生成唯一文件名
        const fileName = generateUniqueFileName(file.name)
        const filePath = `${user.id}/${fileName}`

        // 上传文件
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) {
          errors.push(`${file.name}: 上传失败 - ${uploadError.message}`)
          continue
        }

        // 获取公共访问 URL
        const { data: publicUrlData } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(filePath)

        if (publicUrlData.publicUrl) {
          results.push({
            url: publicUrlData.publicUrl,
            publicUrl: publicUrlData.publicUrl,
            path: filePath,
            size: file.size,
            fileName: file.name,
          })
        } else {
          errors.push(`${file.name}: 生成访问链接失败`)
        }
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "未知错误"}`)
      }
    }

    // 如果有成功上传的文件，返回部分成功
    if (results.length > 0) {
      return {
        success: true,
        data: results,
        meta: {
          requestId: crypto.randomUUID(),
          timestamp: Date.now(),
          warnings: errors.length > 0 ? errors : undefined,
        },
      }
    }

    // 如果全部失败，返回错误
    return {
      success: false,
      error: {
        code: "ALL_UPLOADS_FAILED",
        message: "所有文件上传失败",
        details: errors,
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    logger.error("批量上传图片失败", {}, error)
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "批量上传失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 获取用户上传的图片列表
 */
export async function getUserImages(): Promise<
  ApiResponse<{ name: string; size: number; url: string }[]>
> {
  try {
    // 验证用户认证
    const user = await requireAuth()

    // 创建 Supabase 客户端
    const supabase = createClient()

    // 列出用户文件夹中的所有文件
    const { data: files, error } = await supabase.storage.from(UPLOAD_BUCKET).list(user.id, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    })

    if (error) {
      logger.error("获取图片列表失败", { userId: user.id }, error)
      return {
        success: false,
        error: {
          code: "LIST_FAILED",
          message: `获取图片列表失败: ${error.message}`,
          timestamp: Date.now(),
        },
      }
    }

    // 生成带公共URL的文件列表
    const images = files
      .filter((file) => file.name !== ".emptyFolderPlaceholder") // 过滤占位符文件
      .map((file) => {
        const { data: urlData } = supabase.storage
          .from(UPLOAD_BUCKET)
          .getPublicUrl(`${user.id}/${file.name}`)

        return {
          name: file.name,
          size: file.metadata?.size || 0,
          url: urlData.publicUrl,
        }
      })

    return {
      success: true,
      data: images,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    logger.error("获取用户图片失败", {}, error)
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "获取图片列表失败",
        timestamp: Date.now(),
      },
    }
  }
}
