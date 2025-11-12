/**
 * 图片上传工具函数
 * 提供图片验证、文件名生成等功能
 */

// 上传配置
export const UPLOAD_CONFIG = {
  maxFiles: 9,
  maxSizePerFile: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const,
  maxWidth: 4096,
  maxHeight: 4096,
} as const

// 验证结果接口
export interface ImageValidationResult {
  isValid: boolean
  error?: string
  metadata?: {
    size: number
    type: string
    extension: string
  }
}

/**
 * 验证图片文件
 */
export function validateImageFile(file: File): ImageValidationResult {
  // 检查文件大小
  if (file.size === 0) {
    return {
      isValid: false,
      error: "文件为空",
    }
  }

  if (file.size > UPLOAD_CONFIG.maxSizePerFile) {
    return {
      isValid: false,
      error: `文件大小超过限制（${formatFileSize(UPLOAD_CONFIG.maxSizePerFile)}）`,
    }
  }

  // 检查文件类型
  if (!UPLOAD_CONFIG.allowedTypes.includes(file.type as any)) {
    return {
      isValid: false,
      error: `不支持的文件格式，支持格式：${UPLOAD_CONFIG.allowedTypes.join(", ")}`,
    }
  }

  // 检查文件扩展名
  const extension = getFileExtension(file.name).toLowerCase()
  if (!UPLOAD_CONFIG.allowedExtensions.includes(extension as any)) {
    return {
      isValid: false,
      error: `不支持的文件扩展名：${extension}`,
    }
  }

  // 检查文件名长度
  if (file.name.length > 255) {
    return {
      isValid: false,
      error: "文件名过长",
    }
  }

  return {
    isValid: true,
    metadata: {
      size: file.size,
      type: file.type,
      extension,
    },
  }
}

/**
 * 生成安全的文件名
 */
export function generateFileName(file: File, index?: number): string {
  const extension = getFileExtension(file.name)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const indexSuffix = index !== undefined ? `_${index}` : ""

  // 生成格式：timestamp_random_index.ext
  return `${timestamp}_${random}${indexSuffix}${extension}`
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  return lastDot > 0 ? filename.substring(lastDot) : ""
}

/**
 * 格式化文件大小为可读字符串
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`
}

/**
 * 批量验证图片文件
 */
export function validateImageFiles(files: File[]): {
  valid: File[]
  invalid: Array<{ file: File; error: string }>
  totalSize: number
} {
  const valid: File[] = []
  const invalid: Array<{ file: File; error: string }> = []
  let totalSize = 0

  // 检查文件数量
  if (files.length > UPLOAD_CONFIG.maxFiles) {
    return {
      valid: [],
      invalid: files.map((file) => ({
        file,
        error: `文件数量超过限制（最多${UPLOAD_CONFIG.maxFiles}张）`,
      })),
      totalSize: 0,
    }
  }

  // 逐个验证文件
  for (const file of files) {
    const validation = validateImageFile(file)

    if (validation.isValid) {
      valid.push(file)
      totalSize += file.size
    } else {
      invalid.push({
        file,
        error: validation.error || "验证失败",
      })
    }
  }

  // 检查总文件大小
  if (totalSize > UPLOAD_CONFIG.maxTotalSize) {
    return {
      valid: [],
      invalid: files.map((file) => ({
        file,
        error: `文件总大小超过限制（${formatFileSize(UPLOAD_CONFIG.maxTotalSize)}）`,
      })),
      totalSize,
    }
  }

  return { valid, invalid, totalSize }
}

/**
 * 检查图片尺寸（需要在浏览器环境中使用）
 */
export function validateImageDimensions(file: File): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      // 服务器环境跳过尺寸检查
      resolve({ isValid: true })
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      if (img.width > UPLOAD_CONFIG.maxWidth || img.height > UPLOAD_CONFIG.maxHeight) {
        resolve({
          isValid: false,
          error: `图片尺寸过大，最大支持 ${UPLOAD_CONFIG.maxWidth}x${UPLOAD_CONFIG.maxHeight}`,
        })
      } else {
        resolve({ isValid: true })
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({
        isValid: false,
        error: "无法读取图片文件",
      })
    }

    img.src = url
  })
}

/**
 * 压缩图片（客户端使用）
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      // 服务器环境直接返回原文件
      resolve(file)
      return
    }

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    if (!ctx) {
      reject(new Error("无法创建canvas上下文"))
      return
    }

    img.onload = () => {
      // 计算压缩后的尺寸
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      // 绘制压缩后的图片
      ctx.drawImage(img, 0, 0, width, height)

      // 转换为blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // 创建新的File对象
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          } else {
            reject(new Error("图片压缩失败"))
          }
        },
        file.type,
        quality
      )
    }

    img.onerror = () => {
      reject(new Error("无法加载图片"))
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * 生成图片预览URL
 */
export function createImagePreviewURL(file: File): string {
  if (typeof window === "undefined") {
    return ""
  }
  return URL.createObjectURL(file)
}

/**
 * 释放图片预览URL
 */
export function revokeImagePreviewURL(url: string): void {
  if (typeof window !== "undefined") {
    URL.revokeObjectURL(url)
  }
}

/**
 * 检查浏览器是否支持WebP格式
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false)
      return
    }

    const webP = new Image()
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2)
    }
    webP.src =
      "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA"
  })
}

/**
 * 获取图片的MIME类型
 */
export function getImageMimeType(file: File): string {
  const extension = getFileExtension(file.name).toLowerCase()

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".webp":
      return "image/webp"
    case ".gif":
      return "image/gif"
    default:
      return file.type || "application/octet-stream"
  }
}
