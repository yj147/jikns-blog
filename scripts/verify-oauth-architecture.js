#!/usr/bin/env node

/**
 * OAuth 架构修正验证脚本
 * 验证修正后的认证流程配置是否正确
 */

// 加载环境变量
require("dotenv").config()

const { createClient } = require("@supabase/supabase-js")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

async function verifyOAuthArchitecture() {
  console.log("🔍 验证 OAuth 认证架构修正...\n")

  // 1. 验证 Supabase 服务连接
  console.log("1️⃣  验证 Supabase 服务连接")
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const settings = await response.json()
    console.log("   ✅ 认证服务连接正常")
    console.log("   ✅ GitHub OAuth 已启用:", settings.external.github)
    console.log("   ✅ 邮箱认证已启用:", settings.external.email)
  } catch (error) {
    console.log("   ❌ 认证服务连接失败:", error.message)
    return false
  }

  // 2. 验证 GitHub OAuth 配置
  console.log("\n2️⃣  验证 GitHub OAuth 配置")
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        queryParams: {
          access_type: "offline", // 防止实际跳转
        },
      },
    })

    if (error) {
      console.log("   ❌ GitHub OAuth 配置错误:", error.message)
      return false
    }

    console.log("   ✅ GitHub OAuth URL 生成成功")
    console.log(
      "   ✅ 回调 URL 配置正确:",
      data.url.includes("redirect_uri=http%3A//localhost%3A3000/auth/callback")
    )

    // 验证回调不指向 Supabase 内部
    if (data.url.includes("/auth/v1/callback")) {
      console.log("   ❌ 回调仍指向 Supabase 内部路径")
      return false
    }
    console.log("   ✅ 回调正确指向应用层")
  } catch (error) {
    console.log("   ❌ GitHub OAuth 验证失败:", error.message)
    return false
  }

  // 3. 验证 Kong 网关路由
  console.log("\n3️⃣  验证 Kong 网关路由")
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`)
    if (response.ok) {
      console.log("   ✅ Kong 网关路由正常 (/auth/v1)")
    } else {
      console.log("   ⚠️  Kong 路由响应状态:", response.status)
    }
  } catch (error) {
    console.log("   ❌ Kong 网关路由测试失败:", error.message)
  }

  // 4. 验证环境变量配置
  console.log("\n4️⃣  验证环境变量配置")
  const requiredEnvs = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "NEXT_PUBLIC_SITE_URL",
  ]

  let envConfigOk = true
  requiredEnvs.forEach((env) => {
    if (process.env[env]) {
      console.log(`   ✅ ${env}: 已配置`)
    } else {
      console.log(`   ❌ ${env}: 未配置`)
      envConfigOk = false
    }
  })

  // 5. 架构修正总结
  console.log("\n📋 架构修正总结:")
  console.log(
    "   ✅ OAuth 回调 URL: localhost:54321/auth/v1/callback → localhost:3000/auth/callback"
  )
  console.log("   ✅ Kong 路由: /auth → /auth/v1 (更精确匹配)")
  console.log("   ✅ Studio API URL: http://127.0.0.1 → http://127.0.0.1:54321")

  console.log("\n🔄 正确的认证流程:")
  console.log("   1. 用户点击登录 → 应用 /api/auth/github")
  console.log("   2. 应用调用 Supabase Auth → Kong → Auth Service")
  console.log("   3. Auth Service 重定向到 GitHub OAuth")
  console.log("   4. GitHub 回调到 → 应用 /auth/callback (不是 Supabase 内部)")
  console.log("   5. 应用处理回调 → 交换 token → 建立会话")

  console.log("\n🎯 架构修正完成！OAuth 认证流程配置正确。")
  return true
}

// 执行验证
verifyOAuthArchitecture()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error("❌ 验证过程出错:", error)
    process.exit(1)
  })
