import type { Prisma } from "@/lib/generated/prisma"
import { startOfDay } from "date-fns"

import { prisma } from "@/lib/prisma"
import type {
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
  AdminUsersPagination,
  AdminUsersPayload,
  AdminUsersQuery,
  AdminUsersSummary,
  RoleFilter,
  StatusFilter,
} from "@/types/admin-users"

export type {
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
  AdminUsersPagination,
  AdminUsersPayload,
  AdminUsersQuery,
  AdminUsersSummary,
  RoleFilter,
  StatusFilter,
} from "@/types/admin-users"

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export const ADMIN_USERS_DEFAULT_PAGE = DEFAULT_PAGE
export const ADMIN_USERS_DEFAULT_LIMIT = DEFAULT_LIMIT

export async function getAdminUsersPayload(
  query: AdminUsersQuery = {}
): Promise<AdminUsersPayload> {
  const page = Math.max(1, query.page ?? DEFAULT_PAGE)
  const limit = clampLimit(query.limit ?? DEFAULT_LIMIT)
  const skip = (page - 1) * limit
  const where = buildWhere(query)

  const [users, total, summary] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            activities: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    getAdminUsersSummary(),
  ])

  const data = users.map<AdminUserListItem>((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AdminUserRole,
    status: user.status as AdminUserStatus,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    metrics: {
      posts: user._count.posts,
      comments: user._count.comments,
      activities: user._count.activities,
    },
  }))

  const pagination: AdminUsersPagination = {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasMore: skip + data.length < total,
  }

  return { users: data, pagination, summary }
}

export async function getAdminUsersSummary(): Promise<AdminUsersSummary> {
  const now = new Date()
  const todayStart = startOfDay(now)

  const [totalUsers, activeUsers, adminUsers, todayNewUsers, bannedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { status: "BANNED" } }),
  ])

  return {
    totalUsers,
    activeUsers,
    adminUsers,
    todayNewUsers,
    bannedUsers,
  }
}

function clampLimit(limit: number): number {
  return Math.min(MAX_LIMIT, Math.max(1, limit))
}

function buildWhere(query: AdminUsersQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}

  const normalizedSearch = query.search?.trim()

  if (normalizedSearch) {
    where.OR = [
      { name: { contains: normalizedSearch, mode: "insensitive" } },
      { email: { contains: normalizedSearch, mode: "insensitive" } },
    ]
  }

  if (query.status === "ACTIVE" || query.status === "BANNED") {
    where.status = query.status
  } else if (query.status === "INACTIVE") {
    where.status = { not: "ACTIVE" }
  }

  if (query.role === "USER" || query.role === "ADMIN") {
    where.role = query.role
  }

  return where
}
