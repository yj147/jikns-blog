import { NextRequest } from "next/server"
import { followUser, unfollowUser } from "@/lib/interactions"
import { createSuccessResponse } from "@/lib/api/unified-response"
import { handleFollowOperation } from "@/lib/api/follow/pipeline"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handlePost(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const resolvedParams = await params

  return handleFollowOperation(
    request,
    resolvedParams,
    {
      auditAction: "USER_FOLLOW",
      metricAction: "follow",
    },
    async (ctx) => {
      const result = await followUser(ctx.user.id, ctx.targetId)
      const targetName = result.targetName || "该用户"
      const message = result.wasNew ? `已关注 ${targetName}` : `${targetName} 已在你的关注列表`

      const response = createSuccessResponse(
        {
          ...result,
          message,
        },
        { requestId: ctx.requestId }
      )

      return {
        response,
        auditDetails: {
          wasNew: result.wasNew,
          targetName: result.targetName,
        },
        performanceContext: {
          wasNew: result.wasNew,
        },
      }
    }
  )
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const resolvedParams = await params

  return handleFollowOperation(
    request,
    resolvedParams,
    {
      auditAction: "USER_UNFOLLOW",
      metricAction: "unfollow",
    },
    async (ctx) => {
      const result = await unfollowUser(ctx.user.id, ctx.targetId)

      const response = createSuccessResponse(
        {
          ...result,
          message: "已取消关注",
        },
        { requestId: ctx.requestId }
      )

      return {
        response,
        auditDetails: {
          wasDeleted: result.wasDeleted,
        },
        performanceContext: {
          wasDeleted: result.wasDeleted,
        },
      }
    }
  )
}

export const POST = withApiResponseMetrics(handlePost)
export const DELETE = withApiResponseMetrics(handleDelete)
