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
  // - Preview: 优先使用“稳定域”（如 branch 的 `*-git-<ref>-*.vercel.app` 或自定义 preview 域）
  // - Production: 必须保持与当前请求同域，否则 PKCE verifier cookie 可能因跨域丢失导致登录失败
  let origin = requestOrigin

  if (process.env.VERCEL_ENV === "preview") {
    const requestHost = new URL(request.url).hostname
    // 如果当前就是分支稳定域（*-git-<ref>-*.vercel.app），不要用 NEXT_PUBLIC_SITE_URL 覆盖，
    // 否则会造成“跨分支跳域”，直接导致 Preview 复验不可控。
    if (requestHost.endsWith(".vercel.app") && requestHost.includes("-git-")) {
      origin = requestOrigin
    } else {
      const commitRef = process.env.VERCEL_GIT_COMMIT_REF?.trim() || null
      const commitRefSlug = commitRef ? toVercelSlug(commitRef) : null

      const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
        ? toOrigin(process.env.NEXT_PUBLIC_SITE_URL)
        : null
      if (siteOrigin && !isLocalOrigin(siteOrigin)) {
        const siteHost = new URL(siteOrigin).hostname
        if (
          // 如果 NEXT_PUBLIC_SITE_URL 指向某个分支稳定域（包含 -git-），必须匹配当前分支，否则会跨分支跳转
          !(commitRefSlug && siteHost.endsWith(".vercel.app") && siteHost.includes("-git-")) ||
          siteHost.includes(`-git-${commitRefSlug}-`)
        ) {
          origin = siteOrigin
        }
      }

      // 当用户用随机部署域（如 dpl_* 或 <project>-<hash>-<team>.vercel.app）访问时，
      // 尝试把 callback 归一化到当前分支稳定域（*-git-<ref>-*.vercel.app），提高 allowlist 命中率。
      if (origin === requestOrigin) {
        const derived = commitRefSlug
          ? deriveStableVercelBranchOrigin(requestHost, commitRefSlug)
          : null
        if (derived) {
          origin = derived
        }
      }
    }
  }

  return new URL(origin).origin
}

function isLocalOrigin(origin: string): boolean {
  return origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")
}

function toVercelSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
}

function deriveStableVercelBranchOrigin(hostname: string, commitRefSlug: string): string | null {
  if (!hostname.endsWith(".vercel.app")) return null

  const base = hostname.slice(0, -".vercel.app".length)
  if (base.includes("-git-")) return `https://${hostname}`

  const firstDash = base.indexOf("-")
  if (firstDash <= 0) return null

  const projectSlug = base.slice(0, firstDash)
  const remainder = base.slice(firstDash + 1)
  const remainderDash = remainder.indexOf("-")
  if (remainderDash <= 0) return null

  const tail = remainder.slice(remainderDash + 1)
  return `https://${projectSlug}-git-${commitRefSlug}-${tail}.vercel.app`
}
