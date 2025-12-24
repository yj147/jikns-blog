"use server"

import { revalidateTag, revalidatePath } from "next/cache"
import { z, ZodError } from "zod"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/permissions"
import { logger } from "@/lib/utils/logger"
import { Prisma } from "@/lib/generated/prisma"
import { parseStorageTarget } from "@/lib/storage/signed-url"
import { auditLogger, AuditEventType } from "@/lib/audit-log"
import { createServiceRoleClient } from "@/lib/supabase"
import { mergeSupabaseUserMetadata } from "@/lib/auth/supabase-metadata"
import {
  notificationPreferencesSchema,
  privacySettingsSchema,
  socialLinksSchema,
} from "@/types/user-settings"

type ActionFailure = {
  success: false
  error: string
  code?: string
  field?: string
}

type ActionSuccess<T> = {
  success: true
  data: T
  message?: string
}

const PHONE_PATTERN = /^[0-9()+\-\.\s]*$/

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
const AVATAR_MAX_SIZE = 5 * 1024 * 1024
const AVATAR_BUCKET = "activity-images"
const AVATAR_PURPOSE = "avatar"
const COVER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const COVER_MAX_SIZE = 8 * 1024 * 1024

const profileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "用户名长度至少 2 个字符")
      .max(50, "用户名长度不能超过 50 个字符"),
    location: z.string().trim().max(200, "所在地长度不能超过 200 个字符").optional(),
    phone: z
      .string()
      .trim()
      .max(40, "手机号长度不能超过 40 个字符")
      .regex(PHONE_PATTERN, "手机号格式不正确")
      .optional(),
    bio: z.string().trim().max(500, "个人简介不能超过 500 个字符").optional(),
  })
  .transform((value) => ({
    name: value.name.trim(),
    location: normalizeNullable(value.location),
    phone: normalizeNullable(value.phone),
    bio: normalizeNullable(value.bio),
  }))

type ProfileInput = z.input<typeof profileSchema>
type ProfileData = z.output<typeof profileSchema>

function normalizeNullable(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function formatZodError(error: unknown): ActionFailure {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    return {
      success: false,
      error: issue?.message || "输入校验失败",
      code: "VALIDATION_ERROR",
      field: issue?.path?.[0]?.toString(),
    }
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : "操作失败",
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function buildApiUrl(path: string): string {
  // 内部 API 调用使用服务器端运行时变量
  // 注意：NEXT_PUBLIC_* 在构建时嵌入，不适合用于运行时端口检测
  const base =
    process.env.INTERNAL_API_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    `http://localhost:${process.env.PORT || "3000"}`

  return new URL(path, base).toString()
}

async function buildCookieHeader(): Promise<Record<string, string>> {
  try {
    const cookieStore = await cookies()
    const cookieEntries: { name: string; value: string }[] =
      typeof cookieStore.getAll === "function" ? [...cookieStore.getAll()] : []

    const csrfCookie =
      typeof cookieStore.get === "function" ? cookieStore.get("csrf-token") : undefined

    if (csrfCookie && !cookieEntries.find((item) => item.name === csrfCookie.name)) {
      cookieEntries.push(csrfCookie)
    }

    const headers: Record<string, string> = {}

    if (cookieEntries.length > 0) {
      headers.Cookie = cookieEntries.map((item) => `${item.name}=${item.value}`).join("; ")
    }

    const csrfToken =
      csrfCookie?.value || cookieEntries.find((item) => item.name === "csrf-token")?.value
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken
    }

    // 设置 Origin 和 Referer 以满足内部 API 的来源校验
    const baseUrl = buildApiUrl("/").replace(/\/$/, "")
    headers.Origin = baseUrl
    headers.Referer = `${baseUrl}/`

    // 标识为 Server Action 内部调用，跳过 CSRF 检查
    headers["X-Internal-Request"] = "server-action"

    return headers
  } catch {
    return {}
  }
}

function validateAvatarInput(file: File | null): ActionFailure | null {
  if (!file) {
    return {
      success: false,
      error: "请选择要上传的头像",
      code: "VALIDATION_ERROR",
      field: "avatar",
    }
  }

  if (!(file instanceof File)) {
    return {
      success: false,
      error: "头像文件无效",
      code: "VALIDATION_ERROR",
      field: "avatar",
    }
  }

  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    return {
      success: false,
      error: "仅支持 JPG/PNG/WebP/GIF 图片",
      code: "VALIDATION_ERROR",
      field: "avatar",
    }
  }

  if (file.size === 0) {
    return {
      success: false,
      error: "头像文件为空",
      code: "VALIDATION_ERROR",
      field: "avatar",
    }
  }

  if (file.size > AVATAR_MAX_SIZE) {
    return {
      success: false,
      error: "头像大小不能超过 5MB",
      code: "VALIDATION_ERROR",
      field: "avatar",
    }
  }

  return null
}

