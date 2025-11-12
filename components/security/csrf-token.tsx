/**
 * CSRF 令牌组件
 * Phase 4.1 安全性增强 - 为表单提供 CSRF 保护
 */

"use client"

import { useEffect, useState } from "react"
import {
  ensureCsrfToken,
  getStoredCsrfToken,
  getCsrfHeaders as buildCsrfHeaders,
  secureFetch as fetchWithCsrf,
} from "@/lib/security/csrf-client"

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
    let mounted = true

    ensureCsrfToken()
      .then((csrf) => {
        if (mounted) {
          setToken(csrf)
        }
      })
      .catch((error) => {
        console.error("CSRF 令牌初始化失败:", error)
      })

    return () => {
      mounted = false
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
    let mounted = true

    const existing = getStoredCsrfToken()
    if (existing) {
      setToken(existing)
      return
    }

    ensureCsrfToken()
      .then((csrf) => {
        if (mounted) setToken(csrf)
      })
      .catch((error) => {
        console.error("获取 CSRF 令牌失败:", error)
      })

    return () => {
      mounted = false
    }
  }, [])

  return token
}

/**
 * 获取包含 CSRF 令牌的请求头
 */
export const getCSRFHeaders = buildCsrfHeaders

/**
 * 增强的 fetch 函数，自动添加 CSRF 令牌
 */
export const secureFetch = fetchWithCsrf
