/**
 * 审计日志 API 端点
 * 提供审计日志查询和统计功能
 */

import { NextRequest, NextResponse } from "next/server"
import { auditLogger, AuditEventType } from "@/lib/audit-log"
import { ErrorHandler } from "@/lib/error-handler"
import { validateApiPermissions } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const validation = await validateApiPermissions(request, "admin")
    if (!validation.success) {
      return NextResponse.json(validation.error, {
        status: validation.error?.statusCode || 403,
      })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get("action") || "query"
    const userId = url.searchParams.get("userId")
    const eventType = url.searchParams.get("eventType") as AuditEventType
    const severity = url.searchParams.get("severity")
    const startDate = url.searchParams.get("startDate")
    const endDate = url.searchParams.get("endDate")
    const limit = parseInt(url.searchParams.get("limit") || "50")
    const offset = parseInt(url.searchParams.get("offset") || "0")

    // 验证参数
    if (limit > 1000) {
      return NextResponse.json({ error: "查询限制不能超过1000条记录" }, { status: 400 })
    }

    switch (action) {
      case "query": {
        // 查询审计日志
        const logs = await auditLogger.queryLogs({
          userId: userId || undefined,
          eventType: eventType || undefined,
          severity: severity || undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          limit,
          offset,
        })

        return NextResponse.json({
          success: true,
          data: logs,
          pagination: {
            limit,
            offset,
            total: logs.length,
          },
        })
      }

      case "stats": {
        // 获取用户活动统计
        if (!userId) {
          return NextResponse.json({ error: "用户统计需要提供 userId 参数" }, { status: 400 })
        }

        const days = parseInt(url.searchParams.get("days") || "30")
        const stats = await auditLogger.getUserActivityStats(userId, days)

        return NextResponse.json({
          success: true,
          data: {
            userId,
            period: `${days} 天`,
            ...stats,
          },
        })
      }

      case "summary": {
        // 系统审计摘要
        const days = parseInt(url.searchParams.get("days") || "7")
        const endTime = new Date()
        const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000)

        // 这里应该从数据库查询，当前返回模拟数据
        const summary = {
          period: `${days} 天`,
          totalEvents: 0,
          eventTypes: {
            [AuditEventType.USER_LOGIN]: 0,
            [AuditEventType.USER_LOGOUT]: 0,
            [AuditEventType.LOGIN_FAILED]: 0,
            [AuditEventType.UNAUTHORIZED_ACCESS]: 0,
            [AuditEventType.SYSTEM_ERROR]: 0,
          },
          severityBreakdown: {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            CRITICAL: 0,
          },
          topUsers: [], // 活跃用户列表
          suspiciousActivities: [], // 可疑活动
        }

        return NextResponse.json({
          success: true,
          data: summary,
        })
      }

      case "export": {
        // 导出审计日志
        const format = url.searchParams.get("format") || "json"

        if (format !== "json" && format !== "csv") {
          return NextResponse.json({ error: "支持的导出格式: json, csv" }, { status: 400 })
        }

        const logs = await auditLogger.queryLogs({
          userId: userId || undefined,
          eventType: eventType || undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          limit: Math.min(limit, 10000), // 导出限制
          offset,
        })

        // 记录导出操作
        await auditLogger.logEvent({
          eventType: AuditEventType.DATA_EXPORT,
          action: "AUDIT_LOG_EXPORT",
          details: {
            format,
            recordCount: logs.length,
            filters: { userId, eventType, startDate, endDate },
          },
          severity: "MEDIUM",
        })

        if (format === "csv") {
          // 转换为 CSV 格式
          const headers = ["时间", "用户ID", "事件类型", "操作", "严重性", "成功", "详情"]
          const csvContent = [
            headers.join(","),
            ...logs.map((log) =>
              [
                log.timestamp,
                log.userId || "",
                log.eventType,
                log.action,
                log.severity,
                log.success.toString(),
                JSON.stringify(log.details || {}).replace(/"/g, '""'),
              ]
                .map((field) => `"${field}"`)
                .join(",")
            ),
          ].join("\n")

          return new Response(csvContent, {
            headers: {
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
            },
          })
        }

        return NextResponse.json({
          success: true,
          data: logs,
          exportInfo: {
            format,
            recordCount: logs.length,
            exportedAt: new Date().toISOString(),
          },
        })
      }

      default:
        return NextResponse.json({ error: `不支持的操作: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return await ErrorHandler.handleApiError(error, "audit logs")
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const validation = await validateApiPermissions(request, "admin")
    if (!validation.success) {
      return NextResponse.json(validation.error, {
        status: validation.error?.statusCode || 403,
      })
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case "manual_log": {
        // 手动记录审计事件
        const { eventType, actionName, details, severity = "LOW" } = params

        if (!eventType || !actionName) {
          return NextResponse.json(
            { error: "缺少必要参数: eventType, actionName" },
            { status: 400 }
          )
        }

        await auditLogger.logEvent({
          eventType: eventType as AuditEventType,
          action: actionName,
          details,
          severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        })

        return NextResponse.json({
          success: true,
          message: "审计事件记录成功",
        })
      }

      case "cleanup": {
        // 清理旧日志
        const { daysToKeep = 90 } = params

        if (daysToKeep < 30) {
          return NextResponse.json({ error: "日志保留时间不能少于30天" }, { status: 400 })
        }

        await auditLogger.cleanupOldLogs(daysToKeep)

        // 记录清理操作
        await auditLogger.logEvent({
          eventType: AuditEventType.ADMIN_ACTION,
          action: "AUDIT_LOG_CLEANUP",
          details: { daysToKeep },
          severity: "MEDIUM",
        })

        return NextResponse.json({
          success: true,
          message: `已清理${daysToKeep}天前的审计日志`,
        })
      }

      case "analyze_suspicious": {
        // 分析可疑活动
        const { hours = 24, minFailures = 5 } = params

        // 这里应该实现可疑活动分析逻辑
        // 例如：短时间内多次登录失败、异常访问模式等

        const analysis = {
          timeRange: `${hours} 小时`,
          suspiciousPatterns: [
            // 示例数据
            {
              type: "BRUTE_FORCE",
              description: "暴力破解尝试",
              count: 0,
              affectedUsers: [],
            },
            {
              type: "UNUSUAL_ACCESS",
              description: "异常访问模式",
              count: 0,
              details: [],
            },
          ],
        }

        return NextResponse.json({
          success: true,
          data: analysis,
        })
      }

      default:
        return NextResponse.json({ error: `不支持的操作: ${action}` }, { status: 400 })
    }
  } catch (error) {
    return await ErrorHandler.handleApiError(error, "audit logs")
  }
}