function validateCoverInput(file: File | null): ActionFailure | null {
  if (!file) {
    return {
      success: false,
      error: "请选择要上传的封面图",
      code: "VALIDATION_ERROR",
      field: "coverImage",
    }
  }

  if (!(file instanceof File)) {
    return {
      success: false,
      error: "封面文件无效",
      code: "VALIDATION_ERROR",
      field: "coverImage",
    }
  }

  if (!COVER_ALLOWED_TYPES.includes(file.type as (typeof COVER_ALLOWED_TYPES)[number])) {
    return {
      success: false,
      error: "仅支持 JPG/PNG/WebP 图片",
      code: "VALIDATION_ERROR",
      field: "coverImage",
    }
  }

  if (file.size === 0) {
    return {
      success: false,
      error: "封面文件为空",
      code: "VALIDATION_ERROR",
      field: "coverImage",
    }
  }

  if (file.size > COVER_MAX_SIZE) {
    return {
      success: false,
      error: "封面大小不能超过 8MB",
      code: "VALIDATION_ERROR",
      field: "coverImage",
    }
  }

  return null
}

function extractStoragePath(url?: string | null): string | null {
  if (!url) return null
  const target = parseStorageTarget(url)
  if (!target) return null
  if (target.bucket !== AVATAR_BUCKET) return null
  return target.path
}

async function cleanupUploadedAvatarFile(
  uploadedUrl: string | null | undefined,
  cookieHeader: Record<string, string>
) {
  const storagePath = extractStoragePath(uploadedUrl) || undefined
  if (!storagePath) return

  try {
    await fetch(buildApiUrl(`/api/upload/images?path=${encodeURIComponent(storagePath)}`), {
      method: "DELETE",
      headers: cookieHeader,
    })
  } catch (error) {
    logger.warn("回滚新上传头像失败（已忽略）", {
      module: "app/actions/settings",
      storagePath,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    })
  }
}

async function logAdminProfileAction(
  action: string,
  actorUserId: string,
  targetUserId: string,
  details?: Record<string, unknown>
) {
  if (actorUserId === targetUserId) return

  try {
    await auditLogger.logEvent({
      eventType: AuditEventType.ADMIN_ACTION,
      action,
      resource: `user:${targetUserId}`,
      details: {
        actorUserId,
        targetUserId,
        ...details,
      },
      severity: "MEDIUM",
      success: true,
    })
  } catch (error) {
    logger.warn("审计日志记录失败（忽略，不影响主流程）", {
      module: "app/actions/settings",
      action,
      actorUserId,
      targetUserId,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    })
  }
}

async function enforceOwnership(targetUserId: string) {
  const currentUser = await requireAuth()
  if (currentUser.id !== targetUserId) {
    throw new Error("禁止修改其他用户的数据")
  }
  return currentUser
}

async function enforceOwnershipOrAdmin(targetUserId: string) {
  const currentUser = await requireAuth()
  if (currentUser.id !== targetUserId && currentUser.role !== "ADMIN") {
    throw new Error("禁止修改其他用户的头像")
  }
  return currentUser
}

async function enforceOwnershipOrAdminSettings(targetUserId: string, action: string) {
  const currentUser = await requireAuth()
  if (currentUser.id !== targetUserId && currentUser.role !== "ADMIN") {
    throw new Error(`禁止修改其他用户的${action}`)
  }
  return currentUser
}

async function refreshUserCache(userId: string) {
  revalidateTag("user:self")
  revalidateTag(`user:${userId}`)
  // 刷新个人资料页路由缓存
  revalidatePath("/profile")
  revalidatePath(`/profile/${userId}`)
}

function normalizeSocialLinks(input: unknown): Record<string, string> | null {
  const parsed = socialLinksSchema.parse(input ?? {})
  const sanitizedEntries = Object.entries(parsed).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
  )

  if (sanitizedEntries.length === 0) {
    return null
  }

  return Object.fromEntries(sanitizedEntries)
}

