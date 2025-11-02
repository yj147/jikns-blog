/**
 * 用户登出 API
 * Phase 2: 处理用户登出，清理会话
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()

    // 获取当前会话用户信息（用于日志记录）
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()
    const userEmail = currentSession?.user?.email || "unknown"
    // 执行登出操作
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Supabase 登出失败:", {
        email: userEmail,
        error: error.message,
      })

      return NextResponse.json(
        {
          success: false,
          error: "logout_failed",
          message: "登出失败，请重试",
        },
        { status: 500 }
      )
    }
    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: "登出成功",
      },
      {
        status: 200,
        // 清理相关的认证 cookies
        headers: {
          "Set-Cookie": [
            "supabase-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict",
            "supabase.auth.token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict",
          ].join(", "),
        },
      }
    )
  } catch (error) {
    console.error("登出API异常:", error)

    return NextResponse.json(
      {
        success: false,
        error: "internal_server_error",
        message: "服务器内部错误，请稍后重试",
      },
      { status: 500 }
    )
  }
}

// 不支持的方法
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "method_not_allowed",
      message: "此端点仅支持 POST 请求",
    },
    { status: 405 }
  )
}
