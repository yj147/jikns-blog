/**
 * 用户信息 API 路由
 * 提供当前登录用户的完整信息
 */

import { createRouteHandlerClient } from "@/lib/supabase"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { authLogger } from "@/lib/utils/logger"
import { syncUserFromAuth, isConfiguredAdminEmail } from "@/lib/auth"
import { notificationPreferencesSchema, privacySettingsSchema } from "@/types/user-settings"
import { signAvatarUrl, signCoverImageUrl } from "@/lib/storage/signed-url"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handleGet() {
  try {
    const supabase = await createRouteHandlerClient()

    // 获取经过验证的用户信息
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !authUser) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "未授权访问" } },
        { status: 401 }
      )
    }

    // 优先同步 Supabase 数据到数据库，保证 name/avatar 最新
    try {
      await syncUserFromAuth(authUser)
    } catch (syncError) {
      authLogger.error("同步用户资料失败", { userId: authUser.id }, syncError)
    }

    // 尝试从数据库获取用户信息
    let user = null
    let dbError = null

    try {
      user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
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
        },
      })

      if (!user) {
        authLogger.warn("数据库未找到用户，使用认证信息回退", { userId: authUser.id })
      }
    } catch (dbErrorCaught) {
      authLogger.error("获取用户信息时数据库操作失败", { userId: authUser.id }, dbErrorCaught)
      dbError = dbErrorCaught
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

    const avatarSignedUrl = await signAvatarUrl(user.avatarUrl || fallbackAvatar)
    if (avatarSignedUrl) {
      user.avatarUrl = avatarSignedUrl
      ;(user as any).avatarSignedUrl = avatarSignedUrl
    }

    const coverSignedUrl = await signCoverImageUrl(user.coverImage)
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

    return NextResponse.json({ user: userResponse })
  } catch (error) {
    authLogger.error("获取用户信息失败", {}, error)
    return NextResponse.json(
      { error: { code: "UNKNOWN_ERROR", message: "服务器错误" } },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