export async function updateAvatar(
  userId: string,
  formData: FormData
): Promise<ActionSuccess<{ id: string; avatarUrl: string | null }> | ActionFailure> {
  let uploadedUrl: string | null = null
  let cookieHeader: Record<string, string> = {}

  try {
    const currentUser = await enforceOwnershipOrAdmin(userId)
    const file = formData.get("avatar") as File | null

    const validationError = validateAvatarInput(file)
    if (validationError) return validationError

    cookieHeader = await buildCookieHeader()
    uploadedUrl = await uploadAvatarFile(currentUser.id, file as File, cookieHeader)

    const result = await persistAvatarUrl({
      targetUserId: userId,
      actorUserId: currentUser.id,
      uploadedUrl,
      cookieHeader,
    })

    if (!result.success) {
      await cleanupUploadedAvatarFile(uploadedUrl, cookieHeader)
      return result
    }

    await logAdminProfileAction("ADMIN_UPDATE_AVATAR", currentUser.id, userId, {
      avatarUrl: uploadedUrl,
    })

    return result
  } catch (error) {
    if (uploadedUrl) {
      await cleanupUploadedAvatarFile(uploadedUrl, cookieHeader)
    }

    logger.error(
      "更新头像失败",
      { module: "app/actions/settings", action: "updateAvatar", userId },
      error
    )
    return formatZodError(error)
  }
}

export async function updateCoverImage(
  userId: string,
  formData: FormData
): Promise<ActionSuccess<{ id: string; coverImage: string | null }> | ActionFailure> {
  let cookieHeader: Record<string, string> = {}
  try {
    const currentUser = await enforceOwnershipOrAdminSettings(userId, "封面图")
    const file = (formData.get("cover") ?? formData.get("coverImage")) as File | null

    const validationError = validateCoverInput(file)
    if (validationError) return validationError

    cookieHeader = await buildCookieHeader()
    const response = await fetch(buildApiUrl("/api/user/cover-image"), {
      method: "POST",
      body: formData,
      headers: cookieHeader,
    })

    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.success) {
      return {
        success: false,
        error: json?.error?.message || "封面上传失败",
        code: json?.error?.code || "UPLOAD_FAILED",
      }
    }

    const coverUrl = json?.data?.signedUrl ?? json?.data?.coverImage ?? null

    await logAdminProfileAction("ADMIN_UPDATE_COVER", currentUser.id, userId, {
      coverImage: coverUrl,
    })
    await refreshUserCache(userId)

    return {
      success: true,
      data: { id: userId, coverImage: coverUrl },
      message: "封面已更新",
    }
  } catch (error) {
    logger.error("更新封面失败", { module: "app/actions/settings", userId }, error)
    return formatZodError(error)
  }
}

export async function deleteCoverImage(
  userId: string
): Promise<ActionSuccess<{ id: string; coverImage: string | null }> | ActionFailure> {
  let cookieHeader: Record<string, string> = {}
  try {
    const currentUser = await enforceOwnershipOrAdminSettings(userId, "封面图")
    cookieHeader = await buildCookieHeader()

    const response = await fetch(buildApiUrl("/api/user/cover-image"), {
      method: "DELETE",
      headers: cookieHeader,
    })
    const json = await response.json().catch(() => null)

    if (!response.ok || !json?.success) {
      return {
        success: false,
        error: json?.error?.message || "删除封面失败",
        code: json?.error?.code || "DELETE_FAILED",
      }
    }

    await logAdminProfileAction("ADMIN_DELETE_COVER", currentUser.id, userId)
    await refreshUserCache(userId)

    return {
      success: true,
      data: { id: userId, coverImage: null },
      message: "封面已移除",
    }
  } catch (error) {
    logger.error("删除封面失败", { module: "app/actions/settings", userId }, error)
    return formatZodError(error)
  }
}

