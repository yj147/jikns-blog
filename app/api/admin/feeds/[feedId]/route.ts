import { NextRequest } from "next/server"
import { withApiAuth, createErrorResponse, createSuccessResponse } from "@/lib/api-guards"
import { prisma } from "@/lib/prisma"
import { feedInclude, mapFeedRecord } from "../utils"
import type { User } from "@/lib/generated/prisma"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

const getHandler = withApiAuth(
  async (_request: NextRequest, user: User, context: { params: { feedId: string } }) => {
    const feedId = context.params?.feedId

    if (!feedId) {
      return createErrorResponse("缺少 feedId", "MISSING_ID", 400)
    }

    const feed = await prisma.activity.findUnique({
      where: { id: feedId },
      include: feedInclude,
    })

    if (!feed) {
      return createErrorResponse("未找到动态", "NOT_FOUND", 404)
    }

    if (user.role !== "ADMIN" && feed.authorId !== user.id) {
      return createErrorResponse("权限不足", "FORBIDDEN", 403)
    }

    return createSuccessResponse(mapFeedRecord(feed))
  },
  "auth"
)

export const GET = withApiResponseMetrics(getHandler)
