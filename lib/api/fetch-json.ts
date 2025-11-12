import { ensureCsrfToken, getCsrfHeaders } from "@/lib/security/csrf-client"

/**
 * 统一的 JSON fetcher 工具
 * 封装响应解析与错误处理
 */

export interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

export interface ErrorResponse {
  error: string
  message?: string
  statusCode?: number
}

export class FetchError extends Error {
  statusCode: number
  response?: ErrorResponse

  constructor(message: string, statusCode: number, response?: ErrorResponse) {
    super(message)
    this.name = "FetchError"
    this.statusCode = statusCode
    this.response = response
  }
}

// 错误码到用户文案的映射
const ERROR_MESSAGES: Record<number, string> = {
  400: "参数错误",
  401: "请先登录",
  403: "权限不足或账号异常",
  404: "未找到相关内容",
  429: "操作过于频繁，请稍后再试",
  500: "服务器错误，请稍后重试",
}

/** 
 * 统一的 fetch 封装
 */
export async function fetchJson<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options

  // 构建 URL 参数
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url = `${url}${url.includes("?") ? "&" : "?"}${queryString}`
    }
  }

  const method = (fetchOptions.method || "GET").toUpperCase()
  let headers: HeadersInit = {
    "Content-Type": "application/json",
    ...fetchOptions.headers,
  }

  if (method !== "GET") {
    const csrf = await ensureCsrfToken()
    headers = {
      ...headers,
      ...getCsrfHeaders(csrf),
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "same-origin", // 确保携带 cookies
    })

    // 尝试解析 JSON 响应
    let data: any
    const contentType = response.headers.get("content-type")
    if (contentType?.includes("application/json")) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // 处理错误响应
    if (!response.ok) {
      // 后端统一使用 unified-response.ts，优先使用 error.message
      const errorMessage =
        (typeof data === "object" && data?.error?.message) ||
        ERROR_MESSAGES[response.status] ||
        `请求失败 (${response.status})`

      throw new FetchError(
        errorMessage,
        response.status,
        typeof data === "object" ? data : { error: errorMessage }
      )
    }

    return data
  } catch (error) {
    // 处理网络错误或其他异常
    if (error instanceof FetchError) {
      throw error
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new FetchError("网络连接失败，请检查网络", 0)
    }

    throw new FetchError(error instanceof Error ? error.message : "未知错误", 0)
  }
}

/**
 * GET 请求快捷方法
 */
export function fetchGet<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  return fetchJson<T>(url, { method: "GET", params })
}

/**
 * POST 请求快捷方法
 */
export function fetchPost<T = any>(
  url: string,
  body?: any,
  params?: Record<string, any>
): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    params,
  })
}

/**
 * DELETE 请求快捷方法
 */
export function fetchDelete<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  return fetchJson<T>(url, { method: "DELETE", params })
}
