/**
 * 用户信息 API 路由
 * 提供当前登录用户的完整信息
 */

import { createRouteHandlerClient } from "@/lib/supabase"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { authLogger } from "@/lib/utils/logger"

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient()

    // 获取经过验证的用户信息
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !authUser) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 })
    }

    // 尝试从数据库获取用户信息
    let user = null
    let dbError = null

    try {
      // 从数据库获取用户的完整信息
      user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          bio: true,
          socialLinks: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      })

      // 如果用户不存在，自动创建用户记录（适用于首次OAuth登录）
      if (!user) {
        authLogger.info("用户不存在，自动创建用户记录", {
          userId: authUser.id,
          email: authUser.email,
        })
        authLogger.debug("用户元数据", {
          userId: authUser.id,
          metadata: authUser.user_metadata,
        })
        user = await prisma.user.create({
          data: {
            id: authUser.id,
            email: authUser.email || "",
            name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null,
            avatarUrl: authUser.user_metadata?.avatar_url || null,
            role: "USER",
            status: "ACTIVE",
            lastLoginAt: new Date(),
          },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            bio: true,
            socialLinks: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
        })
        authLogger.info("用户创建成功", { userId: user.id })
      }
    } catch (dbErrorCaught) {
      authLogger.error("获取用户信息时数据库操作失败", { userId: authUser.id }, dbErrorCaught)
      dbError = dbErrorCaught

      // 如果数据库连接失败，使用 Supabase 认证信息作为回退
      user = {
        id: authUser.id,
        email: authUser.email || "",
        name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || null,
        avatarUrl: authUser.user_metadata?.avatar_url || null,
        bio: null,
        socialLinks: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
      authLogger.warn("使用认证信息作为回退用户数据", { userId: authUser.id })
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
    return NextResponse.json({ error: "服务器错误" }, { status: 500 })
  }
}
