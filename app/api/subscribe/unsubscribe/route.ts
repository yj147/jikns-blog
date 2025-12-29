import { NextRequest } from "next/server"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { applyDistributedRateLimit } from "@/lib/rate-limit/shared"
import {
  SubscriptionError,
  unsubscribe,
  unsubscribeByEmail,
} from "@/lib/services/email-subscription"
import { getClientIPOrNull } from "@/lib/utils/client-ip"

const LIMIT_PER_HOUR = 10
const WINDOW_MS = 60 * 60 * 1000

const ERROR_CODE_MAP: Record<SubscriptionError["code"], ErrorCode> = {
  INVALID_EMAIL: ErrorCode.VALIDATION_ERROR,
  INVALID_TOKEN: ErrorCode.INVALID_TOKEN,
  TOKEN_EXPIRED: ErrorCode.TOKEN_EXPIRED,
  ALREADY_VERIFIED: ErrorCode.DUPLICATE_ENTRY,
  NOT_FOUND: ErrorCode.NOT_FOUND,
}

async function handleGet(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return createErrorResponse(ErrorCode.MISSING_REQUIRED_FIELDS, "缺少 token 参数")
  }

  try {
    const subscriber = await unsubscribe(token)
    return createSuccessResponse({
      status: subscriber.status,
      email: subscriber.email,
    })
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return createErrorResponse(ERROR_CODE_MAP[error.code], error.message, undefined, error.status)
    }
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "退订失败")
  }
}

async function handlePost(request: NextRequest) {
  const ip = getClientIPOrNull(request) ?? "unknown"
  const rate = await applyDistributedRateLimit(`unsubscribe:ip:${ip}`, LIMIT_PER_HOUR, WINDOW_MS)
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
  if (!email) {
    return createErrorResponse(ErrorCode.MISSING_REQUIRED_FIELDS, "缺少 email 字段")
  }

  try {
    await unsubscribeByEmail(email)
    return createSuccessResponse({ status: "unsubscribed" })
  } catch (error) {
    if (error instanceof SubscriptionError) {
      return createErrorResponse(ERROR_CODE_MAP[error.code], error.message, undefined, error.status)
    }
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "退订失败")
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)
