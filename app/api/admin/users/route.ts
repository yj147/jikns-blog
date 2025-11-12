/**
 * 管理员用户管理 API
 * 演示管理员权限保护的实现
 */

import { NextRequest, NextResponse } from "next/server"
import { validateApiPermissions } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"

/**
 * 获取所有用户列表（管理员专用）
 */
export async function GET(request: NextRequest) {
  // 验证管理员权限
  const { success, error, user } = await validateApiPermissions(request, "admin")

  if (!success) {
    return createErrorResponse(
      error?.code ?? ErrorCode.FORBIDDEN,
      error?.message || "无权查看用户列表",
      undefined,
      error?.statusCode ?? 403
    )
  }

  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")))
    const search = searchParams.get("search")
    const status = searchParams.get("status") as "ACTIVE" | "BANNED" | null
    const role = searchParams.get("role") as "USER" | "ADMIN" | null

    // 构建查询条件
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (role) {
      where.role = role
    }

    // 执行查询
    const requestId = crypto.randomUUID()

    const [users, totalCount, totalUsers, activeUsers, bannedUsers, adminUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatarUrl: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              posts: true,
              activities: true,
              comments: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "BANNED" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
    ])

    // 计算分页信息
    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse(
      {
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        summary: {
          totalUsers,
          activeUsers,
          bannedUsers,
          adminUsers,
        },
      },
      { requestId }
    )
  } catch (error) {
    logger.error("获取用户列表失败", { module: "api/admin/users" }, error)
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取用户列表失败")
  }
}

/**
 * 创建新用户（管理员专用）
 */
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const { success, error } = await validateApiPermissions(request, "admin")

  if (!success) {
    return NextResponse.json(error, { status: error.statusCode })
  }

  try {
    const body = await request.json()

    // 输入验证
    const { email, name, role = "USER", status = "ACTIVE" } = body

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        {
          error: "邮箱格式不正确",
          code: "INVALID_EMAIL",
          field: "email",
        },
        { status: 400 }
      )
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        {
          error: "用户名至少需要2个字符",
          code: "INVALID_NAME",
          field: "name",
        },
        { status: 400 }
      )
    }

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json(
        {
          error: "无效的用户角色",
          code: "INVALID_ROLE",
          field: "role",
        },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          error: "该邮箱已被注册",
          code: "EMAIL_EXISTS",
          field: "email",
        },
        { status: 409 }
      )
    }

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        role,
        status,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        data: newUser,
        message: "用户创建成功",
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error("创建用户失败", { module: "api/admin/users" }, error)
    return NextResponse.json(
      {
        error: "创建用户失败",
        code: "CREATE_USER_FAILED",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
