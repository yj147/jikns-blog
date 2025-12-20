import { NextRequest, NextResponse } from "next/server"
import { securityLogger } from "@/lib/utils/logger"

export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    securityLogger.security("CRON_SECRET_MISSING", "critical", {
      path: request.nextUrl?.pathname ?? request.url,
      method: request.method,
      hasAuthHeader: Boolean(request.headers.get("authorization")),
    })

    return NextResponse.json({ error: "Cron secret is not configured" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
  const token = tokenMatch?.[1] ?? null

  if (token !== cronSecret) {
    securityLogger.security("CRON_SECRET_INVALID", "high", {
      path: request.nextUrl?.pathname ?? request.url,
      method: request.method,
      hasAuthHeader: Boolean(authHeader),
      userAgent: request.headers.get("user-agent") ?? undefined,
    })

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
