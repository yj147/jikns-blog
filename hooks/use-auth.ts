/**
 * 认证状态管理 Hook
 * 提供与 AuthProvider 同步的认证状态和操作方法
 */

"use client"

import { useAuth as useAuthProvider } from "@/app/providers/auth-provider"

export function useAuth() {
  return useAuthProvider()
}

/**
 * 导出所有认证相关的 Hook
 * 提供单一入口点
 */
export { useRequireAuth, useRequireAdmin } from "@/app/providers/auth-provider"
export * from "./use-permissions"
