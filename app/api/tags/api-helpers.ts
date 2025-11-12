import { NextResponse } from "next/server"
import { ErrorCode, createErrorResponse, normalizeErrorCode } from "@/lib/api/unified-response"
import type { ApiResponse } from "@/lib/actions/tags"

export function toTagApiResponse<T>(
  result: ApiResponse<T>,
  successStatus: number = 200
): NextResponse<ApiResponse<T>> | NextResponse<ApiResponse> {
  if (result.success) {
    return NextResponse.json(
      {
        success: true,
        data: result.data,
        meta: {
          timestamp: result.meta?.timestamp ?? new Date().toISOString(),
          ...result.meta,
        },
      },
      { status: successStatus }
    )
  }

  const mappedCode = normalizeErrorCode(result.error?.code)

  const statusCode = result.error?.details?.statusCode as number | undefined

  return createErrorResponse(
    mappedCode,
    result.error?.message ?? "标签操作失败",
    result.error?.details,
    statusCode,
    result.meta
  )
}
