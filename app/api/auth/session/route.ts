/**
 * 获取当前登录会话（用于客户端同步 Supabase 状态）
 * 通过服务端读取 Cookie 返回 access/refresh token，客户端再调用 supabase.auth.setSession
 */

import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { authLogger } from "@/lib/utils/logger"

async function handleGet() {
  try {
    const supabase = await createRouteHandlerClient()
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json(
        { success: false, error: "unauthenticated", message: "未登录或会话已失效" },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    authLogger.error("获取会话失败", { module: "api/auth/session" }, error)
    return NextResponse.json(
      { success: false, error: "internal_error", message: "无法获取会话" },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
