/**
 * 浏览器端 CSRF 令牌管理工具
 * 统一负责获取、缓存并为请求附加 X-CSRF-Token 头
 */

const CSRF_STORAGE_KEY = "csrf-token"
let inFlightRequest: Promise<string> | null = null

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
}

function readTokenFromStorage(): string | null {
  if (!isBrowser()) return null
  try {
    return window.sessionStorage.getItem(CSRF_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeTokenToStorage(token: string) {
  if (!isBrowser()) return
  try {
    window.sessionStorage.setItem(CSRF_STORAGE_KEY, token)
  } catch {
    // 忽略受限环境的写入错误
  }
}

async function requestTokenFromApi(): Promise<string> {
  if (!isBrowser()) {
    return ""
  }

  const response = await fetch("/api/csrf-token", {
    method: "GET",
    credentials: "include",
    headers: {
      accept: "application/json",
    },
  })

  if (!response.ok) {
    const statusText = response.statusText || "unknown"
    throw new Error(`获取 CSRF 令牌失败: ${response.status} ${statusText}`)
  }

  const data = await response.json().catch(() => null)
  const token = data?.token

  if (typeof token !== "string" || token.length === 0) {
    throw new Error("CSRF 响应缺少 token 字段")
  }

  writeTokenToStorage(token)
  return token
}

/**
 * 确保本地存在最新的 CSRF 令牌
 * 会优先返回 sessionStorage 中的缓存，必要时访问 /api/csrf-token
 */
export async function ensureCsrfToken(options?: { forceRefresh?: boolean }): Promise<string> {
  if (!isBrowser()) {
    return ""
  }

  if (!options?.forceRefresh) {
    const cached = readTokenFromStorage()
    if (cached) return cached
  } else {
    writeTokenToStorage("")
  }

  if (!inFlightRequest) {
    inFlightRequest = requestTokenFromApi().finally(() => {
      inFlightRequest = null
    })
  }

  return inFlightRequest
}

/**
 * 返回当前缓存的 CSRF 令牌（可能为空）
 */
export function getStoredCsrfToken(): string | null {
  return readTokenFromStorage()
}

/**
 * 构建带有 X-CSRF-Token 的请求头
 */
export function getCsrfHeaders(token?: string): HeadersInit {
  const resolvedToken = token ?? readTokenFromStorage()
  return resolvedToken ? { "X-CSRF-Token": resolvedToken } : {}
}

/**
 * 带 CSRF 令牌的 fetch 包装
 */
export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await ensureCsrfToken()

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? "include",
    headers: {
      ...init.headers,
      ...getCsrfHeaders(token),
    },
  })
}
