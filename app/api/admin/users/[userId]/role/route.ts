import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  requireAdmin,
  generateRequestId,
  clearUserCache,
  type PolicyUserMap,
} from "@/lib/auth/session"
import { AuthError } from "@/lib/error-handling/auth-error"
import { mergeSupabaseUserMetadata } from "@/lib/auth/supabase-metadata"
import { createServiceRoleClient } from "@/lib/supabase"
import { apiLogger } from "@/lib/utils/logger"
import { auditLogger, AuditEventType, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

type AdminUser = PolicyUserMap["admin"]
type RoleValue = "USER" | "ADMIN"

interface RolePayload {
  role?: unknown
}

const ROLE_UPDATE_OPERATION = "admin:user:role:update"
const VALID_ROLES: RoleValue[] = ["USER", "ADMIN"]

interface GuardResult {
  admin: AdminUser | null
  response: NextResponse | null
}

function createInvalidRoleResponse(requestId: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "无效的角色值",
        requestId,
      },
    },
    { status: 400 }
  )
}

async function ensureAdminAccess(
  request: NextRequest,
  requestId: string,
  operation: string
): Promise<GuardResult> {
  try {
    const admin = await requireAdmin(request)
    return { admin, response: null }
  } catch (error) {
    const status = error instanceof AuthError ? error.statusCode : 403

    apiLogger.warn("admin action forbidden", {
      requestId,
      operation,
      errorCode: error instanceof AuthError ? error.code : undefined,
    })

    return {
      admin: null,
      response: NextResponse.json(
        {
          success: false,
          error: {
            message: "需要管理员权限",
            requestId,
          },
        },
        { status }
      ),
    }
  }
}

async function handlePost(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  const { admin, response } = await ensureAdminAccess(request, requestId, ROLE_UPDATE_OPERATION)
  if (!admin) {
    return response!
  }

  const { userId } = await params
  const ip = getClientIP(request)
  const ua = getClientUserAgent(request)

  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch (error) {
    apiLogger.warn("admin role update payload parse failed", {
      requestId,
      operation: ROLE_UPDATE_OPERATION,
      actor: admin.id,
    })
    return createInvalidRoleResponse(requestId)
  }

  const roleInput =
    typeof parsedBody === "object" && parsedBody !== null
      ? (parsedBody as RolePayload).role
      : undefined

  const normalizedRole = typeof roleInput === "string" ? roleInput.trim().toUpperCase() : null

  if (!normalizedRole || !VALID_ROLES.includes(normalizedRole as RoleValue)) {
    apiLogger.warn("admin role update invalid role", {
      requestId,
      operation: ROLE_UPDATE_OPERATION,
      actor: admin.id,
    })
    return createInvalidRoleResponse(requestId)
  }

  const targetRole = normalizedRole as RoleValue

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) {
      await auditLogger.logEvent({
        eventType: AuditEventType.ADMIN_ACTION,
        action: "ADMIN_USER_ROLE_UPDATE_TARGET_MISSING",
        resource: `user:${userId}`,
        userId: admin.id,
        ipAddress: ip,
        userAgent: ua,
        requestId,
        severity: "MEDIUM",
        success: false,
        errorMessage: "目标用户不存在",
        details: { operatorId: admin.id, targetUserId: userId },
      })

      apiLogger.warn("admin user role update target not found", {
        requestId,
        operation: ROLE_UPDATE_OPERATION,
        actor: admin.id,
        target: userId,
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            message: "用户不存在",
            requestId,
          },
        },
        { status: 404 }
      )
    }

    const isSelfModification = targetUser.id === admin.id
    if (isSelfModification && targetRole === "USER") {
      await auditLogger.logEvent({
        eventType: AuditEventType.ADMIN_ACTION,
        action: "ADMIN_ROLE_SELF_DOWNGRADE_BLOCKED",
        resource: `user:${userId}`,
        userId: admin.id,
        ipAddress: ip,
        userAgent: ua,
        requestId,
        severity: "HIGH",
        success: false,
        errorMessage: "管理员不能降级自己",
        details: {
          operatorId: admin.id,
          previousRole: targetUser.role,
          attemptedRole: targetRole,
        },
      })

      apiLogger.warn("admin attempted self role downgrade", {
        requestId,
        operation: ROLE_UPDATE_OPERATION,
        actor: admin.id,
        target: userId,
        attemptedRole: targetRole,
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            message: "不能降级自己的角色",
            requestId,
          },
        },
        { status: 400 }
      )
    }

    if (isSelfModification && targetRole === "ADMIN" && targetUser.role !== "ADMIN") {
      apiLogger.warn("admin self role escalation", {
        requestId,
        operation: ROLE_UPDATE_OPERATION,
        actor: admin.id,
        target: userId,
        previousRole: targetUser.role,
        newRole: targetRole,
      })
    }

    const supabaseAdmin = createServiceRoleClient()
    const previousRole = targetUser.role

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: targetRole },
      select: { id: true, email: true, role: true },
    })

    try {
      await mergeSupabaseUserMetadata(supabaseAdmin, userId, { role: targetRole })
    } catch (metadataError) {
      apiLogger.error(
        "admin user role update supabase sync failed",
        {
          requestId,
          operation: ROLE_UPDATE_OPERATION,
          actor: admin.id,
          target: userId,
        },
        metadataError as Error
      )

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { role: previousRole },
        })
      } catch (rollbackError) {
        apiLogger.error(
          "admin user role rollback failed",
          {
            requestId,
            operation: ROLE_UPDATE_OPERATION,
            actor: admin.id,
            target: userId,
            previousRole,
          },
          rollbackError as Error
        )
      }

      throw metadataError
    }

    await clearUserCache(userId)

    await auditLogger.logEvent({
      eventType: AuditEventType.ROLE_CHANGED,
      action: "ADMIN_USER_ROLE_UPDATE",
      resource: `user:${userId}`,
      userId: admin.id,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      severity: "HIGH",
      success: true,
      details: {
        operatorId: admin.id,
        targetUserId: userId,
        targetEmail: targetUser.email,
        previousRole: targetUser.role,
        newRole: updatedUser.role,
        selfModification: isSelfModification,
      },
    })

    apiLogger.info("admin user role updated", {
      requestId,
      operation: ROLE_UPDATE_OPERATION,
      actor: admin.id,
      target: userId,
      previousRole: targetUser.role,
      newRole: updatedUser.role,
    })

    return NextResponse.json({
      success: true,
      message: `角色已更新为 ${updatedUser.role}`,
    })
  } catch (error) {
    apiLogger.error(
      "admin user role update failed",
      {
        requestId,
        operation: ROLE_UPDATE_OPERATION,
        actor: admin.id,
        target: userId,
      },
      error as Error
    )

    await auditLogger.logEvent({
      eventType: AuditEventType.ROLE_CHANGED,
      action: "ADMIN_USER_ROLE_UPDATE",
      resource: `user:${userId}`,
      userId: admin.id,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      severity: "HIGH",
      success: false,
      errorMessage: error instanceof Error ? error.message : "未知错误",
      details: { operatorId: admin.id, targetUserId: userId },
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "服务器内部错误",
          requestId,
        },
      },
      { status: 500 }
    )
  }
}

export const POST = withApiResponseMetrics(handlePost)
