/**
 * 推荐用户 API
 * 为动态页面提供用户推荐功能
 */

import { NextRequest } from "next/server"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
import { assertPolicy, generateRequestId } from "@/lib/auth/session"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { getCached, setCached } from "@/lib/cache/simple-cache"
import { createSignedUrls } from "@/lib/storage/signed-url"

const SUGGESTED_CACHE_TTL = 60000
type SuggestedResponse = {
  data: {
    id: string
    name: string | null
    username: string
    avatarUrl: string | null
    bio: string
    role: string
    followers: number
    postsCount: number
    activitiesCount: number
    isVerified: boolean
  }[]
  meta: { total: number; limit: number; algorithm: string }
  message: string
}

/**
 * 获取推荐用户列表
 */
async function handleGet(request: NextRequest) {
  const requestId = generateRequestId()
  const ip = getClientIP(request) ?? undefined
  const ua = getClientUserAgent(request) ?? undefined

  try {
    const [user, authError] = await assertPolicy("user-active", {
      path: request.nextUrl.pathname,
      requestId,
      ip,
      ua,
    })

    if (authError) {
      const errorCode =
        authError.code === "UNAUTHORIZED"
          ? ErrorCode.UNAUTHORIZED
          : authError.code === "ACCOUNT_BANNED" || authError.code === "FORBIDDEN"
            ? ErrorCode.FORBIDDEN
            : ErrorCode.UNKNOWN_ERROR

      await auditLogger.logEvent({
        action: "USER_SUGGESTIONS",
        resource: request.nextUrl.pathname,
        success: false,
        severity: "MEDIUM",
        userId: authError.context?.userId,
        ipAddress: ip,
        userAgent: ua,
        errorMessage: authError.message,
        details: { requestId, stage: "auth" },
      })

      return createErrorResponse(errorCode, authError.message, undefined, authError.statusCode)
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") || "5")))

    const cacheKey = `suggested:${user.id}`
    const cached = getCached<SuggestedResponse>(cacheKey)

    if (cached) {
      return createSuccessResponse(cached)
    }

    // 推荐算法：
    // 1. 优先推荐活跃用户（有发布动态或博客的用户）
    // 2. 按近期活跃排序（避免 _count 排序的重查询成本）
    // 3. 排除已关注的用户和自己
    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    })
    const excludedUserIds = [user.id, ...following.map((row) => row.followingId)]
    const suggestedUsers = await prisma.user.findMany({
      where: {
        id: { notIn: excludedUserIds },
        status: "ACTIVE",
        OR: [
          { posts: { some: { published: true } } }, // 有发布的博客
          { activities: { some: {} } }, // 有发布的动态
        ],
      },
      select: {
        id: true,
        name: true,
        email: false, // 不返回邮箱保护隐私
        avatarUrl: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            followers: true, // 粉丝数
            posts: { where: { published: true } }, // 已发布的博客数
            activities: true, // 动态数
          },
        },
      },
      orderBy: [
        { lastLoginAt: "desc" }, // 近期活跃优先
        { createdAt: "desc" }, // 按注册时间排序
      ],
      take: limit,
    })

    const avatarInputs = Array.from(
      new Set(
        suggestedUsers
          .map((suggestedUser) => suggestedUser.avatarUrl)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    const signedAvatars = await createSignedUrls(avatarInputs)
    const avatarMap = new Map<string, string>()
    avatarInputs.forEach((original, index) => {
      avatarMap.set(original, signedAvatars[index] ?? original)
    })

    // 转换数据格式，添加用户名，并批量签名头像 URL
    const formattedUsers = suggestedUsers.map((suggestedUser) => ({
      id: suggestedUser.id,
      name: suggestedUser.name,
      username: `@${suggestedUser.name?.toLowerCase().replace(/\s+/g, "_") || "user"}`,
      avatarUrl: suggestedUser.avatarUrl
        ? (avatarMap.get(suggestedUser.avatarUrl) ?? suggestedUser.avatarUrl)
        : null,
      bio:
        suggestedUser.bio ||
        `${suggestedUser.role === "ADMIN" ? "博客作者" : "用户"}，加入于 ${suggestedUser.createdAt.getFullYear()} 年`,
      role: suggestedUser.role,
      followers: suggestedUser._count.followers,
      postsCount: suggestedUser._count.posts,
      activitiesCount: suggestedUser._count.activities,
      isVerified: suggestedUser.role === "ADMIN", // 管理员显示为验证用户
    }))

    const responsePayload = {
      data: formattedUsers,
      meta: {
        total: formattedUsers.length,
        limit,
        algorithm: "activity_and_popularity",
      },
      message: "推荐用户获取成功",
    }

    setCached(cacheKey, responsePayload, SUGGESTED_CACHE_TTL)

    auditLogger.logEventAsync({
      action: "USER_SUGGESTIONS",
      resource: `user:${user.id}`,
      details: {
        limit,
        resultCount: formattedUsers.length,
        requestId,
      },
      success: true,
      severity: "LOW",
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
    })

    return createSuccessResponse(responsePayload)
  } catch (error) {
    logger.error("获取推荐用户失败", {
      error,
      requestId,
    })

    await auditLogger.logEvent({
      action: "USER_SUGGESTIONS",
      resource: request.nextUrl.pathname,
      success: false,
      severity: "MEDIUM",
      userAgent: ua,
      ipAddress: ip,
      errorMessage: error instanceof Error ? error.message : String(error),
      details: { requestId },
    })

    return handleApiError(error)
  }
}

export const GET = withApiResponseMetrics(handleGet)
