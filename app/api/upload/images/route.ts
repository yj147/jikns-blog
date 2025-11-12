import { logger } from "@/lib/utils/logger"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { validateImageFile, generateFileName } from "@/lib/upload/image-utils"

// 上传配置
const uploadConfig = {
  maxFiles: 9, // 最多9张图片
  maxSizePerFile: 10 * 1024 * 1024, // 单张10MB
  maxTotalSize: 50 * 1024 * 1024, // 总计50MB
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  bucketName: "activity-images",
}

// POST /api/upload/images - 批量图片上传
export async function POST(request: NextRequest) {
  try {
    // 用户认证
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录")
    }

    // 检查用户状态
    if (user.status !== "ACTIVE") {
      return createErrorResponse(ErrorCode.FORBIDDEN, "您的账户已被限制，无法上传图片")
    }

    // 解析 FormData
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    // 验证文件数量
    if (files.length === 0) {
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "请选择要上传的图片")
    }

    if (files.length > uploadConfig.maxFiles) {
      return createErrorResponse(
        ErrorCode.INVALID_PARAMETERS,
        `最多上传${uploadConfig.maxFiles}张图片`
      )
    }

    // 验证总文件大小
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > uploadConfig.maxTotalSize) {
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "文件总大小超过限制（50MB）")
    }

    const supabase = createClient()

    // 并行上传所有文件
    const uploadPromises = files.map(async (file, index) => {
      try {
        // 验证单个文件
        const validation = validateImageFile(file)
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
        const path = `activities/${user.id}/${Date.now()}/${fileName}`

        // 上传到 Supabase Storage
        const { data, error } = await supabase.storage
          .from(uploadConfig.bucketName)
          .upload(path, file, {
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

        // 获取公开URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(uploadConfig.bucketName).getPublicUrl(path)

        return {
          success: true,
          url: publicUrl,
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
      urls: successful.map((r) => r.url),
      details: successful.map((r) => ({
        url: r.url,
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
export async function DELETE(request: NextRequest) {
  try {
    // 用户认证
    const user = await getCurrentUser()
    if (!user) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, "请先登录")
    }

    const { searchParams } = new URL(request.url)
    const imagePath = searchParams.get("path")

    if (!imagePath) {
      return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "缺少图片路径参数")
    }

    // 验证路径是否属于当前用户
    if (!imagePath.startsWith(`activities/${user.id}/`)) {
      return createErrorResponse(ErrorCode.FORBIDDEN, "无权限删除此图片")
    }

    const supabase = createClient()

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
