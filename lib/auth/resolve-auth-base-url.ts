import { NextRequest } from "next/server"

function toOrigin(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? new URL(trimmed)
        : new URL(`https://${trimmed}`)
    return url.origin
  } catch {
    return null
  }
}

export function resolveAuthBaseUrl(request: NextRequest): string {
  const requestOrigin = new URL(request.url).origin

  // OAuth callback 必须落回 Supabase allowlist 允许的域名。
  // - Preview: 通过 VERCEL_URL 固定到“分支稳定域”，避免访问 dpl_* 域导致回调不在 allowlist
  // - Production: 站点对外可能是 www 域，但 Supabase Site URL 常配根域（无 www），需归一化
  let origin = requestOrigin

  if (process.env.VERCEL_ENV === "preview") {
    const vercelOrigin = process.env.VERCEL_URL ? toOrigin(process.env.VERCEL_URL) : null
    if (vercelOrigin) {
      origin = vercelOrigin
    } else {
      const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
        ? toOrigin(process.env.NEXT_PUBLIC_SITE_URL)
        : null
      if (
        siteOrigin &&
        !siteOrigin.startsWith("http://localhost") &&
        !siteOrigin.startsWith("http://127.0.0.1")
      ) {
        origin = siteOrigin
      }
    }
  }

  const url = new URL(origin)
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4)
  }
  return url.origin
}
