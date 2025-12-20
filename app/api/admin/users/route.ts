import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, generateRequestId } from "@/lib/auth/session"
import { apiLogger, logger } from "@/lib/utils/logger"
import { AuthError } from "@/lib/error-handling/auth-error"
import { validateApiPermissions } from "@/lib/permissions"
import {
  ADMIN_USERS_DEFAULT_LIMIT,
  ADMIN_USERS_DEFAULT_PAGE,
  getAdminUsersPayload,
  type RoleFilter,
  type StatusFilter,
} from "@/lib/services/admin-users"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeStatus(value: string | null): StatusFilter {
  const normalized = value?.trim().toUpperCase()
  if (normalized === "ACTIVE" || normalized === "BANNED" || normalized === "INACTIVE") {
    return normalized as StatusFilter
  }
  return "all"
}

function normalizeRole(value: string | null): RoleFilter {
  const normalized = value?.trim().toUpperCase()
  if (normalized === "USER" || normalized === "ADMIN") {
    return normalized as RoleFilter
  }
  return "all"
}

async function handleGet(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()

  try {
    await requireAdmin(request)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "需要管理员权限"

    apiLogger.warn("admin users list forbidden", {
      requestId,
      path: request.nextUrl.pathname,
      message,
      errorCode: error instanceof AuthError ? error.code : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "需要管理员权限",
          requestId,
        },
      },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const requestedPage = parsePositiveInt(searchParams.get("page"), ADMIN_USERS_DEFAULT_PAGE)
  const requestedLimit = parsePositiveInt(searchParams.get("limit"), ADMIN_USERS_DEFAULT_LIMIT)
  const statusFilter = normalizeStatus(searchParams.get("status"))
  const roleFilter = normalizeRole(searchParams.get("role"))
  const rawSearch = searchParams.get("search")?.trim()
  const search = rawSearch && rawSearch.length > 0 ? rawSearch : null

  try {
    const payload = await getAdminUsersPayload({
      page: requestedPage,
      limit: requestedLimit,
      status: statusFilter,
      role: roleFilter,
      search,
    })
    const { pagination, users } = payload

    apiLogger.info("admin users list fetched", {
      requestId,
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter,
      role: roleFilter,
      search,
      total: pagination.total,
      returned: users.length,
    })

    return NextResponse.json({
      success: true,
      data: payload,
    })
  } catch (error) {
    apiLogger.error(
      "admin users list fetch failed",
      {
        requestId,
        page: requestedPage,
        limit: requestedLimit,
        status: statusFilter,
        role: roleFilter,
        search,
      },
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "获取用户列表失败",
          requestId,
        },
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)

/**
 * 创建新用户（管理员专用）
 */
async function handlePost(request: NextRequest) {
  const { success, error } = await validateApiPermissions(request, "admin")

  if (!success) {
    return NextResponse.json(error, { status: error.statusCode })
  }

  try {
    const body = await request.json()
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
