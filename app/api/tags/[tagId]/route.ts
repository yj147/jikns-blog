import { NextRequest } from "next/server"
import { getTag, updateTag, deleteTag, type UpdateTagData } from "@/lib/actions/tags"
import { ErrorCode, createErrorResponse } from "@/lib/api/unified-response"
import { toTagApiResponse } from "../api-helpers"
import { enforceTagRateLimitForRequest } from "@/lib/rate-limit/tag-limits"
import { getOptionalViewer } from "@/lib/auth/session"

export async function GET(_request: NextRequest, { params }: { params: { tagId: string } }) {
  const result = await getTag(params.tagId)
  return toTagApiResponse(result)
}

export async function PATCH(request: NextRequest, { params }: { params: { tagId: string } }) {
  const viewer = await getOptionalViewer({ request })
  try {
    await enforceTagRateLimitForRequest("mutation", request, viewer?.id)
  } catch (error) {
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
  let body: any

  try {
    body = await request.json()
  } catch {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "请求体必须为合法的 JSON")
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "请求体必须为 JSON 对象")
  }

  const payload: UpdateTagData = {}

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    payload.name = body.name
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    payload.description = body.description
  }

  if (Object.prototype.hasOwnProperty.call(body, "color")) {
    payload.color = body.color
  }

  const result = await updateTag(params.tagId, payload)
  return toTagApiResponse(result)
}

export async function DELETE(request: NextRequest, { params }: { params: { tagId: string } }) {
  const viewer = await getOptionalViewer({ request })
  try {
    await enforceTagRateLimitForRequest("mutation", request, viewer?.id)
  } catch (error) {
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
  const result = await deleteTag(params.tagId)
  return toTagApiResponse(result)
}
