import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/actions/auth"
import { apiLogger } from "@/lib/utils/logger"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { generateRequestId } from "@/lib/auth/session"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

/**
 * 获取用户完整资料（需鉴权）
 *
 * Linus 原则：Never break userspace
 * - 保持向后兼容，但添加鉴权保护
 * - 只有本人或管理员可访问完整资料（包括 email, role 等敏感信息）
 * - 其他用户应使用 /api/users/[userId]/public 获取公开资料
 *
 * @route GET /api/users/[userId]
 * @access Private (本人或管理员)
 *
 * @security
 * - 鉴权：只有本人或管理员可访问
 * - PII 保护：email, role, lastLoginAt, socialLinks 仅授权用户可见
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()

  try {
    const currentUser = await getCurrentUser()
    const { userId } = await params

    // Linus 原则：实用主义
    // 鉴权检查：只有本人或管理员可访问完整资料
    const isOwnProfile = currentUser?.id === userId
    const isAdmin = currentUser?.role === "ADMIN"

    if (!isOwnProfile && !isAdmin) {
      apiLogger.warn("未授权访问用户完整资料", {
        requestId,
        requestedUserId: userId,
        currentUserId: currentUser?.id,
      })

      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        "无权访问该用户的完整资料，请使用公开资料接口",
        undefined,
        403,
        { requestId }
      )
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        socialLinks: true,
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
      return createErrorResponse(ErrorCode.NOT_FOUND, "用户不存在", undefined, 404, { requestId })
    }

    // Linus 原则：统一响应格式
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        socialLinks: user.socialLinks,
        counts: {
          posts: user._count.posts,
          activities: user._count.activities,
          followers: user._count.followers,
          following: user._count.following,
        },
        isOwnProfile,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    })
  } catch (error) {
    apiLogger.error("获取用户信息失败", { requestId }, error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "服务器内部错误", undefined, 500, {
      requestId,
    })
  }
}

export const GET = withApiResponseMetrics(handleGet)
