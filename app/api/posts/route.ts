/**
 * 公开文章查询 API
 * 提供文章列表查询、搜索、筛选等公开功能
 */

import { NextRequest } from "next/server"
import { Prisma } from "@/lib/generated/prisma"
import {
  createSuccessResponse,
  createErrorResponse,
  ErrorCode,
  PaginationMeta,
} from "@/lib/api/unified-response"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/utils/logger"
import { featureFlags } from "@/lib/config/feature-flags"
import { recordPostsPublicEmailAudit } from "@/lib/observability/posts-public-email-audit"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

/**
 * 获取公开文章列表
 */
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100
const ALLOWED_ORDER_FIELDS = ["publishedAt", "createdAt", "viewCount"] as const
const ALLOWED_ORDER_DIRECTIONS = ["asc", "desc"] as const

type AllowedOrderField = (typeof ALLOWED_ORDER_FIELDS)[number]
type AllowedOrderDirection = (typeof ALLOWED_ORDER_DIRECTIONS)[number]

interface ParamViolation {
  param: string
  value: string | null
  reason: string
}

async function handleGet(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get("page")
    const parsedPage = Number.parseInt(rawPage ?? "", 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const monitorOnly = featureFlags.postsPublicParamMonitor()
    const enforcementEnabled = featureFlags.postsPublicParamEnforce()

    const paramViolations: ParamViolation[] = []

    const rawLimit = searchParams.get("limit")
    let limit = DEFAULT_LIMIT
    if (rawLimit !== null) {
      const numericLimit = Number(rawLimit)
      if (!Number.isFinite(numericLimit)) {
        paramViolations.push({
          param: "limit",
          value: rawLimit,
          reason: "必须为数字",
        })
      } else {
        if (numericLimit < 1) {
          paramViolations.push({
            param: "limit",
            value: rawLimit,
            reason: "必须大于等于 1",
          })
          limit = DEFAULT_LIMIT
        } else if (numericLimit > MAX_LIMIT) {
          paramViolations.push({
            param: "limit",
            value: rawLimit,
            reason: `超出最大值 ${MAX_LIMIT}`,
          })
          limit = MAX_LIMIT
        } else {
          limit = Math.trunc(numericLimit)
        }
      }
    }

    const rawOrderBy = searchParams.get("orderBy")
    let orderByField: AllowedOrderField = "publishedAt"
    if (rawOrderBy) {
      if ((ALLOWED_ORDER_FIELDS as readonly string[]).includes(rawOrderBy)) {
        orderByField = rawOrderBy as AllowedOrderField
      } else {
        paramViolations.push({
          param: "orderBy",
          value: rawOrderBy,
          reason: `仅允许 ${ALLOWED_ORDER_FIELDS.join(", ")}`,
        })
      }
    }

    const rawOrder = searchParams.get("order")?.toLowerCase()
    let orderDirection: AllowedOrderDirection = "desc"
    if (rawOrder) {
      if ((ALLOWED_ORDER_DIRECTIONS as readonly string[]).includes(rawOrder)) {
        orderDirection = rawOrder as AllowedOrderDirection
      } else {
        paramViolations.push({
          param: "order",
          value: rawOrder,
          reason: "仅允许 asc/desc",
        })
      }
    }

    const search = searchParams.get("search") || ""
    const tagParam = searchParams.get("tag")
    const tag = tagParam ? tagParam.trim() : undefined
    const seriesId = searchParams.get("seriesId") || undefined

    const traceHeader =
      request.headers.get("x-request-id") || request.headers.get("x-vercel-id") || undefined
    const requestId = traceHeader ?? crypto.randomUUID()
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-client-ip") ||
      undefined
    const userAgent = request.headers.get("user-agent") || undefined
    const referer = request.headers.get("referer") || undefined

    const auditEnabled = featureFlags.postsPublicEmailAudit()
    const hideAuthorEmail = featureFlags.postsPublicHideAuthorEmail()

    if (paramViolations.length > 0 && (monitorOnly || enforcementEnabled)) {
      apiLogger.warn("posts_public_param_violation", {
        requestId,
        ipAddress,
        userAgent,
        referer,
        violations: paramViolations,
      })
    }

    if (paramViolations.length > 0 && enforcementEnabled) {
      return createErrorResponse(
        ErrorCode.INVALID_PARAMETERS,
        "请求参数不符合要求",
        {
          requestId,
          violations: paramViolations,
        },
        400
      )
    }

    const authorSelect: Prisma.UserSelect = hideAuthorEmail
      ? { id: true, name: true, avatarUrl: true }
      : { id: true, name: true, email: true, avatarUrl: true }

    // 构建查询条件
    const where: Prisma.PostWhereInput = {
      published: true, // 只返回已发布的文章
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ]
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            OR: [
              { slug: { equals: tag, mode: "insensitive" } },
              { name: { equals: tag, mode: "insensitive" } },
            ],
          },
        },
      }
    }

    if (seriesId) {
      where.seriesId = seriesId
    }

    // 分页查询
    const skip = (page - 1) * limit

    const orderByClauses: Prisma.PostOrderByWithRelationInput[] = [
      { [orderByField]: orderDirection } as Prisma.PostOrderByWithRelationInput,
    ]
    if (orderByField !== "publishedAt") {
      orderByClauses.push({ publishedAt: "desc" })
    }
    orderByClauses.push({ id: "desc" })

    const postSelect = {
      id: true,
      title: true,
      excerpt: true,
      slug: true,
      publishedAt: true,
      author: {
        select: authorSelect,
      },
      series: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
          bookmarks: true,
        },
      },
    } satisfies Prisma.PostSelect

    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByClauses,
        select: postSelect,
      }),
      prisma.post.count({ where }),
    ])

    if (auditEnabled && !hideAuthorEmail && posts.length > 0) {
      const auditPayload = {
        requestId: requestId,
        ipAddress,
        userAgent,
        referer,
        params: {
          page,
          limit,
          search,
          tag,
          seriesId,
          orderBy: orderByField,
          order: orderDirection,
        },
        returnedPosts: posts.length,
        containsAuthorEmail: posts.some((post) => Boolean(post.author?.email)),
      }
      apiLogger.info("posts_public_api_email_audit", auditPayload)
      void recordPostsPublicEmailAudit({
        requestId,
        ipAddress,
        userAgent,
        referer,
        params: auditPayload.params,
        returnedPosts: auditPayload.returnedPosts,
        containsAuthorEmail: auditPayload.containsAuthorEmail,
      })
    }

    const totalPages = Math.ceil(totalCount / limit)

    // 构造分页元数据
    const pagination: PaginationMeta = {
      page,
      limit,
      total: totalCount,
      hasMore: page < totalPages,
      nextCursor: page < totalPages ? String(page + 1) : null,
    }

    return createSuccessResponse(
      {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      { pagination, requestId }
    )
  } catch (error) {
    apiLogger.error("获取文章列表失败", {
      error,
      operation: "GET_POSTS",
      requestId:
        request.headers.get("x-request-id") || request.headers.get("x-vercel-id") || undefined,
    })
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "获取文章列表失败", {
      operation: "GET_POSTS",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export const GET = withApiResponseMetrics(handleGet)

// 处理 CORS 预检请求
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}
