import { NextRequest } from "next/server"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { applyDistributedRateLimit } from "@/lib/rate-limit/shared"
import { createSubscription, SubscriptionError } from "@/lib/services/email-subscription"
import { getClientIPOrNull } from "@/lib/utils/client-ip"

const LIMIT_PER_HOUR = 10
const WINDOW_MS = 60 * 60 * 1000

async function handler(request: NextRequest) {
  if (request.method !== "POST") {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "Unsupported method")
  }

  const ip = getClientIPOrNull(request) ?? "unknown"
  const rate = await applyDistributedRateLimit(`subscribe:ip:${ip}`, LIMIT_PER_HOUR, WINDOW_MS)
  if (!rate.allowed) {
    return createErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      "操作过于频繁，请稍后再试",
      { retryAfter: rate.retryAfter },
      429
    )
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, "请求体必须为 JSON")
  }

  const email = payload?.email as string | undefined
  const userId = payload?.userId as string | undefined

  if (!email) {
    return createErrorResponse(ErrorCode.MISSING_REQUIRED_FIELDS, "缺少 email 字段")
  }

  try {
    const result = await createSubscription(email, userId)
    const status = result.status ?? "pending"
    return createSuccessResponse({ status })
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const map: Record<SubscriptionError["code"], ErrorCode> = {
        INVALID_EMAIL: ErrorCode.VALIDATION_ERROR,
        INVALID_TOKEN: ErrorCode.INVALID_TOKEN,
        TOKEN_EXPIRED: ErrorCode.TOKEN_EXPIRED,
        ALREADY_VERIFIED: ErrorCode.DUPLICATE_ENTRY,
        NOT_FOUND: ErrorCode.NOT_FOUND,
      }
      return createErrorResponse(map[error.code], error.message, undefined, error.status)
    }

    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "订阅请求失败")
  }
}

export const POST = withApiResponseMetrics(handler)
