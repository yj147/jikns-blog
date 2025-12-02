import { NextRequest } from "next/server"
import { withApiAuth, createErrorResponse, createSuccessResponse } from "@/lib/api-guards"
import { prisma } from "@/lib/prisma"
import { adminFeedActionSchema } from "@/types/feed"
import type { User } from "@/lib/generated/prisma"
import { adjustTagActivitiesCountForActivities } from "@/lib/services/activity-tags"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

type AllowedAction = "delete" | "pin" | "unpin" | "hide" | "unhide"

const postHandler = withApiAuth(async (request: NextRequest, user: User) => {
  const payload = await request.json().catch(() => ({}))
  const parsed = adminFeedActionSchema.safeParse(payload)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return createErrorResponse(issue?.message || "参数验证失败", "INVALID_BODY", 400)
  }

  const { action, ids } = parsed.data
  const isAdmin = user.role === "ADMIN"
  const now = new Date()

  const baseWhere = isAdmin ? { id: { in: ids } } : { id: { in: ids }, authorId: user.id }

  // 预取目标记录，确保权限一致性
  const targets = await prisma.activity.findMany({
    where: { id: { in: ids } },
    select: { id: true, authorId: true },
  })

  if (targets.length === 0) {
    return createErrorResponse("未找到目标动态", "NOT_FOUND", 404)
  }

  if (!isAdmin) {
    const unauthorized = targets.find((item) => item.authorId !== user.id)
    if (unauthorized) {
      return createErrorResponse("包含无权限的动态", "FORBIDDEN", 403)
    }
  }

  try {
    const affected = await prisma.$transaction(async (tx) => {
      switch (action) {
        case "delete": {
          const deletable = await tx.activity.findMany({
            where: baseWhere,
            select: { id: true, deletedAt: true },
          })
          if (deletable.length === 0) return 0

          const activeIds = deletable.filter((item) => item.deletedAt === null).map((item) => item.id)
          if (activeIds.length > 0) {
            await adjustTagActivitiesCountForActivities(tx, activeIds, "decrement")
          }

          const deleteWhere = isAdmin
            ? { id: { in: deletable.map((item) => item.id) } }
            : { id: { in: deletable.map((item) => item.id) }, authorId: user.id }

          await tx.activity.deleteMany({ where: deleteWhere })
          return deletable.length
        }
        case "pin": {
          const result = await tx.activity.updateMany({
            where: {
              id: { in: ids },
              deletedAt: null,
              ...(isAdmin ? {} : { authorId: user.id }),
            },
            data: { isPinned: true },
          })
          return result.count
        }
        case "unpin": {
          const result = await tx.activity.updateMany({
            where: {
              id: { in: ids },
              ...(isAdmin ? {} : { authorId: user.id }),
            },
            data: { isPinned: false },
          })
          return result.count
        }
        case "hide": {
          const hideTargets = await tx.activity.findMany({
            where: {
              ...baseWhere,
              deletedAt: null,
            },
            select: { id: true },
          })
          const idsToHide = hideTargets.map((item) => item.id)
          if (idsToHide.length === 0) return 0

          await adjustTagActivitiesCountForActivities(tx, idsToHide, "decrement")

          await tx.activity.updateMany({
            where: {
              id: { in: idsToHide },
              deletedAt: null,
              ...(isAdmin ? {} : { authorId: user.id }),
            },
            data: { deletedAt: now },
          })
          return idsToHide.length
        }
        case "unhide": {
          const unhideTargets = await tx.activity.findMany({
            where: {
              ...baseWhere,
              deletedAt: { not: null },
            },
            select: { id: true },
          })
          const idsToUnhide = unhideTargets.map((item) => item.id)
          if (idsToUnhide.length === 0) return 0

          await tx.activity.updateMany({
            where: {
              id: { in: idsToUnhide },
              ...(isAdmin ? {} : { authorId: user.id }),
            },
            data: { deletedAt: null },
          })

          await adjustTagActivitiesCountForActivities(tx, idsToUnhide, "increment")
          return idsToUnhide.length
        }
        default:
          return 0
      }
    })

    return createSuccessResponse({
      action,
      affected,
    })
  } catch (error) {
    return createErrorResponse("批量操作失败", "BATCH_FAILED", 500)
  }
}, "auth")

export const POST = withApiResponseMetrics(postHandler)
