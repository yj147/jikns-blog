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

const BAN_OPERATION = "admin:user:ban"
const UNBAN_OPERATION = "admin:user:unban"

interface GuardResult {
  admin: AdminUser | null
  response: NextResponse | null
}

// 统一管理员权限校验，避免重复逻辑
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
  const { admin, response } = await ensureAdminAccess(request, requestId, BAN_OPERATION)
  if (!admin) {
    return response!
  }

  const { userId } = await params
  const ip = getClientIP(request)
  const ua = getClientUserAgent(request)

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    })

    if (!targetUser) {
      await auditLogger.logEvent({
        eventType: AuditEventType.ADMIN_ACTION,
        action: "ADMIN_USER_BAN_TARGET_MISSING",
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

      apiLogger.warn("admin user ban target not found", {
        requestId,
        operation: BAN_OPERATION,
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

    if (targetUser.id === admin.id) {
      await auditLogger.logEvent({
        eventType: AuditEventType.ADMIN_ACTION,
        action: "ADMIN_USER_BAN_SELF_BLOCKED",
        resource: `user:${userId}`,
        userId: admin.id,
        ipAddress: ip,
        userAgent: ua,
        requestId,
        severity: "HIGH",
        success: false,
        errorMessage: "管理员不能封禁自己",
        details: { operatorId: admin.id },
      })

      apiLogger.warn("admin user attempted self ban", {
        requestId,
        operation: BAN_OPERATION,
        actor: admin.id,
        target: userId,
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            message: "不能封禁自己",
            requestId,
          },
        },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceRoleClient()
    const previousStatus = targetUser.status

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: "BANNED" },
      select: { id: true, status: true },
    })

    try {
      await mergeSupabaseUserMetadata(supabaseAdmin, userId, { status: "BANNED" })
    } catch (metadataError) {
      apiLogger.error(
        "admin user ban supabase sync failed",
        {
          requestId,
          operation: BAN_OPERATION,
          actor: admin.id,
          target: userId,
        },
        metadataError as Error
      )

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { status: previousStatus },
        })
      } catch (rollbackError) {
        apiLogger.error(
          "admin user ban rollback failed",
          {
            requestId,
            operation: BAN_OPERATION,
            actor: admin.id,
            target: userId,
            previousStatus,
          },
          rollbackError as Error
        )
      }

      throw metadataError
    }

    await clearUserCache(userId)

    await auditLogger.logEvent({
      eventType: AuditEventType.ACCOUNT_BANNED,
      action: "ADMIN_USER_BAN",
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
        previousStatus: targetUser.status,
        newStatus: updatedUser.status,
      },
    })

    apiLogger.info("admin user banned", {
      requestId,
      operation: BAN_OPERATION,
      actor: admin.id,
      target: userId,
      previousStatus: targetUser.status,
      newStatus: updatedUser.status,
    })

    return NextResponse.json({ success: true, message: "用户已封禁" })
  } catch (error) {
    apiLogger.error(
      "admin user ban failed",
      {
        requestId,
        operation: BAN_OPERATION,
        actor: admin.id,
        target: userId,
      },
      error as Error
    )

    await auditLogger.logEvent({
      eventType: AuditEventType.ACCOUNT_BANNED,
      action: "ADMIN_USER_BAN",
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

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  const { admin, response } = await ensureAdminAccess(request, requestId, UNBAN_OPERATION)
  if (!admin) {
    return response!
  }

  const { userId } = await params
  const ip = getClientIP(request)
  const ua = getClientUserAgent(request)

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    })

    if (!targetUser) {
      await auditLogger.logEvent({
        eventType: AuditEventType.ADMIN_ACTION,
        action: "ADMIN_USER_UNBAN_TARGET_MISSING",
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

      apiLogger.warn("admin user unban target not found", {
        requestId,
        operation: UNBAN_OPERATION,
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

    const supabaseAdmin = createServiceRoleClient()
    const previousStatus = targetUser.status

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
      select: { id: true, status: true },
    })

    try {
      await mergeSupabaseUserMetadata(supabaseAdmin, userId, { status: "ACTIVE" })
    } catch (metadataError) {
      apiLogger.error(
        "admin user unban supabase sync failed",
        {
          requestId,
          operation: UNBAN_OPERATION,
          actor: admin.id,
          target: userId,
        },
        metadataError as Error
      )

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { status: previousStatus },
        })
      } catch (rollbackError) {
        apiLogger.error(
          "admin user unban rollback failed",
          {
            requestId,
            operation: UNBAN_OPERATION,
            actor: admin.id,
            target: userId,
            previousStatus,
          },
          rollbackError as Error
        )
      }

      throw metadataError
    }

    await clearUserCache(userId)

    await auditLogger.logEvent({
      eventType: AuditEventType.ACCOUNT_UNBANNED,
      action: "ADMIN_USER_UNBAN",
      resource: `user:${userId}`,
      userId: admin.id,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      severity: "MEDIUM",
      success: true,
      details: {
        operatorId: admin.id,
        targetUserId: userId,
        targetEmail: targetUser.email,
        previousStatus: targetUser.status,
        newStatus: updatedUser.status,
      },
    })

    apiLogger.info("admin user unbanned", {
      requestId,
      operation: UNBAN_OPERATION,
      actor: admin.id,
      target: userId,
      previousStatus: targetUser.status,
      newStatus: updatedUser.status,
    })

    return NextResponse.json({ success: true, message: "用户已解封" })
  } catch (error) {
    apiLogger.error(
      "admin user unban failed",
      {
        requestId,
        operation: UNBAN_OPERATION,
        actor: admin.id,
        target: userId,
      },
      error as Error
    )

    await auditLogger.logEvent({
      eventType: AuditEventType.ACCOUNT_UNBANNED,
      action: "ADMIN_USER_UNBAN",
      resource: `user:${userId}`,
      userId: admin.id,
      ipAddress: ip,
      userAgent: ua,
      requestId,
      severity: "MEDIUM",
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
export const DELETE = withApiResponseMetrics(handleDelete)
