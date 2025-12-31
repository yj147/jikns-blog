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
const SIGNED_URL_CACHE_MAX_ENTRIES = 500
const SIGNED_URL_CACHE_MARGIN_SECONDS = 5

type StorageTarget = {
  bucket: string
  path: string
}

type SignedUrlCacheEntry = {
  value: string
  expiresAt: number
}

let cachedServiceClient: ReturnType<typeof createServiceRoleClient> | null = null
const signedUrlCache = new Map<string, SignedUrlCacheEntry>()
const signedUrlInFlight = new Map<string, Promise<string | null>>()

function getServiceClient() {
  if (!cachedServiceClient) {
    cachedServiceClient = createServiceRoleClient()
  }
  return cachedServiceClient
}

function getCacheTtlMs(expiresInSeconds: number) {
  const ttlSeconds = Math.max(0, expiresInSeconds - SIGNED_URL_CACHE_MARGIN_SECONDS)
  return ttlSeconds * 1000
}

function pruneSignedUrlCache() {
  if (signedUrlCache.size <= SIGNED_URL_CACHE_MAX_ENTRIES) return

  const now = Date.now()
  for (const [key, entry] of signedUrlCache) {
    if (entry.expiresAt <= now) {
      signedUrlCache.delete(key)
    }
  }

  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX_ENTRIES) {
    const firstKey = signedUrlCache.keys().next().value
    if (typeof firstKey !== "string") break
    signedUrlCache.delete(firstKey)
  }
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
  const normalizedPath = normalizePath(target.bucket, target.path)
  const cacheKey = `${target.bucket}:${normalizedPath}:${expiresInSeconds}`
  const cacheTtlMs = getCacheTtlMs(expiresInSeconds)

  if (cacheTtlMs > 0) {
    const cached = signedUrlCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const inFlight = signedUrlInFlight.get(cacheKey)
    if (inFlight) {
      return inFlight
    }
  }

  const request = (async () => {
    try {
      if (!isSignableBucket(target.bucket)) {
        return null
      }

      const supabase = getServiceClient()
      const { data, error } = await supabase.storage
        .from(target.bucket)
        .createSignedUrl(normalizedPath, expiresInSeconds)

      if (error || !data?.signedUrl) {
        logger.warn("签名 URL 生成失败", {
          bucket: target.bucket,
          path: target.path,
          error: error?.message,
        })
        return null
      }

      if (cacheTtlMs > 0) {
        pruneSignedUrlCache()
        signedUrlCache.set(cacheKey, {
          value: data.signedUrl,
          expiresAt: Date.now() + cacheTtlMs,
        })
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
  })()

  if (cacheTtlMs > 0) {
    signedUrlInFlight.set(cacheKey, request)
    request.finally(() => {
      signedUrlInFlight.delete(cacheKey)
    })
  }

  return request
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
  inputs: string[],
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
  defaultBucket = DEFAULT_BUCKET
): Promise<string[]> {
  if (inputs.length === 0) return []

  const cacheTtlMs = getCacheTtlMs(expiresInSeconds)
  const now = Date.now()
  const resolved = inputs.slice()

  type PendingEntry = {
    bucket: string
    path: string
    cacheKey: string
    indices: number[]
  }

  const pendingByKey = new Map<string, PendingEntry>()
  const awaitingByKey = new Map<string, { promise: Promise<string | null>; indices: number[] }>()

  for (let index = 0; index < inputs.length; index += 1) {
    const value = inputs[index]
    if (!value) {
      continue
    }

    const target = parseStorageTarget(value, defaultBucket)
    if (!target || !isSignableBucket(target.bucket)) {
      continue
    }

    const normalizedPath = normalizePath(target.bucket, target.path)
    const cacheKey = `${target.bucket}:${normalizedPath}:${expiresInSeconds}`

    if (cacheTtlMs > 0) {
      const cached = signedUrlCache.get(cacheKey)
      if (cached && cached.expiresAt > now) {
        resolved[index] = cached.value
        continue
      }

      const inFlight = signedUrlInFlight.get(cacheKey)
      if (inFlight) {
        const existing = awaitingByKey.get(cacheKey)
        if (existing) {
          existing.indices.push(index)
        } else {
          awaitingByKey.set(cacheKey, { promise: inFlight, indices: [index] })
        }
        continue
      }
    }

    const existing = pendingByKey.get(cacheKey)
    if (existing) {
      existing.indices.push(index)
      continue
    }

    pendingByKey.set(cacheKey, {
      bucket: target.bucket,
      path: normalizedPath,
      cacheKey,
      indices: [index],
    })
  }

  if (pendingByKey.size > 0) {
    const supabase = getServiceClient()
    const pendingBuckets = new Map<string, PendingEntry[]>()

    for (const entry of pendingByKey.values()) {
      const bucketEntries = pendingBuckets.get(entry.bucket)
      if (bucketEntries) {
        bucketEntries.push(entry)
      } else {
        pendingBuckets.set(entry.bucket, [entry])
      }
    }

    await Promise.all(
      [...pendingBuckets.entries()].map(async ([bucket, entries]) => {
        const paths = entries.map((entry) => entry.path)

        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrls(paths, expiresInSeconds)

          if (error || !data) {
            logger.warn("批量签名 URL 失败", { bucket, error: error?.message })
            return
          }

          const signedByPath = new Map<string, string | null>()
          data.forEach((item) => {
            if (!item?.path) return
            signedByPath.set(item.path, typeof item.signedUrl === "string" ? item.signedUrl : null)
          })

          if (cacheTtlMs > 0) {
            pruneSignedUrlCache()
          }

          entries.forEach((entry) => {
            const signed = signedByPath.get(entry.path) ?? null

            if (cacheTtlMs > 0 && signed) {
              signedUrlCache.set(entry.cacheKey, {
                value: signed,
                expiresAt: now + cacheTtlMs,
              })
            }

            entry.indices.forEach((index) => {
              if (signed) {
                resolved[index] = signed
              }
            })
          })
        } catch (error) {
          logger.error(
            "批量签名 URL 异常",
            { bucket, count: paths.length, expiresInSeconds },
            error
          )
        }
      })
    )
  }

  if (awaitingByKey.size > 0) {
    await Promise.all(
      [...awaitingByKey.values()].map(async ({ promise, indices }) => {
        const signed = await promise.catch(() => null)
        indices.forEach((index) => {
          if (signed) {
            resolved[index] = signed
          }
        })
      })
    )
  }

  return resolved
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
  if (items.length === 0) return []

  const signInputs = Array.from(
    new Set(
      items
        .flatMap((item) => [item.author.avatarUrl, ...item.imageUrls])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  )

  const signedInputs = await createSignedUrls(signInputs)

  const signedMap = new Map<string, string>()
  signInputs.forEach((original, index) => {
    signedMap.set(original, signedInputs[index] ?? original)
  })

  return items.map((item) => {
    const signedAvatar = item.author.avatarUrl ? signedMap.get(item.author.avatarUrl) : null
    return {
      ...item,
      imageUrls: item.imageUrls.map((url) => signedMap.get(url) ?? url),
      author: {
        ...item.author,
        avatarUrl: signedAvatar ?? item.author.avatarUrl,
      },
    }
  })
}

export function resetSignedUrlCache() {
  cachedServiceClient = null
  signedUrlCache.clear()
  signedUrlInFlight.clear()
}
