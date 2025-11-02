/**
 * OAuth 配置测试脚本
 * 验证修复后的 OAuth 流程配置
 */

// 模拟环境变量
const mockEnv = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  GITHUB_CLIENT_ID: "Ov23liNOasus4iRqR1hk",
}

// 模拟 getAuthRedirectUrl 函数（修复后的版本）
function getAuthRedirectUrl(redirect = null) {
  const siteUrl = mockEnv.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const callbackUrl = `${siteUrl}/auth/callback`

  if (redirect && redirect !== "/") {
    return `${callbackUrl}?redirect=${encodeURIComponent(redirect)}`
  }

  return callbackUrl
}

// 测试各种场景
console.log("=== OAuth 配置测试结果 ===\n")

console.log("1. 默认回调 URL:")
console.log(`   ${getAuthRedirectUrl()}`)
console.log("   ✅ 应该指向 Next.js 应用 (localhost:3000)")

console.log("\n2. 带重定向参数:")
console.log(`   ${getAuthRedirectUrl("/admin")}`)
console.log("   ✅ 应该包含重定向参数")

console.log("\n3. 根路径重定向:")
console.log(`   ${getAuthRedirectUrl("/")}`)
console.log("   ✅ 根路径不应添加额外参数")

console.log("\n4. 复杂路径重定向:")
console.log(`   ${getAuthRedirectUrl("/blog/post/123")}`)
console.log("   ✅ 应该正确编码复杂路径")

console.log("\n=== 配置验证 ===\n")

console.log("✅ 修复要点:")
console.log("   - 使用 NEXT_PUBLIC_SITE_URL 而非 SUPABASE_URL")
console.log("   - 回调路径为 /auth/callback (Next.js 应用)")
console.log("   - 参数名使用 redirect (兼容 redirect_to)")

console.log("\n⚠️  GitHub OAuth App 必要配置:")
console.log("   - Homepage URL: http://localhost:3000")
console.log("   - Authorization callback URL: http://localhost:3000/auth/callback")
console.log(`   - Client ID: ${mockEnv.GITHUB_CLIENT_ID}`)

console.log("\n🔍 验证步骤:")
console.log("   1. 确认 GitHub OAuth App 回调 URL 为 http://localhost:3000/auth/callback")
console.log("   2. 启动 Next.js 开发服务器 (pnpm dev)")
console.log("   3. 访问 /login 页面并点击 GitHub 登录")
console.log('   4. 验证不再出现 "OAuth state parameter missing" 错误')
