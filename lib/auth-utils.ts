/**
 * 认证相关的工具函数
 * 解决 Cursor 端口随机化导致的 OAuth 回调问题
 */

/**
 * 获取当前运行时的完整站点 URL
 * 优先使用 Supabase 网关端口以解决端口随机化问题
 * @returns 当前站点的完整 URL
 */
export function getCurrentSiteUrl(): string {
  // 生产环境使用实际域名
  if (process.env.NODE_ENV === "production") {
    return process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com"
  }

  // 开发环境：优先使用 Supabase 网关端口
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    return supabaseUrl // http://127.0.0.1:54321
  }

  // 浏览器环境：让用户看到当前 Next.js 端口，但 OAuth 回调仍走网关
  if (typeof window !== "undefined") {
    return window.location.origin
  }

  // 最后回退值
  return "http://127.0.0.1:3999"
}

/**
 * 生成 OAuth 认证的回调 URL
 * 开发环境固定使用 Supabase 网关端口，确保回调稳定
 * @param callbackPath 回调路径，默认为 '/auth/callback'
 * @returns 完整的回调 URL
 */
export function getAuthCallbackUrl(callbackPath: string = "/auth/callback"): string {
  // 开发环境：强制使用 Supabase 网关端口处理回调
  if (process.env.NODE_ENV !== "production") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      return `${supabaseUrl}${callbackPath}`
    }
  }

  // 生产环境：使用实际站点URL
  const siteUrl = getCurrentSiteUrl()
  return `${siteUrl}${callbackPath}`
}

/**
 * 生成用于 Supabase OAuth 的配置选项
 * 包含动态回调 URL 和其他必要的配置
 * @param provider OAuth 提供商（如 'github'）
 * @param callbackPath 自定义回调路径
 * @returns Supabase OAuth 配置对象
 */
export function getOAuthConfig(provider: "github" | "google" | string, callbackPath?: string) {
  return {
    provider,
    options: {
      redirectTo: getAuthCallbackUrl(callbackPath),
      // 添加其他必要的配置
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  } as const
}
