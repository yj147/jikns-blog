/**
 * CSRF 令牌组件
 * Phase 4.1 安全性增强 - 为表单提供 CSRF 保护
 */

"use client"

import { useEffect, useState } from "react"
import { CSRFProtection } from "@/lib/security"

interface CSRFTokenProps {
  /**
   * 是否自动在表单中添加隐藏字段
   */
  hidden?: boolean
  /**
   * 自定义类名
   */
  className?: string
}

/**
 * CSRF 令牌组件
 * 用于在表单中添加 CSRF 保护
 */
export function CSRFToken({ hidden = true, className }: CSRFTokenProps) {
  const [token, setToken] = useState<string>("")

  useEffect(() => {
    // 生成并设置 CSRF 令牌
    const csrfToken = CSRFProtection.generateToken()
    setToken(csrfToken)

    // 设置到头部以供 fetch 请求使用
    if (typeof window !== "undefined") {
      // 保存到 sessionStorage 供其他组件使用
      sessionStorage.setItem("csrf-token", csrfToken)

      // 设置默认的 fetch 头部
      const originalFetch = window.fetch
      window.fetch = function (url, options = {}) {
        return originalFetch(url, {
          ...options,
          headers: {
            ...options.headers,
            "X-CSRF-Token": csrfToken,
          },
        })
      }
    }
  }, [])

  if (!token) {
    return null
  }

  if (hidden) {
    return <input type="hidden" name="csrf-token" value={token} className={className} />
  }

  return (
    <div className={`csrf-token ${className || ""}`} data-token={token}>
      CSRF Token: {token.substring(0, 8)}...
    </div>
  )
}

/**
 * 获取当前 CSRF 令牌的 Hook
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string>("")

  useEffect(() => {
    // 从 sessionStorage 获取令牌
    if (typeof window !== "undefined") {
      const storedToken = sessionStorage.getItem("csrf-token")
      if (storedToken) {
        setToken(storedToken)
      } else {
        // 生成新令牌
        const newToken = CSRFProtection.generateToken()
        sessionStorage.setItem("csrf-token", newToken)
        setToken(newToken)
      }
    }
  }, [])

  return token
}

/**
 * 获取包含 CSRF 令牌的请求头
 */
export function getCSRFHeaders(): HeadersInit {
  let token = ""

  if (typeof window !== "undefined") {
    token = sessionStorage.getItem("csrf-token") || ""
  }

  return {
    "X-CSRF-Token": token,
  }
}

/**
 * 增强的 fetch 函数，自动添加 CSRF 令牌
 */
export async function secureFetch(
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  const csrfHeaders = getCSRFHeaders()

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...csrfHeaders,
    },
  })
}
