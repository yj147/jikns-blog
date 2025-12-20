import { NextRequest } from "next/server"
import { withApiAuth, createErrorResponse, createSuccessResponse } from "@/lib/api-guards"
import { prisma } from "@/lib/prisma"
import { feedInclude, feedQuerySchema, buildFeedWhere, FEED_ORDER_BY, mapFeedRecord } from "./utils"
import type { AuthenticatedUser } from "@/lib/auth/session"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const MAX_LIMIT = 100

const getHandler = withApiAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  const parsed = feedQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return createErrorResponse(issue?.message || "参数验证失败", "INVALID_QUERY", 400)
  }

  const filters = { ...parsed.data }
  const isAdmin = user.role === "ADMIN"

  // 非管理员只能查看自己的动态，忽略传入的 authorId
  if (!isAdmin) {
    filters.authorId = user.id
    filters.includeDeleted = false
  }

  // 保护 limit，避免过大查询
  filters.limit = Math.min(filters.limit, MAX_LIMIT)

  const where = buildFeedWhere(filters)

  const skip = (filters.page - 1) * filters.limit

  const [feeds, totalCount] = await Promise.all([
    prisma.activity.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: FEED_ORDER_BY,
      include: feedInclude,
    }),
    prisma.activity.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.limit))

  return createSuccessResponse({
    feeds: feeds.map(mapFeedRecord),
    pagination: {
      currentPage: filters.page,
      totalPages,
      totalCount,
      hasNext: filters.page < totalPages,
      hasPrev: filters.page > 1,
    },
  })
}, "auth")

export const GET = withApiResponseMetrics(getHandler)
