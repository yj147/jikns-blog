/**
 * 管理员用户权限管理 API
 * 允许管理员修改用户的角色和状态
 */

import { NextRequest } from "next/server"
import { withApiAuth } from "@/lib/api/unified-auth"
import { createSuccessResponse, createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { handleApiError } from "@/lib/api/error-handler"
import { prisma } from "@/lib/prisma"
import { clearUserCache } from "@/lib/auth/session"
import { auditLogger, getClientIP, getClientUserAgent } from "@/lib/audit-log"
import { logger } from "@/lib/utils/logger"

/**
 * PATCH - 修改用户权限
 * 管理员专用，用于修改用户的 role 或 status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withApiAuth(request, "admin", async (ctx) => {
    const { user: admin, requestId } = ctx
    const { userId } = await params
    const ip = getClientIP(request)
    const ua = getClientUserAgent(request)

    try {
      const body = await request.json()
      const { role, status } = body

      // 验证输入
      if (!role && !status) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "必须提供 role 或 status 参数")
      }

      if (role && !["USER", "ADMIN"].includes(role)) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "无效的用户角色")
      }

      if (status && !["ACTIVE", "BANNED"].includes(status)) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, "无效的用户状态")
      }

      // 检查目标用户是否存在
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, status: true },
      })

      if (!targetUser) {
        await auditLogger.logEvent({
          action: "USER_PERMISSION_UPDATE",
          resource: `user:${userId}`,
          success: false,
          severity: "MEDIUM",
          errorMessage: "目标用户不存在",
          userId: admin.id,
          ipAddress: ip,
          userAgent: ua,
          details: { requestId, targetUserId: userId },
        })

        return createErrorResponse(ErrorCode.NOT_FOUND, "目标用户不存在", undefined, 404)
      }

      // 防止管理员修改自己的权限
      if (userId === admin.id) {
        await auditLogger.logEvent({
          action: "USER_PERMISSION_UPDATE",
          resource: `user:${userId}`,
          success: false,
          severity: "HIGH",
          errorMessage: "管理员不能修改自己的权限",
          userId: admin.id,
          ipAddress: ip,
          userAgent: ua,
          details: { requestId, reason: "self_modification_blocked" },
        })

        return createErrorResponse(ErrorCode.FORBIDDEN, "不能修改自己的权限", undefined, 403)
      }

      // 构建更新数据
      const updateData: { role?: "USER" | "ADMIN"; status?: "ACTIVE" | "BANNED" } = {}
      if (role) updateData.role = role
      if (status) updateData.status = status

      // 更新用户
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      })

      // 关键步骤：清除缓存
      // 确保用户权限变更立即生效
      await clearUserCache(userId)

      // 记录审计日志
      await auditLogger.logEvent({
        action: "USER_PERMISSION_UPDATE",
        resource: `user:${userId}`,
        success: true,
        severity: "HIGH",
        userId: admin.id,
        ipAddress: ip,
        userAgent: ua,
        details: {
          requestId,
          targetUserId: userId,
          targetEmail: targetUser.email,
          changes: updateData,
          previousRole: targetUser.role,
          previousStatus: targetUser.status,
          newRole: updatedUser.role,
          newStatus: updatedUser.status,
        },
      })

      logger.info("管理员修改用户权限成功", {
        adminId: admin.id,
        targetUserId: userId,
        changes: updateData,
        requestId,
      })

      return createSuccessResponse(
        {
          user: updatedUser,
          message: "用户权限更新成功",
        },
        { requestId }
      )
    } catch (error) {
      logger.error("修改用户权限失败:", error as Error)

      await auditLogger.logEvent({
        action: "USER_PERMISSION_UPDATE",
        resource: `user:${userId}`,
        success: false,
        severity: "HIGH",
        errorMessage: (error as Error).message,
        userId: admin.id,
        ipAddress: ip,
        userAgent: ua,
        details: { requestId, error: String(error) },
      })

      return handleApiError(error)
    }
  })
}
