/**
 * 前端错误日志 API 端点
 * Phase 5: 前端错误处理与用户体验优化
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { withApiSecurity, createSuccessResponse } from "@/lib/security/api-security"
import { z } from "zod"
import { logger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

// 日志数据结构验证
const logEntrySchema = z.object({
  id: z.string(),
  error: z.object({
    id: z.string(),
    type: z.enum(['SECURITY', 'NETWORK', 'BUSINESS', 'SYSTEM', 'VALIDATION']),
    subType: z.string().optional(),
    message: z.string(),
    userMessage: z.string(),
    details: z.record(z.any()).optional(),
    timestamp: z.number(),
    recoverable: z.boolean(),
    retryable: z.boolean(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    source: z.string().optional(),
    stackTrace: z.string().optional(),
    context: z.object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      path: z.string(),
      userAgent: z.string().optional(),
      timestamp: z.number(),
      action: z.string().optional(),
      component: z.string().optional(),
      requestId: z.string().optional()
    }).optional()
  }),
  environment: z.string(),
  userAgent: z.string(),
  url: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional()
})

const requestSchema = z.object({
  logs: z.array(logEntrySchema).min(1).max(50), // 最多 50 条日志
  metadata: z.object({
    timestamp: z.number(),
    userAgent: z.string(),
    url: z.string(),
    environment: z.string()
  })
})

function validateLogIngestSecret(req: NextRequest) {
  const expectedSecret = process.env.LOG_INGEST_SECRET

  if (!expectedSecret) {
    logger.error("环境变量 LOG_INGEST_SECRET 未配置", { module: "api/logs/errors" })
    return NextResponse.json({
      error: true,
      code: "CONFIG_ERROR",
      message: "日志密钥未配置",
      timestamp: Date.now()
    }, { status: 500 })
  }

  const headerSecret = req.headers.get("x-log-secret")
  const bearer = req.headers.get("authorization")
  const bearerToken = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null
  const providedSecret = headerSecret || bearerToken

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({
      error: true,
      code: "UNAUTHORIZED",
      message: "缺少或无效的日志密钥",
      timestamp: Date.now()
    }, { status: 401 })
  }

  return null
}

/**
 * POST /api/logs/errors - 接收前端错误日志
 */
async function handlePost(request: NextRequest) {
  return withApiSecurity(
    async (req: NextRequest) => {
      const secretValidation = validateLogIngestSecret(req)
      if (secretValidation) return secretValidation

      try {
        const body = await req.json()
        
        // 数据验证
        const validatedData = requestSchema.parse(body)
        const { logs, metadata } = validatedData

        // 创建 Supabase 客户端
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            cookies: {
              get(name: string) {
                return req.cookies.get(name)?.value
              },
              set() {}, // 日志接口不需要设置 cookie
              remove() {}
            }
          }
        )

        // 获取当前用户（如果已登录）
        const { data: { user } } = await supabase.auth.getUser()

        // 过滤敏感信息
        const sanitizedLogs = logs.map(log => ({
          id: log.id,
          error_type: log.error.type,
          error_subtype: log.error.subType || null,
          error_message: log.error.message.substring(0, 1000), // 限制长度
          user_message: log.error.userMessage.substring(0, 500),
          severity: log.error.severity,
          recoverable: log.error.recoverable,
          retryable: log.error.retryable,
          source: log.error.source || 'client',
          user_id: user?.id || null,
          session_id: log.error.context?.sessionId || null,
          path: log.error.context?.path || log.url,
          user_agent: log.userAgent.substring(0, 500),
          component: log.error.context?.component || null,
          action: log.error.context?.action || null,
          environment: log.environment,
          timestamp: new Date(log.timestamp).toISOString(),
          details: {
            original_id: log.error.id,
            context: log.error.context,
            metadata: log.metadata,
            request_metadata: metadata
          },
          created_at: new Date().toISOString()
        }))

        // 将日志存储到数据库（假设有一个 error_logs 表）
        // 注意：这里需要根据实际的数据库表结构调整
        try {
          const { error: insertError } = await supabase
            .from("error_logs")
            .insert(sanitizedLogs)

          if (insertError) {
            logger.error(
              "插入错误日志失败",
              { module: "api/logs/errors", count: sanitizedLogs.length },
              insertError
            )
            // 不阻塞响应，记录到控制台即可
          }
        } catch (dbError) {
          logger.error("错误日志数据库操作失败", { module: "api/logs/errors" }, dbError)
          // 在开发环境中，没有数据库表时，只记录到控制台
        }

        // 记录到控制台（开发环境）
        if (process.env.NODE_ENV === "development") {
          logs.forEach((log, index) => {
            logger.debug("前端错误日志采集", {
              module: "api/logs/errors",
              index: index + 1,
              total: logs.length,
              type: log.error.type,
              severity: log.error.severity,
              path: log.error.context?.path ?? log.url,
              message: log.error.message,
            })
          })
        }

        // 返回成功响应
        return createSuccessResponse({
          message: "日志上传成功",
          data: {
            processed: logs.length,
            timestamp: new Date().toISOString()
          }
        })

      } catch (error) {
        logger.error("处理错误日志失败", { module: "api/logs/errors" }, error)

        if (error instanceof z.ZodError) {
          return NextResponse.json({
            error: true,
            code: "VALIDATION_ERROR",
            message: "日志数据格式错误",
            details: error.errors,
            timestamp: Date.now()
          }, { status: 400 })
        }

        return NextResponse.json({
          error: true,
          code: "INTERNAL_ERROR",
          message: "内部服务器错误",
          timestamp: Date.now()
        }, { status: 500 })
      }
    },
    {
      requireAuth: false, // 允许匿名用户上传错误日志
      rateLimit: {
        maxRequests: 10,
        windowMs: 60 * 1000 // 1分钟内最多 10 次请求
      },
      validateCSRF: false // 错误日志上传不需要 CSRF 验证
    }
  )(request)
}

/**
 * GET /api/logs/errors - 查询错误日志（仅管理员）
 */
async function handleGet(request: NextRequest) {
  return withApiSecurity(
    async (req: NextRequest) => {
      const { searchParams } = new URL(req.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
      const severity = searchParams.get('severity')
      const type = searchParams.get('type')
      const startDate = searchParams.get('start_date')
      const endDate = searchParams.get('end_date')

      try {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            cookies: {
              get(name: string) {
                return req.cookies.get(name)?.value
              },
              set() {},
              remove() {}
            }
          }
        )

        let query = supabase
          .from('error_logs')
          .select('*', { count: 'exact' })
          .order('timestamp', { ascending: false })
          .range((page - 1) * limit, page * limit - 1)

        // 添加过滤条件
        if (severity) {
          query = query.eq('severity', severity)
        }
        if (type) {
          query = query.eq('error_type', type)
        }
        if (startDate) {
          query = query.gte('timestamp', startDate)
        }
        if (endDate) {
          query = query.lte('timestamp', endDate)
        }

        const { data: logs, error: fetchError, count } = await query

        if (fetchError) {
          throw fetchError
        }

        return createSuccessResponse({
          data: logs,
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit)
          }
        })

      } catch (error) {
        logger.error("查询错误日志失败", { module: "api/logs/errors" }, error)

        return NextResponse.json({
          error: true,
          code: 'QUERY_ERROR',
          message: '查询错误日志失败',
          timestamp: Date.now()
        }, { status: 500 })
      }
    },
    {
      requireAuth: true,
      validateCSRF: true
    }
  )(request)
}

export const POST = withApiResponseMetrics(handlePost)
export const GET = withApiResponseMetrics(handleGet)
