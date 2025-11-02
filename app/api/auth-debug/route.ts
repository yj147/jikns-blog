import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

/**
 * 认证调试端点
 * 用于检查环境变量配置、Supabase 连接状态和 GitHub OAuth 配置
 */
export async function GET(request: NextRequest) {
  const debug = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {} as Record<string, any>,
  }

  // 1. 检查环境变量配置
  debug.checks.environmentVariables = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ 已配置" : "❌ 缺失",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "✅ 已配置"
      : "❌ 缺失",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? "✅ 已配置" : "❌ 缺失",
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? "✅ 已配置" : "❌ 缺失",
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? "✅ 已配置" : "❌ 缺失",
    DATABASE_URL: process.env.DATABASE_URL ? "✅ 已配置" : "❌ 缺失",
  }

  // 2. 检查 Supabase 连接
  try {
    const supabase = createClient()

    // 尝试获取当前会话
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    debug.checks.supabaseConnection = {
      status: "✅ 连接成功",
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSession: sessionData.session ? "✅ 有会话" : "❌ 无会话",
      sessionError: sessionError?.message || "None",
    }

    // 3. 检查 GitHub OAuth 配置
    const githubOAuthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent("http://localhost:3000/api/auth/callback")}`

    debug.checks.githubOAuth = {
      configuredClientId: process.env.GITHUB_CLIENT_ID
        ? `✅ ${process.env.GITHUB_CLIENT_ID}`
        : "❌ 未配置",
      configuredSecret: process.env.GITHUB_CLIENT_SECRET ? "✅ 已配置 (隐藏)" : "❌ 未配置",
      authUrl: githubOAuthUrl,
      callbackUrl: "http://localhost:3000/api/auth/callback",
    }
  } catch (error) {
    debug.checks.supabaseConnection = {
      status: "❌ 连接失败",
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // 4. Supabase 服务状态检查
  try {
    const healthCheckUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/health`
    const response = await fetch(healthCheckUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    debug.checks.supabaseHealth = {
      status: response.ok ? "✅ 健康" : "❌ 不健康",
      statusCode: response.status,
      url: healthCheckUrl,
    }
  } catch (error) {
    debug.checks.supabaseHealth = {
      status: "❌ 无法访问",
      error: error instanceof Error ? error.message : String(error),
      suggestion: "请确保 Supabase 本地实例正在运行: supabase start",
    }
  }

  // 5. 配置建议
  const issues = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) issues.push("缺少 NEXT_PUBLIC_SUPABASE_URL")
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) issues.push("缺少 NEXT_PUBLIC_SUPABASE_ANON_KEY")
  if (!process.env.GITHUB_CLIENT_ID) issues.push("缺少 GITHUB_CLIENT_ID")
  if (!process.env.GITHUB_CLIENT_SECRET) issues.push("缺少 GITHUB_CLIENT_SECRET")

  debug.checks.recommendations =
    issues.length > 0
      ? {
          status: "⚠️ 需要修复",
          issues,
          solution: "请检查 .env 文件中的环境变量配置",
        }
      : {
          status: "✅ 配置完整",
          message: "所有必需的环境变量都已正确配置",
        }

  return NextResponse.json(debug, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  })
}
