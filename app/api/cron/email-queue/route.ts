import { NextRequest, NextResponse } from "next/server"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { processEmailQueue } from "@/lib/cron/email-queue"
import { verifyCronSecret } from "@/lib/api/verify-cron-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handler(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
  }

  const authFailure = verifyCronSecret(request)
  if (authFailure) return authFailure

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
