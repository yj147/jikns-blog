import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createErrorResponse, createSuccessResponse, ErrorCode } from "@/lib/api/unified-response"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

export const runtime = "nodejs"

async function handlePost(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params

  if (!postId) {
    return createErrorResponse(ErrorCode.INVALID_PARAMETERS, "缺少 postId", undefined, 400)
  }

  try {
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    })

    return createSuccessResponse({ ok: true })
  } catch {
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, "更新阅读量失败", undefined, 500)
  }
}

export const POST = withApiResponseMetrics(handlePost)
