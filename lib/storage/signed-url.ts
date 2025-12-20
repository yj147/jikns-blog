/**
 * Storage 签名 URL 工具
 * - 将存储路径或 Supabase 公网 URL 转换为签名 URL（默认 1 小时）
 * - 仅在服务器端调用（依赖 service_role）
 */

import { createServiceRoleClient } from "@/lib/supabase"
import { logger } from "@/lib/utils/logger"
import type { ActivityListItem } from "@/lib/repos/activity-repo"

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 // 1 hour
const ACTIVITY_IMAGES_BUCKET = "activity-images"
const POST_IMAGES_BUCKET = "post-images"
const DEFAULT_BUCKET = ACTIVITY_IMAGES_BUCKET
const SIGNABLE_BUCKETS = new Set<string>([ACTIVITY_IMAGES_BUCKET, POST_IMAGES_BUCKET])

type StorageTarget = {
  bucket: string
  path: string
}

let cachedServiceClient: ReturnType<typeof createServiceRoleClient> | null = null

function getServiceClient() {
  if (!cachedServiceClient) {
    cachedServiceClient = createServiceRoleClient()
  }
  return cachedServiceClient
}

/**
 * 从 URL 或相对路径解析出 bucket 与对象路径
 * 兼容以下形式：
 * - https://.../storage/v1/object/public/activity-images/avatars/{uid}/xxx
 * - https://.../storage/v1/object/sign/activity-images/avatars/{uid}/xxx?token=...
 * - activity-images/avatars/{uid}/xxx
 * - avatars/{uid}/xxx  (默认 bucket: activity-images)
 */
export function parseStorageTarget(
  input?: string | null,
  defaultBucket = DEFAULT_BUCKET
): StorageTarget | null {
  if (!input) return null

  // data: URL 或非字符串不处理
  if (input.startsWith("data:")) return null

  // 直接传入相对路径
  const normalized = input.replace(/^\/+/, "")
  if (!normalized.startsWith("http")) {
    if (SIGNABLE_BUCKETS.has(normalized.split("/")[0])) {
      const [bucket, ...rest] = normalized.split("/")
      const path = rest.join("/")
      if (!bucket || !path) return null
      return { bucket, path }
    }

    if (normalized.startsWith(`${defaultBucket}/`)) {
      return {
        bucket: defaultBucket,
        path: normalized.slice(defaultBucket.length + 1),
      }
    }

    if (
      normalized.startsWith("avatars/") ||
      normalized.startsWith("covers/") ||
      normalized.startsWith("activities/") ||
      normalized.startsWith("users/")
    ) {
      return {
        bucket: defaultBucket,
        path: normalized,
      }
    }

    // 对于非默认 bucket（例如 post-images）允许裸路径落在指定 bucket 下
    if (defaultBucket !== DEFAULT_BUCKET) {
      return {
        bucket: defaultBucket,
        path: normalized,
      }
    }

    return null
  }

  try {
    const url = new URL(normalized)
    const segments = url.pathname.split("/").filter(Boolean)
    const objectIndex = segments.findIndex((segment) => segment === "object")

    if (objectIndex === -1) return null

    // /storage/v1/object/{public|sign}/{bucket}/{...path}
    const bucket = segments[objectIndex + 2]
    const path = decodeURIComponent(segments.slice(objectIndex + 3).join("/"))

    if (!bucket || !path) return null

    return { bucket, path }
  } catch {
    return null
  }
}

function normalizePath(bucket: string, path: string) {
  const cleaned = path.replace(/^\/+/, "")
  if (cleaned.startsWith(`${bucket}/`)) {
    return cleaned.slice(bucket.length + 1)
  }
  return cleaned
}

function isSignableBucket(bucket: string) {
  return SIGNABLE_BUCKETS.has(bucket)
}

async function signSingle(target: StorageTarget, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS) {
  try {
    if (!isSignableBucket(target.bucket)) {
      return null
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase.storage
      .from(target.bucket)
      .createSignedUrl(normalizePath(target.bucket, target.path), expiresInSeconds)

    if (error || !data?.signedUrl) {
      logger.warn("签名 URL 生成失败", {
        bucket: target.bucket,
        path: target.path,
        error: error?.message,
      })
      return null
    }

    return data.signedUrl
  } catch (error) {
    logger.error(
      "签名 URL 生成异常",
      { bucket: target.bucket, path: target.path, expiresInSeconds },
      error
    )
    return null
  }
}

/**
 * 针对单个地址生成签名 URL；无法解析或非 Storage 资源时返回原值
 */
export async function createSignedUrlIfNeeded(
  input?: string | null,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
  defaultBucket = DEFAULT_BUCKET
): Promise<string | null> {
  const target = parseStorageTarget(input, defaultBucket)
  if (!target) return input ?? null

  const signed = await signSingle(target, expiresInSeconds)
  return signed ?? input ?? null
}

/**
 * 批量生成签名 URL，自动去重
 */
export async function createSignedUrls(
  inputs: Array<string | null | undefined>,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
  defaultBucket = DEFAULT_BUCKET
): Promise<string[]> {
  const cache = new Map<string, Promise<string | null>>()

  const tasks = inputs.map(async (value) => {
    const target = parseStorageTarget(value, defaultBucket)
    if (!target) return value ?? null

    const cacheKey = `${target.bucket}:${target.path}:${expiresInSeconds}`
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, signSingle(target, expiresInSeconds))
    }
    const signed = await cache.get(cacheKey)!
    return signed ?? value ?? null
  })

  const results = await Promise.all(tasks)
  return results.filter((item): item is string => Boolean(item))
}

/**
 * 为用户头像生成签名 URL
 */
export async function signAvatarUrl(avatarUrl?: string | null): Promise<string | null> {
  return createSignedUrlIfNeeded(avatarUrl)
}

/**
 * 为用户封面图生成签名 URL
 */
export async function signCoverImageUrl(coverImage?: string | null): Promise<string | null> {
  return createSignedUrlIfNeeded(coverImage)
}

/**
 * 为活动图片批量生成签名 URL
 */
export async function signActivityImages(
  imageUrls: string[] | null | undefined
): Promise<string[]> {
  if (!imageUrls || imageUrls.length === 0) return []
  return createSignedUrls(imageUrls)
}

/**
 * 通用的签名 URL 生成器
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS
): Promise<string | null> {
  if (!bucket || !path) return null

  const normalizedBucket = bucket.trim()
  const normalizedPath = normalizePath(normalizedBucket, path)
  if (!normalizedPath) return null

  return signSingle({ bucket: normalizedBucket, path: normalizedPath }, expiresInSeconds)
}

/**
 * 为单条动态补充签名媒体地址（图片 + 作者头像）
 */
export async function signActivityListItem(item: ActivityListItem): Promise<ActivityListItem> {
  const [signedImages, signedAvatar] = await Promise.all([
    signActivityImages(item.imageUrls),
    signAvatarUrl(item.author.avatarUrl),
  ])

  return {
    ...item,
    imageUrls: signedImages,
    author: {
      ...item.author,
      avatarUrl: signedAvatar ?? item.author.avatarUrl,
    },
  }
}

export async function signActivityListItems(
  items: ActivityListItem[]
): Promise<ActivityListItem[]> {
  return Promise.all(items.map((item) => signActivityListItem(item)))
}

export function resetSignedUrlCache() {
  cachedServiceClient = null
}
