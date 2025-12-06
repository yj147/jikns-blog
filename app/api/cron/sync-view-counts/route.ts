import { NextRequest, NextResponse } from "next/server"
import { runViewCountSync } from "@/lib/cron/sync-view-counts"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { verifyCronSecret } from "@/lib/api/verify-cron-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron Job 端点
 * 每分钟执行一次，同步 Redis 中的浏览量到数据库
 *
 * 配置方式：在 vercel.json 中添加
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-view-counts",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
async function handleGet(request: NextRequest) {
  const authFailure = verifyCronSecret(request)
  if (authFailure) return authFailure

  try {
    const result = await runViewCountSync()

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
