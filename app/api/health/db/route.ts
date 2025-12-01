/**
 * 数据库健康检查 API
 * GET /api/health/db
 */

import { NextResponse } from "next/server"
import { checkDbHealth } from "@/lib/utils/db-health"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handleGet() {
  try {
    const health = await checkDbHealth()

    return NextResponse.json(
      {
        status: health.healthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        extensions: health.extensions,
        errors: health.errors,
      },
      {
        status: health.healthy ? 200 : 503,
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
