import { NextRequest } from "next/server"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { SubscriptionError, verifySubscription } from "@/lib/services/email-subscription"

async function handler(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return createErrorResponse(ErrorCode.MISSING_REQUIRED_FIELDS, "缺少 token 参数")
  }

  try {
    const subscriber = await verifySubscription(token)
    return createSuccessResponse({
      status: subscriber.status,
      email: subscriber.email,
    })
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
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "验证失败")
  }
}

export const GET = withApiResponseMetrics(handler)
