/**
 * 用户个人资料 API
 * 演示认证用户权限保护的实现
 */

import { NextRequest, NextResponse } from "next/server"
import { validateApiPermissions } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

/**
 * 获取当前用户资料
 */
export async function GET(request: NextRequest) {
  // 验证用户认证
  const { success, error, user } = await validateApiPermissions(request, "auth")

  if (!success) {
    return NextResponse.json(error, { status: error.statusCode })
  }

  try {
    // 获取完整的用户资料
    const userProfile = await prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        socialLinks: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            posts: true,
            activities: true,
            comments: true,
            likes: true,
            bookmarks: true,
            followers: true,
            following: true,
          },
        },
      },
    })

    if (!userProfile) {
      return NextResponse.json(
        {
          error: "用户资料不存在",
          code: "USER_NOT_FOUND",
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: userProfile,
      message: "用户资料获取成功",
    })
  } catch (error) {
    console.error("获取用户资料失败:", error)
    return NextResponse.json(
      {
        error: "获取用户资料失败",
        code: "FETCH_PROFILE_FAILED",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * 更新当前用户资料
 */
export async function PUT(request: NextRequest) {
  // 验证用户认证
  const { success, error, user } = await validateApiPermissions(request, "auth")

  if (!success) {
    return NextResponse.json(error, { status: error.statusCode })
  }

  try {
    const body = await request.json()

    // 验证和清理输入数据
    const updateData: any = {}

    if (body.name !== undefined) {
      const name = body.name?.trim()
      if (!name || name.length < 2) {
        return NextResponse.json(
          {
            error: "用户名至少需要2个字符",
            code: "INVALID_NAME",
            field: "name",
          },
          { status: 400 }
        )
      }
      if (name.length > 50) {
        return NextResponse.json(
          {
            error: "用户名不能超过50个字符",
            code: "NAME_TOO_LONG",
            field: "name",
          },
          { status: 400 }
        )
      }
      updateData.name = name
    }

    if (body.bio !== undefined) {
      const bio = body.bio?.trim()
      if (bio && bio.length > 500) {
        return NextResponse.json(
          {
            error: "个人简介不能超过500个字符",
            code: "BIO_TOO_LONG",
            field: "bio",
          },
          { status: 400 }
        )
      }
      updateData.bio = bio || null
    }

    if (body.avatarUrl !== undefined) {
      const avatarUrl = body.avatarUrl?.trim()
      if (avatarUrl && !isValidUrl(avatarUrl)) {
        return NextResponse.json(
          {
            error: "头像URL格式不正确",
            code: "INVALID_AVATAR_URL",
            field: "avatarUrl",
          },
          { status: 400 }
        )
      }
      updateData.avatarUrl = avatarUrl || null
    }

    if (body.socialLinks !== undefined) {
      if (body.socialLinks && typeof body.socialLinks !== "object") {
        return NextResponse.json(
          {
            error: "社交链接格式不正确",
            code: "INVALID_SOCIAL_LINKS",
            field: "socialLinks",
          },
          { status: 400 }
        )
      }

      // 验证社交链接URL
      if (body.socialLinks) {
        for (const [platform, url] of Object.entries(body.socialLinks)) {
          if (url && typeof url === "string" && !isValidUrl(url)) {
            return NextResponse.json(
              {
                error: `${platform} 链接格式不正确`,
                code: "INVALID_SOCIAL_URL",
                field: "socialLinks",
              },
              { status: 400 }
            )
          }
        }
      }

      updateData.socialLinks = body.socialLinks
    }

    // 如果没有要更新的数据
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: "没有要更新的数据",
          code: "NO_UPDATE_DATA",
        },
        { status: 400 }
      )
    }

    // 执行更新
    const updatedUser = await prisma.user.update({
      where: { id: user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        socialLinks: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      data: updatedUser,
      message: "用户资料更新成功",
    })
  } catch (error) {
    console.error("更新用户资料失败:", error)
    return NextResponse.json(
      {
        error: "更新用户资料失败",
        code: "UPDATE_PROFILE_FAILED",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// 辅助函数：验证URL格式
function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
