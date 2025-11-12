/**
 * 增强的 Toast 通知系统
 * 提供统一的用户反馈机制，支持不同类型的通知
 */

import { toast } from "sonner"
import { logger } from "./utils/logger"

export type ToastType = "success" | "error" | "warning" | "info" | "loading"

interface ToastOptions {
  duration?: number
  description?: string
  action?: {
    label: string
    onClick: (event?: any) => void
  }
  cancel?: {
    label: string
    onClick?: (event?: any) => void
  }
}

class ToastManager {
  /**
   * 成功通知
   */
  success(message: string, options?: ToastOptions) {
    const toastOptions: any = {
      duration: options?.duration || 4000,
      description: options?.description,
    }

    if (options?.action) {
      toastOptions.action = options.action
    }

    if (options?.cancel) {
      toastOptions.cancel = options.cancel
    }

    return toast.success(message, toastOptions)
  }

  /**
   * 错误通知
   */
  error(message: string, options?: ToastOptions) {
    const toastOptions: any = {
      duration: options?.duration || 6000, // 错误信息显示更久
      description: options?.description,
    }

    if (options?.action) {
      toastOptions.action = options.action
    }

    if (options?.cancel) {
      toastOptions.cancel = options.cancel
    }

    return toast.error(message, toastOptions)
  }

  /**
   * 警告通知
   */
  warning(message: string, options?: ToastOptions) {
    const toastOptions: any = {
      duration: options?.duration || 5000,
      description: options?.description,
    }

    if (options?.action) {
      toastOptions.action = options.action
    }

    if (options?.cancel) {
      toastOptions.cancel = options.cancel
    }

    return toast.warning(message, toastOptions)
  }

  /**
   * 信息通知
   */
  info(message: string, options?: ToastOptions) {
    const toastOptions: any = {
      duration: options?.duration || 4000,
      description: options?.description,
    }

    if (options?.action) {
      toastOptions.action = options.action
    }

    if (options?.cancel) {
      toastOptions.cancel = options.cancel
    }

    return toast.info(message, toastOptions)
  }

  /**
   * 加载通知
   */
  loading(message: string, options?: Omit<ToastOptions, "duration">) {
    const toastOptions: any = {
      description: options?.description,
    }

    if (options?.action) {
      toastOptions.action = options.action
    }

    if (options?.cancel) {
      toastOptions.cancel = options.cancel
    }

    return toast.loading(message, toastOptions)
  }

  /**
   * 自定义通知
   */
  custom(component: React.ReactElement, options?: ToastOptions) {
    return toast.custom(() => component, {
      duration: options?.duration,
    })
  }

  /**
   * Promise 通知 - 自动处理异步操作的不同状态
   */
  promise<T>(
    promise: Promise<T>,
    {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) {
    return toast.promise(promise, {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
    })
  }

  /**
   * 关闭所有通知
   */
  dismiss() {
    toast.dismiss()
  }

  /**
   * 关闭特定通知
   */
  dismissById(id: string | number) {
    toast.dismiss(id)
  }
}

// 创建单例实例
const toastManager = new ToastManager()

// 导出便捷方法
export const showToast = toastManager
export const toast_ = toastManager // 避免与 sonner 的 toast 冲突

// 预定义的常用通知方法
export const notifications = {
  // 用户操作反馈
  saveSuccess: (item = "内容") =>
    toastManager.success(`${item}保存成功`, {
      description: "您的更改已成功保存",
    }),

  saveError: (error?: string) =>
    toastManager.error("保存失败", {
      description: error || "请检查网络连接或稍后重试",
      action: {
        label: "重试",
        onClick: () => window.location.reload(),
      },
    }),

  deleteSuccess: (item = "项目") =>
    toastManager.success(`${item}删除成功`, {
      description: "操作已完成",
    }),

  deleteError: (error?: string) =>
    toastManager.error("删除失败", {
      description: error || "无法完成删除操作",
    }),

  // 网络相关
  networkError: () =>
    toastManager.error("网络连接失败", {
      description: "请检查您的网络连接",
      action: {
        label: "重试",
        onClick: () => window.location.reload(),
      },
    }),

  // 权限相关
  permissionDenied: () =>
    toastManager.error("权限不足", {
      description: "您没有执行此操作的权限",
    }),

  loginRequired: () =>
    toastManager.warning("需要登录", {
      description: "请先登录后再继续操作",
      action: {
        label: "登录",
        onClick: () => (window.location.href = "/login"),
      },
    }),

  // 上传相关
  uploadSuccess: () =>
    toastManager.success("上传成功", {
      description: "文件已成功上传",
    }),

  uploadError: (error?: string) =>
    toastManager.error("上传失败", {
      description: error || "文件上传过程中出现错误",
    }),

  uploadProgress: (fileName: string) => toastManager.loading(`正在上传: ${fileName}`),

  // 表单验证
  validationError: (message: string) =>
    toastManager.warning("输入有误", {
      description: message,
    }),

  // 系统通知
  maintenanceMode: () =>
    toastManager.warning("系统维护中", {
      description: "部分功能可能暂时不可用",
      duration: 8000,
    }),

  updateAvailable: () =>
    toastManager.info("有新版本可用", {
      description: "刷新页面获取最新功能",
      action: {
        label: "立即刷新",
        onClick: () => window.location.reload(),
      },
    }),
}

// API错误处理辅助函数
export function handleApiError(error: any, context?: string) {
  logger.error("API Error", { context }, error)

  if (error.code) {
    switch (error.code) {
      case "NETWORK_ERROR":
        notifications.networkError()
        break
      case "PERMISSION_DENIED":
      case "AUTH_INSUFFICIENT_PERMISSIONS":
        notifications.permissionDenied()
        break
      case "AUTH_REQUIRED":
        notifications.loginRequired()
        break
      default:
        toastManager.error(error.message || "操作失败", {
          description: context ? `${context}时出现错误` : undefined,
        })
    }
  } else {
    toastManager.error("操作失败", {
      description: error.message || "未知错误",
    })
  }
}

export default toastManager
