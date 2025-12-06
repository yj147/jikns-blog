import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { generateRequestId, getOptionalViewer } from "@/lib/auth/session"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { signAvatarUrl } from "@/lib/storage/signed-url"
import { privacySettingsSchema } from "@/types/user-settings"

/**
 * 获取用户公开资料
 * 
 * Linus 原则：数据结构驱动设计
 * - 只返回公开信息（id, name, avatarUrl, bio, status）
 * - 绝不暴露 PII（email, role, lastLoginAt, socialLinks）
 * - 按 privacySettings.profileVisibility 进行访问控制
 * 
 * @route GET /api/users/[userId]/public
 * @access Public
 * 
 * @returns {Object} 公开用户资料
 * @returns {string} id - 用户 ID
 * @returns {string} name - 用户名
 * @returns {string|null} avatarUrl - 头像 URL
 * @returns {string|null} bio - 个人简介
 * @returns {string} status - 用户状态（ACTIVE/BANNED）
 * @returns {Object} counts - 统计信息
 * @returns {number} counts.posts - 文章数
 * @returns {number} counts.activities - 动态数
 * @returns {number} counts.followers - 粉丝数
 * @returns {number} counts.following - 关注数
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()

  try {
    const [{ userId }, viewer] = await Promise.all([params, getOptionalViewer({ request })])

    // Linus 原则：好品味
    // 使用与 lib/interactions/follow.ts 相同的 PUBLIC_USER_SELECT
    // 确保所有公开接口的数据结构一致
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        status: true,
        privacySettings: true,
        _count: {
          select: {
            posts: true,
            activities: true,
            followers: true,
            following: true,
          },
        },
      },
    })

    if (!user) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        "用户不存在",
        undefined,
        404,
        { requestId }
      )
    }

    const parsedPrivacy = privacySettingsSchema.safeParse(user.privacySettings ?? {})
    const privacySettings = parsedPrivacy.success
      ? parsedPrivacy.data
      : privacySettingsSchema.parse({})

    if (!parsedPrivacy.success) {
      apiLogger.warn("解析隐私设置失败", { requestId, userId, error: parsedPrivacy.error })
    }

    const isOwner = viewer?.id === user.id
    const isAdmin = viewer?.role === "ADMIN"

    if (!isOwner && !isAdmin) {
      if (privacySettings.profileVisibility === "private") {
        return createErrorResponse(
          ErrorCode.NOT_FOUND,
          "用户不存在",
          undefined,
          404,
          { requestId }
        )
      }

      if (privacySettings.profileVisibility === "followers") {
        if (!viewer) {
          return createErrorResponse(
            ErrorCode.NOT_FOUND,
            "用户不存在",
            undefined,
            404,
            { requestId }
          )
        }

        const viewerFollowsTarget = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewer.id,
              followingId: user.id,
            },
          },
          select: {
            followerId: true,
          },
        })

        if (!viewerFollowsTarget) {
          return createErrorResponse(
            ErrorCode.NOT_FOUND,
            "用户不存在",
            undefined,
            404,
            { requestId }
          )
        }
      }
    }

    // Linus 原则：消除特殊情况
    // 统一响应格式，与其他公开 API 保持一致
    // 签名头像 URL（activity-images bucket 是私有的）
    const signedAvatarUrl = await signAvatarUrl(user.avatarUrl)

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        avatarUrl: signedAvatarUrl,
        bio: user.bio,
        status: user.status,
        counts: {
          posts: user._count.posts,
          activities: user._count.activities,
          followers: user._count.followers,
          following: user._count.following,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    })
  } catch (error) {
    apiLogger.error("获取用户公开资料失败", { requestId }, error)
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "服务器内部错误",
      undefined,
      500,
      { requestId }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
