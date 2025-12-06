"use client"

/**
 * 简化版 Toast Hook
 * Phase 4.1 安全性增强 - 支持安全错误处理
 * Updated: Migrated to Sonner backend while keeping API compatibility
 */

import { toast as sonnerToast } from "sonner"
import { ErrorHandler } from "@/lib/error-handler"
import type { ReactNode } from "react"

type ToastProps = {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  variant?: "default" | "destructive" | "success"
  duration?: number
  [key: string]: any
}

function toast({ title, description, variant, action, ...props }: ToastProps) {
  const options = {
    description,
    action: action as any,
    ...props,
  }

  if (variant === "destructive") {
    return sonnerToast.error(title, options)
  }

  if (variant === "success") {
    return sonnerToast.success(title, options)
  }

  return sonnerToast(title, options)
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    toasts: [], // Compatibility stub

    // 安全相关的便捷方法
    success: (message: string) =>
      sonnerToast.success("操作成功", {
        description: message,
      }),

    error: (message: string) =>
      sonnerToast.error("操作失败", {
        description: message,
      }),

    warning: (message: string) =>
      sonnerToast.warning("警告", {
        description: message,
      }),

    info: (message: string) =>
      sonnerToast.info("提示", {
        description: message,
      }),

    handleAuthError: async (error: any) => {
      const errorInfo = await ErrorHandler.handleError(error)

      return sonnerToast.error("认证错误", {
        description: ErrorHandler.getUserFriendlyMessage(errorInfo),
        duration: 8000,
      })
    },
  }
}

export { useToast, toast }

// 导出别名以保持兼容性
export const useEnhancedToast = useToast
