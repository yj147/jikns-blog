/**
 * 安全功能演示API - Phase 4 安全增强
 * 展示如何使用新的安全装饰器和工具
 */

import { NextRequest } from "next/server"
import {
  withApiSecurity,
  SecurityConfigs,
  createSuccessResponse,
} from "@/lib/security/api-security"
import { AdvancedXSSCleaner, InputSanitizer } from "@/lib/security/xss-cleaner"

/**
 * 公开API演示 - 基础安全防护
 */
export const GET = withApiSecurity(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") || ""

  // 使用输入清理器清理查询参数
  const sanitizedQuery = InputSanitizer.sanitizeUserInput(query, "text")

  if (!sanitizedQuery) {
    return createSuccessResponse({
      message: "查询参数无效",
      query: null,
    })
  }

  return createSuccessResponse({
    message: "搜索请求处理成功",
    query: sanitizedQuery,
    results: [`结果1: ${sanitizedQuery}`, `结果2: ${sanitizedQuery}`],
  })
}, SecurityConfigs.public)

/**
 * 需要认证的API演示 - 完整安全防护
 */
export const POST = withApiSecurity(async (request: NextRequest, { security }) => {
  try {
    // 获取请求体
    const body = await request.json()

    // 使用高级XSS清理器清理输入
    const sanitizedData = InputSanitizer.sanitizeObject(body)

    // 使用内容验证器验证清理后的内容
    if (sanitizedData.content) {
      const sanitizedContent = AdvancedXSSCleaner.deepSanitizeHTML(sanitizedData.content as string)
      // 更新清理后的内容
      sanitizedData.content = sanitizedContent
    }

    // 模拟业务逻辑处理
    const result = {
      id: crypto.randomUUID(),
      data: sanitizedData,
      userId: security?.userId,
      timestamp: new Date().toISOString(),
    }

    return createSuccessResponse(result, 201, "数据创建成功")
  } catch (error) {
    console.error("API处理错误:", error)
    return createSuccessResponse(
      {
        error: "请求处理失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      400
    )
  }
}, SecurityConfigs.authenticated)

/**
 * 管理员API演示 - 最高级别安全防护
 */
export const PUT = withApiSecurity(async (request: NextRequest, { security }) => {
  try {
    const body = await request.json()

    // 管理员操作的额外验证
    if (!security?.userId || security?.userRole !== "ADMIN") {
      return createSuccessResponse(
        {
          error: "权限不足",
        },
        403
      )
    }

    // 使用严格的输入清理
    const sanitizedData = AdvancedXSSCleaner.deepSanitizeHTML(JSON.stringify(body))

    let parsedData
    try {
      parsedData = JSON.parse(sanitizedData)
    } catch {
      return createSuccessResponse(
        {
          error: "数据格式无效",
        },
        400
      )
    }

    // 模拟管理员操作
    const result = {
      operation: "admin_update",
      adminId: security.userId,
      data: parsedData,
      timestamp: new Date().toISOString(),
      requestId: security.requestId,
    }

    return createSuccessResponse(result, 200, "管理员操作成功")
  } catch (error) {
    console.error("管理员API错误:", error)
    return createSuccessResponse(
      {
        error: "管理员操作失败",
      },
      500
    )
  }
}, SecurityConfigs.admin)

/**
 * 自定义安全配置演示
 */
export const DELETE = withApiSecurity(
  async (request: NextRequest, { security }) => {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return createSuccessResponse(
        {
          error: "缺少ID参数",
        },
        400
      )
    }

    // 清理ID参数
    const sanitizedId = InputSanitizer.sanitizeUserInput(id)

    if (!sanitizedId || sanitizedId.length > 50) {
      return createSuccessResponse(
        {
          error: "ID参数无效",
        },
        400
      )
    }

    // 模拟删除操作
    const result = {
      deleted: true,
      id: sanitizedId,
      deletedBy: security?.userId,
      timestamp: new Date().toISOString(),
    }

    return createSuccessResponse(result, 200, "删除成功")
  },
  {
    requireAuth: true,
    requireAdmin: false, // 普通用户也可以删除
    validateCSRF: true,
    sanitizeInput: true,
    allowedMethods: ["DELETE"],
    rateLimit: { maxRequests: 10, windowMs: 60 * 1000 }, // 每分钟最多10次删除
    customValidation: async (request, context) => {
      // 自定义验证逻辑
      const { searchParams } = new URL(request.url)
      const id = searchParams.get("id")

      if (id && id.includes("admin")) {
        return {
          isValid: false,
          errorCode: "ADMIN_RESOURCE_PROTECTION",
          errorMessage: "不能删除管理员资源",
        }
      }

      return { isValid: true }
    },
  }
)
