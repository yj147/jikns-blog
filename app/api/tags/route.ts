import { NextRequest } from "next/server"
import { getTags, createTag } from "@/lib/actions/tags"
import { ErrorCode, createErrorResponse } from "@/lib/api/unified-response"
import { toTagApiResponse } from "./api-helpers"
import { enforceTagRateLimitForRequest } from "@/lib/rate-limit/tag-limits"
import { getOptionalViewer } from "@/lib/auth/session"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const ORDER_BY_WHITELIST = new Set(["postsCount", "name", "createdAt"])
const ORDER_WHITELIST = new Set(["asc", "desc"])

function parseInteger(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed
}

function normalizeOrderBy(value: string | null) {
  return value && ORDER_BY_WHITELIST.has(value)
    ? (value as "postsCount" | "name" | "createdAt")
    : undefined
}

function normalizeOrder(value: string | null) {
  return value && ORDER_WHITELIST.has(value) ? (value as "asc" | "desc") : undefined
}

function handleRateLimitError(error: unknown) {
  const statusCode = (error as any)?.statusCode as number | undefined
  const retryAfter = (error as any)?.retryAfter as number | undefined
  if (statusCode === 429) {
    return createErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      (error as Error).message || "请求过于频繁",
      { retryAfter },
      statusCode
    )
  }
  throw error
}

async function handleGet(request: NextRequest) {
  const viewer = await getOptionalViewer({ request })
  try {
    await enforceTagRateLimitForRequest("search", request, viewer?.id)
  } catch (error) {
    return handleRateLimitError(error)
  }
  const searchParams = request.nextUrl.searchParams

  const page = parseInteger(searchParams.get("page"))
  const limit = parseInteger(searchParams.get("limit"))
  const orderBy = normalizeOrderBy(searchParams.get("orderBy"))
  const order = normalizeOrder(searchParams.get("order"))
  const rawSearch = searchParams.get("search")
  const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim() : undefined

  const result = await getTags(
    {
      page,
      limit,
      orderBy,
      order,
      search,
    },
    { skipRateLimit: true }
  )

  return toTagApiResponse(result)
}

async function handlePost(request: NextRequest) {
  const viewer = await getOptionalViewer({ request })
  try {
    await enforceTagRateLimitForRequest("mutation", request, viewer?.id)
  } catch (error) {
    return handleRateLimitError(error)
  }
  let body: any

  try {
    body = await request.json()
  } catch {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "请求体必须为合法的 JSON")
  }

  const result = await createTag({
    name: body?.name,
    description: body?.description ?? undefined,
    color: body?.color ?? undefined,
  })

  return toTagApiResponse(result, 201)
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)
