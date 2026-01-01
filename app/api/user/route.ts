/**
 * 用户信息 API 路由
 * 提供当前登录用户的完整信息
 */

import { createRouteHandlerClient } from "@/lib/supabase"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { authLogger } from "@/lib/utils/logger"
import { syncUserFromAuth, isConfiguredAdminEmail } from "@/lib/auth"
import { notificationPreferencesSchema, privacySettingsSchema } from "@/types/user-settings"
import { createSignedUrls } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const isDevEnv = process.env.NODE_ENV === "development"
const isTestEnv = process.env.NODE_ENV === "test"

function hasSupabaseSessionCookie(request: Request): boolean {
  const cookieJar = (request as any)?.cookies
  if (cookieJar && typeof cookieJar.getAll === "function") {
    return cookieJar.getAll().some((cookie: { name?: string; value?: string }) => {
      const name = cookie?.name ?? ""
      if (!name.startsWith("sb-")) return false
      if (!name.includes("-auth-token") && !name.includes("-refresh-token")) return false
      return typeof cookie?.value === "string" && cookie.value.length > 0
    })
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  if (!cookieHeader) return false

  return cookieHeader.split(";").some((pair) => {
    const [rawName, rawValue] = pair.trim().split("=")
    const name = rawName?.trim() ?? ""
    const value = rawValue?.trim() ?? ""
    if (!name.startsWith("sb-")) return false
    if (!name.includes("-auth-token") && !name.includes("-refresh-token")) return false
    return value.length > 0
  })
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  coverImage: true,
  bio: true,
  socialLinks: true,
  location: true,
  phone: true,
  notificationPreferences: true,
  privacySettings: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
} as const

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

async function fetchUserFromDatabase(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  })
}

async function fetchCachedUserFromDatabase(userId: string) {
  if (isDevEnv || isTestEnv) {
    return fetchUserFromDatabase(userId)
  }

  const cachedFn = unstable_cache(() => fetchUserFromDatabase(userId), [`api-user-${userId}`], {
    tags: ["user:self", `user:${userId}`],
    revalidate: 60,
  })

  return cachedFn()
}

async function handleGet(request: Request) {
  if (!hasSupabaseSessionCookie(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权访问" } },
      { status: 401 }
    )
  }

  const totalStart = performance.now()
  const authStart = performance.now()
  try {
    const supabase = await createRouteHandlerClient()

    // 获取经过验证的用户信息
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser()
    const authMs = performance.now() - authStart

    if (userError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "未授权访问" } },
        { status: 401 }
      )
    }

    // 尝试从数据库获取用户信息
    let user = null
    let dbError = null
    const dbStart = performance.now()

    try {
      user = await fetchCachedUserFromDatabase(authUser.id)

      if (!user) {
        authLogger.warn("数据库未找到用户，使用认证信息回退", { userId: authUser.id })
      }
    } catch (dbErrorCaught) {
      authLogger.error("获取用户信息时数据库操作失败", { userId: authUser.id }, dbErrorCaught)
      dbError = dbErrorCaught
    }
    const dbMs = performance.now() - dbStart

    if (!user && !dbError) {
      try {
        await syncUserFromAuth(authUser)
      } catch (syncError) {
        authLogger.error("同步用户资料失败", { userId: authUser.id }, syncError)
      }

      try {
        user = await fetchUserFromDatabase(authUser.id)
      } catch (dbErrorCaught) {
        authLogger.error("同步用户后读取数据库失败", { userId: authUser.id }, dbErrorCaught)
        dbError = dbErrorCaught
      }
    }

    const metadata = authUser.user_metadata || {}
    const fallbackName =
      metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      authUser.email?.split("@")[0] ||
      null
    const fallbackAvatar = metadata.avatar_url || metadata.picture || null

    const normalizedNotificationPreferences = notificationPreferencesSchema.parse(
      user?.notificationPreferences ?? {}
    )
    const normalizedPrivacySettings = privacySettingsSchema.parse(user?.privacySettings ?? {})

    if (!user) {
      user = {
        id: authUser.id,
        email: authUser.email || "",
        name: fallbackName,
        avatarUrl: fallbackAvatar,
        coverImage: null,
        bio: null,
        socialLinks: null,
        location: null,
        phone: null,
        notificationPreferences: normalizedNotificationPreferences,
        privacySettings: normalizedPrivacySettings,
        role: isConfiguredAdminEmail(authUser.email) ? "ADMIN" : "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
    } else {
      user = {
        ...user,
        name: user.name || fallbackName,
        // avatarUrl 完全使用数据库值，syncUserFromAuth 已处理首次登录时的初始化
        avatarUrl: user.avatarUrl,
        coverImage: user.coverImage ?? null,
        notificationPreferences: normalizedNotificationPreferences,
        privacySettings: normalizedPrivacySettings,
      }
    }

    const signStart = performance.now()
    const avatarInput = user.avatarUrl || fallbackAvatar
    const coverInput = user.coverImage
    const signInputs = Array.from(
      new Set([avatarInput, coverInput].filter((value) => isNonEmptyString(value)))
    )

    const signedInputs = signInputs.length > 0 ? await createSignedUrls(signInputs) : []
    const signedMap = new Map<string, string>()
    signInputs.forEach((value, index) => {
      signedMap.set(value, signedInputs[index] ?? value)
    })

    const avatarSignedUrl = isNonEmptyString(avatarInput)
      ? (signedMap.get(avatarInput) ?? avatarInput)
      : null
    const coverSignedUrl = isNonEmptyString(coverInput)
      ? (signedMap.get(coverInput) ?? coverInput)
      : null
    const signMs = performance.now() - signStart

    if (avatarSignedUrl) {
      user.avatarUrl = avatarSignedUrl
      ;(user as any).avatarSignedUrl = avatarSignedUrl
    }

    if (coverSignedUrl) {
      user.coverImage = coverSignedUrl
      ;(user as any).coverImageSignedUrl = coverSignedUrl
    }

    // 组合认证信息和业务信息
    const userResponse = {
      ...user,
      // 从认证系统获取的最新信息
      authUser: {
        id: authUser.id,
        email: authUser.email,
        metadata: authUser.user_metadata,
      },
      // 添加数据库状态信息（仅用于调试）
      ...(dbError && process.env.NODE_ENV === "development"
        ? {
            _debug: {
              dbError: "数据库连接失败，使用认证数据作为回退",
              usingFallback: true,
            },
          }
        : {}),
    }

    const response = NextResponse.json({ user: userResponse })
    const totalMs = performance.now() - totalStart

    response.headers.set(
      "Server-Timing",
      `auth;dur=${authMs.toFixed(1)}, db;dur=${dbMs.toFixed(1)}, sign;dur=${signMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`
    )
    response.headers.set("x-perf-auth-ms", authMs.toFixed(1))
    response.headers.set("x-perf-db-ms", dbMs.toFixed(1))
    response.headers.set("x-perf-sign-ms", signMs.toFixed(1))
    response.headers.set("x-perf-total-ms", totalMs.toFixed(1))
    return response
  } catch (error) {
    authLogger.error("获取用户信息失败", {}, error)
    return NextResponse.json(
      { error: { code: "UNKNOWN_ERROR", message: "服务器错误" } },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