async function uploadAvatarFile(
  userId: string,
  file: File,
  cookieHeader: Record<string, string>
): Promise<string> {
  let uploadJson: any = null

  const uploadForm = new FormData()
  uploadForm.append("files", file as File)

  try {
    const uploadResponse = await fetch(
      buildApiUrl(`/api/upload/images?purpose=${AVATAR_PURPOSE}`),
      {
        method: "POST",
        body: uploadForm,
        headers: cookieHeader,
      }
    )

    uploadJson = await uploadResponse.json()

    if (!uploadResponse.ok || !uploadJson?.success) {
      const message = uploadJson?.error?.message || "头像上传失败"
      throw new Error(message)
    }
  } catch (error) {
    logger.error("调用上传服务失败", { module: "app/actions/settings", userId }, error)
    throw new Error("头像上传失败，请稍后重试")
  }

  const uploadedDetail = uploadJson?.data?.details?.[0]
  const uploadedPath =
    uploadedDetail?.path ||
    extractStoragePath(uploadJson?.data?.urls?.[0]) ||
    extractStoragePath(uploadedDetail?.url)
  const uploadedSignedUrl = uploadedDetail?.signedUrl || uploadJson?.data?.urls?.[0] || null

  if (!uploadedPath && !uploadedSignedUrl) {
    throw new Error("上传返回数据不完整")
  }
  return uploadedPath ?? uploadedSignedUrl
}

async function cleanupOldAvatar(
  oldAvatarUrl: string | null | undefined,
  targetUserId: string,
  actorUserId: string,
  cookieHeader: Record<string, string>
) {
  // 仅在本人更新时尝试删除旧文件，避免管理员越权删除失败
  if (!oldAvatarUrl || actorUserId !== targetUserId) return

  const storagePath = extractStoragePath(oldAvatarUrl)
  if (!storagePath || !storagePath.startsWith(`avatars/${targetUserId}/`)) return

  try {
    await fetch(buildApiUrl(`/api/upload/images?path=${encodeURIComponent(storagePath)}`), {
      method: "DELETE",
      headers: cookieHeader,
    })
  } catch (error) {
    logger.warn("删除旧头像失败（已忽略）", {
      module: "app/actions/settings",
      storagePath,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    })
  }
}

type PersistAvatarArgs = {
  targetUserId: string
  actorUserId: string
  uploadedUrl: string
  cookieHeader: Record<string, string>
}

async function persistAvatarUrl({
  targetUserId,
  actorUserId,
  uploadedUrl,
  cookieHeader,
}: PersistAvatarArgs): Promise<
  ActionSuccess<{ id: string; avatarUrl: string | null }> | ActionFailure
> {
  if (!uploadedUrl?.trim()) {
    return {
      success: false,
      error: "上传返回数据不完整",
      code: "UPLOAD_FAILED",
    }
  }

  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { avatarUrl: true },
  })

  if (!existing) {
    return {
      success: false,
      error: "用户不存在",
      code: "TARGET_NOT_FOUND",
    }
  }

  const supabaseAdmin = createServiceRoleClient()

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { avatarUrl: uploadedUrl },
    select: { id: true, avatarUrl: true },
  })

  try {
    await mergeSupabaseUserMetadata(supabaseAdmin, targetUserId, { avatar_url: uploadedUrl })
  } catch (metadataError) {
    try {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { avatarUrl: existing.avatarUrl },
      })
      await refreshUserCache(targetUserId)
    } catch (rollbackError) {
      logger.error(
        "头像元数据同步失败且数据库回滚失败",
        {
          module: "app/actions/settings",
          action: "updateAvatar",
          userId: targetUserId,
          previousAvatar: existing.avatarUrl,
        },
        rollbackError
      )
    }

    logger.error(
      "头像元数据同步失败",
      { module: "app/actions/settings", action: "updateAvatar", userId: targetUserId },
      metadataError as Error
    )

    return {
      success: false,
      error: "头像元数据同步失败，请稍后重试",
      code: "METADATA_SYNC_FAILED",
    }
  }

  await cleanupOldAvatar(existing.avatarUrl, targetUserId, actorUserId, cookieHeader)
  await refreshUserCache(targetUserId)

  return {
    success: true,
    data: updated,
    message: "头像已更新",
  }
}

export async function saveAvatarUrl(
  userId: string,
  uploadedUrl: string
): Promise<ActionSuccess<{ id: string; avatarUrl: string | null }> | ActionFailure> {
  try {
    const currentUser = await enforceOwnershipOrAdmin(userId)
    const cookieHeader = await buildCookieHeader()

    // 基础格式校验，避免无效 URL 写入数据库
    try {
      new URL(uploadedUrl)
    } catch {
      return {
        success: false,
        error: "头像链接无效",
        code: "VALIDATION_ERROR",
        field: "avatar",
      }
    }

    return await persistAvatarUrl({
      targetUserId: userId,
      actorUserId: currentUser.id,
      uploadedUrl,
      cookieHeader,
    })
  } catch (error) {
    logger.error(
      "保存头像链接失败",
      { module: "app/actions/settings", action: "saveAvatarUrl", userId },
      error
    )
    return formatZodError(error)
  }
}

