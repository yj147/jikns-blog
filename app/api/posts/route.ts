/**
 * 公开文章查询 API
 * 提供文章列表查询、搜索、筛选等公开功能
 */

import { NextRequest } from "next/server"
import { unstable_cache } from "next/cache"
import { getClientIp } from "@/lib/api/get-client-ip"
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
import { createSignedUrls } from "@/lib/storage/signed-url"

/**
 * 获取公开文章列表
 */
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100
const POST_IMAGE_SIGN_EXPIRES_IN = 60 * 60 // 1 hour
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
  const totalStart = performance.now()
  try {
    const { searchParams } = request.nextUrl
    const rawPage = searchParams.get("page")
    const parsedPage = Number.parseInt(rawPage ?? "", 10)

    const rawCursor = searchParams.get("cursor")
    const parsedCursor = rawCursor !== null ? Number.parseInt(rawCursor, 10) : NaN
    const monitorOnly = featureFlags.postsPublicParamMonitor()
    const enforcementEnabled = featureFlags.postsPublicParamEnforce()

    const paramViolations: ParamViolation[] = []

    const cursorPage =
      rawCursor !== null && Number.isFinite(parsedCursor) && parsedCursor > 0 ? parsedCursor : null

    if (rawCursor !== null && cursorPage === null) {
      paramViolations.push({
        param: "cursor",
        value: rawCursor,
        reason: "必须为大于 0 的数字",
      })
    }

    const page = cursorPage ?? (Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1)

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

    const MAX_SEARCH_LENGTH = 200
    const rawSearch = searchParams.get("search") || ""
    let search = rawSearch
    if (rawSearch.length > MAX_SEARCH_LENGTH) {
      paramViolations.push({
        param: "search",
        value: `${rawSearch.slice(0, 50)}...`,
        reason: `搜索词超出最大长度 ${MAX_SEARCH_LENGTH}`,
      })
      search = rawSearch.slice(0, MAX_SEARCH_LENGTH)
    }
    const tagParam = searchParams.get("tag")
    const tag = tagParam ? tagParam.trim() : undefined
    const seriesId = searchParams.get("seriesId") || undefined

    const traceHeader =
      request.headers.get("x-request-id") || request.headers.get("x-vercel-id") || undefined
    const requestId = traceHeader ?? crypto.randomUUID()
    const ipValue = getClientIp(request)
    const ipAddress = ipValue === "unknown" ? undefined : ipValue
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
      published: true,
      isPinned: true,
      coverImage: true,
      viewCount: true,
      publishedAt: true,
      createdAt: true,
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
              color: true,
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

    const dbStart = performance.now()

    const shouldCache = process.env.NODE_ENV === "production"
    const cacheKey = [
      "api-posts-public",
      String(page),
      String(limit),
      orderByField,
      orderDirection,
      search,
      tag ?? "",
      seriesId ?? "",
      hideAuthorEmail ? "hide-email" : "show-email",
    ]

    const loadPosts = () =>
      Promise.all([
        prisma.post.findMany({
          where,
          skip,
          take: limit,
          orderBy: orderByClauses,
          select: postSelect,
        }),
        prisma.post.count({ where }),
      ])

    const [posts, totalCount] = await (shouldCache
      ? unstable_cache(loadPosts, cacheKey, { revalidate: 30, tags: ["posts:list"] })()
      : loadPosts())
    const dbMs = performance.now() - dbStart

    const avatarInputs = Array.from(
      new Set(
        posts
          .map((post) => post.author.avatarUrl)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    const coverInputs = Array.from(
      new Set(
        posts
          .map((post) => post.coverImage)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    const signStart = performance.now()
    const [signedAvatars, signedCoverImages] = await Promise.all([
      avatarInputs.length > 0 ? createSignedUrls(avatarInputs) : Promise.resolve([]),
      coverInputs.length > 0
        ? createSignedUrls(coverInputs, POST_IMAGE_SIGN_EXPIRES_IN, "post-images")
        : Promise.resolve([]),
    ])
    const signMs = performance.now() - signStart

    const avatarMap = new Map<string, string>()
    avatarInputs.forEach((original, index) => {
      avatarMap.set(original, signedAvatars[index] ?? original)
    })

    const coverMap = new Map<string, string>()
    coverInputs.forEach((original, index) => {
      coverMap.set(original, signedCoverImages[index] ?? original)
    })

    const normalizedPosts = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      published: post.published,
      isPinned: post.isPinned,
      coverImage: post.coverImage,
      signedCoverImage: post.coverImage ? (coverMap.get(post.coverImage) ?? post.coverImage) : null,
      viewCount: post.viewCount,
      publishedAt: post.publishedAt?.toISOString() || null,
      createdAt: post.createdAt.toISOString(),
      author: {
        ...post.author,
        avatarUrl: post.author.avatarUrl
          ? (avatarMap.get(post.author.avatarUrl) ?? post.author.avatarUrl)
          : null,
      },
      tags: post.tags.map((pt) => pt.tag),
      stats: {
        commentsCount: post._count.comments,
        likesCount: post._count.likes,
        bookmarksCount: post._count.bookmarks,
      },
      contentLength: 0,
    }))

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

    const response = createSuccessResponse(
      {
        posts: normalizedPosts,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          nextCursor: pagination.nextCursor,
        },
      },
      { pagination, requestId }
    )

    const totalMs = performance.now() - totalStart
    response.headers.set(
      "Server-Timing",
      `db;dur=${dbMs.toFixed(1)}, sign;dur=${signMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`
    )
    response.headers.set("x-perf-db-ms", dbMs.toFixed(1))
    response.headers.set("x-perf-sign-ms", signMs.toFixed(1))
    response.headers.set("x-perf-total-ms", totalMs.toFixed(1))
    return response
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
