import { NextRequest } from "next/server"
import { z } from "zod"
import { unstable_cache } from "next/cache"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { getClientIP } from "@/lib/audit-log"
import { checkSearchRateLimit } from "@/lib/rate-limit/search-limits"
import { unifiedSearch } from "@/lib/repos/search"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import {
  SearchValidationError,
  UNIFIED_SEARCH_SORTS,
  UNIFIED_SEARCH_TYPES,
  type UnifiedSearchSort,
  type UnifiedSearchType,
} from "@/types/search"

export const revalidate = 60

const SAFE_QUERY_PATTERN = /(--|\/\*|\*\/|;)/

const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, "搜索关键词不能为空")
    .max(100, "搜索关键词不能超过100个字符")
    .refine((value) => !SAFE_QUERY_PATTERN.test(value), "搜索关键词包含非法字符"),
  type: z.enum(UNIFIED_SEARCH_TYPES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  sort: z.enum(UNIFIED_SEARCH_SORTS).optional(),
})

function mapQueryParams(params: z.infer<typeof SearchQuerySchema>): {
  query: string
  type?: UnifiedSearchType
  page?: number
  limit?: number
  sort?: UnifiedSearchSort
} {
  return {
    query: params.q,
    type: params.type,
    page: params.page,
    limit: params.limit,
    sort: params.sort,
  }
}

async function handleGet(request: NextRequest) {
  const totalStart = performance.now()
  let rateMs = 0
  let searchMs = 0

  try {
    const parsed = SearchQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        issue?.message || "参数验证失败",
        { field: issue?.path?.join(".") },
        400
      )
    }

    const ip = getClientIP(request)
    const rateStart = performance.now()
    const rateResult = await checkSearchRateLimit({ ip })
    rateMs = performance.now() - rateStart
    if (!rateResult.allowed) {
      return createErrorResponse(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        "搜索过于频繁，请稍后再试",
        { retryAfter: rateResult.retryAfter },
        429
      )
    }

    const searchStart = performance.now()
    const mapped = mapQueryParams(parsed.data)
    const cacheKey = [
      "api-search",
      mapped.query,
      mapped.type ?? "all",
      mapped.sort ?? "relevance",
      String(mapped.page ?? 1),
      String(mapped.limit ?? 10),
    ]
    const shouldCache = process.env.NODE_ENV === "production"
    const result = await (shouldCache
      ? unstable_cache(() => unifiedSearch(mapped), cacheKey, {
          revalidate: 30,
          tags: ["search"],
        })()
      : unifiedSearch(mapped))
    searchMs = performance.now() - searchStart

    const response = createSuccessResponse(result, { requestId: crypto.randomUUID() })
    const totalMs = performance.now() - totalStart
    response.headers.set(
      "Server-Timing",
      `rate;dur=${rateMs.toFixed(1)}, search;dur=${searchMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`
    )
    response.headers.set("x-perf-rate-ms", rateMs.toFixed(1))
    response.headers.set("x-perf-search-ms", searchMs.toFixed(1))
    response.headers.set("x-perf-total-ms", totalMs.toFixed(1))
    return response
  } catch (error) {
    if (error instanceof SearchValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, error.message, error.details, 400)
    }

    if (error instanceof z.ZodError) {
      const issue = error.issues[0]
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        issue?.message || "参数验证失败",
        { field: issue?.path?.join(".") },
        400
      )
    }

    return handleApiError(error)
  }
}

export const GET = withApiResponseMetrics(handleGet)