export async function updateProfile(
  userId: string,
  data: ProfileInput
): Promise<ActionSuccess<ProfileData> | ActionFailure> {
  try {
    await enforceOwnership(userId)

    const payload = profileSchema.parse(data)

    const updateData: Record<string, string | null> = {}
    updateData.name = payload.name
    if (payload.location !== undefined) updateData.location = payload.location
    if (payload.phone !== undefined) updateData.phone = payload.phone
    if (payload.bio !== undefined) updateData.bio = payload.bio

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        error: "没有可更新的字段",
        code: "NO_CHANGES",
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        location: true,
        phone: true,
        bio: true,
      },
    })

    await refreshUserCache(userId)

    const responseData: ProfileData = {
      name: updated.name ?? payload.name,
      location: updated.location ?? null,
      phone: updated.phone ?? null,
      bio: updated.bio ?? null,
    }

    return {
      success: true,
      data: responseData,
      message: "个人资料已更新",
    }
  } catch (error) {
    logger.error(
      "更新个人资料失败",
      { module: "app/actions/settings", action: "updateProfile", userId },
      error
    )
    return formatZodError(error)
  }
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: unknown
): Promise<ActionSuccess<ReturnType<typeof notificationPreferencesSchema.parse>> | ActionFailure> {
  try {
    await enforceOwnership(userId)

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    })

    const merged = notificationPreferencesSchema.parse({
      ...(isRecord(existing?.notificationPreferences) ? existing.notificationPreferences : {}),
      ...(isRecord(preferences) ? preferences : {}),
    })

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: merged },
      select: { notificationPreferences: true },
    })

    await refreshUserCache(userId)

    return {
      success: true,
      data: notificationPreferencesSchema.parse(updated.notificationPreferences),
      message: "通知偏好已更新",
    }
  } catch (error) {
    logger.error(
      "更新通知偏好失败",
      { module: "app/actions/settings", action: "updateNotificationPreferences", userId },
      error
    )
    return formatZodError(error)
  }
}

export async function updatePrivacySettings(
  userId: string,
  settings: unknown
): Promise<ActionSuccess<ReturnType<typeof privacySettingsSchema.parse>> | ActionFailure> {
  try {
    await enforceOwnership(userId)

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { privacySettings: true },
    })

    const merged = privacySettingsSchema.parse({
      ...(isRecord(existing?.privacySettings) ? existing.privacySettings : {}),
      ...(isRecord(settings) ? settings : {}),
    })

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { privacySettings: merged },
      select: { privacySettings: true },
    })

    await refreshUserCache(userId)

    return {
      success: true,
      data: privacySettingsSchema.parse(updated.privacySettings),
      message: "隐私设置已更新",
    }
  } catch (error) {
    logger.error(
      "更新隐私设置失败",
      { module: "app/actions/settings", action: "updatePrivacySettings", userId },
      error
    )
    return formatZodError(error)
  }
}

export async function updateSocialLinks(
  userId: string,
  links: unknown
): Promise<ActionSuccess<ReturnType<typeof socialLinksSchema.parse> | null> | ActionFailure> {
  try {
    const currentUser = await enforceOwnershipOrAdminSettings(userId, "社交链接")

    const normalized = normalizeSocialLinks(links)
    const socialLinksValue = normalized === null ? Prisma.JsonNull : normalized

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { socialLinks: socialLinksValue },
      select: { socialLinks: true },
    })

    await refreshUserCache(userId)
    await logAdminProfileAction("ADMIN_UPDATE_SOCIAL_LINKS", currentUser.id, userId, {
      socialLinks: normalized,
    })

    return {
      success: true,
      data: updated.socialLinks ? socialLinksSchema.parse(updated.socialLinks) : null,
      message: "社交链接已更新",
    }
  } catch (error) {
    logger.error(
      "更新社交链接失败",
      { module: "app/actions/settings", action: "updateSocialLinks", userId },
      error
    )
    return formatZodError(error)
  }
}
