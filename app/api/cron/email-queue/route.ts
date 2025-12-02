import { NextRequest, NextResponse } from "next/server"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { processEmailQueue } from "@/lib/cron/email-queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handler(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
  }

  const cronSecret = process.env.CRON_SECRET
  const cronSecretHeader = request.headers.get("x-cron-secret")
  const isVercelCron = Boolean(request.headers.get("x-vercel-cron"))
  const isAuthorized = isVercelCron || !cronSecret || cronSecretHeader === cronSecret

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processEmailQueue()
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process email queue",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export const POST = withApiResponseMetrics(handler)
