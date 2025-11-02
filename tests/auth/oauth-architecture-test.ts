/**
 * OAuth 认证架构测试
 * 验证修正后的 OAuth 认证流程配置
 */

import { describe, it, expect, beforeAll } from "vitest"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

describe("OAuth 认证架构验证", () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  })

  it("应该能连接到 Supabase 认证服务", async () => {
    // 测试基本连接
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`)
    expect(response.ok).toBe(true)

    const settings = await response.json()
    expect(settings.external.github).toBe(true)
    expect(settings.external.email).toBe(true)
  })

  it("GitHub OAuth 配置应该正确", async () => {
    // 测试 GitHub OAuth URL 生成
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        queryParams: {
          test_mode: "true", // 防止实际重定向
        },
      },
    })

    expect(error).toBeNull()
    expect(data.url).toBeDefined()
    expect(data.url).toContain("github.com")
    expect(data.url).toContain("redirect_uri=http%3A//localhost%3A3000/auth/callback")
  })

  it("回调 URL 配置应该指向应用层而非 Supabase 内部", async () => {
    const { data } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: "http://localhost:3000/auth/callback?redirect_to=/dashboard",
      },
    })

    // 验证回调 URL 不包含 Supabase 内部路径
    expect(data.url).not.toContain("/auth/v1/callback")
    expect(data.url).toContain("redirect_uri=http%3A//localhost%3A3000/auth/callback")
  })

  it("Kong 网关路由配置应该正确", async () => {
    // 测试通过 Kong 网关访问认证端点
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`)
    expect(response.ok).toBe(true)
  })

  it("环境变量配置应该一致", () => {
    // 验证关键环境变量
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54321")
    expect(process.env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000")
    expect(process.env.GITHUB_CLIENT_ID).toBeDefined()
    expect(process.env.GITHUB_CLIENT_SECRET).toBeDefined()
  })
})

/**
 * 架构修正验证摘要：
 *
 * ✅ 修正项：
 * 1. OAuth 回调 URL: localhost:54321/auth/v1/callback → localhost:3000/auth/callback
 * 2. Kong 路由: /auth → /auth/v1 (更精确的路径匹配)
 * 3. Studio API URL: http://127.0.0.1 → http://127.0.0.1:54321
 *
 * 🔄 架构流程：
 * 1. 用户点击登录 → 应用 /api/auth/github
 * 2. 应用调用 Supabase Auth → Kong → Auth Service
 * 3. Auth Service 重定向到 GitHub OAuth
 * 4. GitHub 回调到 → 应用 /auth/callback (不是 Supabase 内部)
 * 5. 应用处理回调 → 交换 token → 建立会话
 *
 * 🎯 关键修正：
 * - 回调链路现在正确流向应用层进行处理
 * - Kong 路由不会拦截应用层的 /auth/callback
 * - OAuth 流程职责清晰分离
 */
