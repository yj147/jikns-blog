/**
 * 认证相关 Toast Hook
 * 提供认证操作的用户反馈
 */

"use client"

import { useToast } from "./use-toast"
import { CheckCircle, AlertCircle, Info, XCircle } from "lucide-react"

export function useAuthToast() {
  const { toast } = useToast()

  const authToast = {
    // 登录成功
    loginSuccess: (userName?: string) => {
      toast({
        title: "登录成功",
        description: userName ? `欢迎回来，${userName}！` : "欢迎回来！",
        duration: 3000,
        className:
          "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
      })
    },

    // 登录失败
    loginError: (message: string) => {
      toast({
        title: "登录失败",
        description: message,
        duration: 5000,
        variant: "destructive",
      })
    },

    // 登出成功
    logoutSuccess: () => {
      toast({
        title: "已登出",
        description: "您已安全登出账户",
        duration: 2000,
        className:
          "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100",
      })
    },

    // 注册成功
    registerSuccess: () => {
      toast({
        title: "注册成功",
        description: "请检查您的邮箱以完成验证",
        duration: 5000,
        className:
          "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
      })
    },

    // 邮箱验证提醒
    emailVerificationRequired: () => {
      toast({
        title: "需要邮箱验证",
        description: "请检查您的邮箱并点击验证链接",
        duration: 6000,
        className:
          "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100",
      })
    },

    // 会话过期
    sessionExpired: () => {
      toast({
        title: "登录已过期",
        description: "请重新登录以继续使用",
        duration: 4000,
        variant: "destructive",
      })
    },

    // 权限不足
    permissionDenied: (action?: string) => {
      toast({
        title: "权限不足",
        description: action ? `您没有权限执行"${action}"操作` : "您没有权限访问此功能",
        duration: 4000,
        variant: "destructive",
      })
    },

    // OAuth 开始
    oauthStarted: (provider: string) => {
      toast({
        title: "正在跳转",
        description: `正在重定向到 ${provider} 进行登录...`,
        duration: 2000,
        className:
          "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100",
      })
    },

    // 账户被封禁
    accountBanned: () => {
      toast({
        title: "账户已被封禁",
        description: "您的账户已被管理员封禁，如有疑问请联系客服",
        duration: 6000,
        variant: "destructive",
      })
    },

    // 网络错误
    networkError: () => {
      toast({
        title: "网络连接错误",
        description: "请检查网络连接后重试",
        duration: 4000,
        variant: "destructive",
      })
    },

    // 密码重置邮件已发送
    passwordResetSent: () => {
      toast({
        title: "重置链接已发送",
        description: "请检查您的邮箱并点击重置链接",
        duration: 5000,
        className:
          "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
      })
    },

    // 资料更新成功
    profileUpdated: () => {
      toast({
        title: "资料已更新",
        description: "您的个人资料已成功更新",
        duration: 3000,
        className:
          "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
      })
    },

    // 通用成功消息
    success: (title: string, description?: string) => {
      toast({
        title,
        description,
        duration: 3000,
        className:
          "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100",
      })
    },

    // 通用错误消息
    error: (title: string, description?: string) => {
      toast({
        title,
        description,
        duration: 4000,
        variant: "destructive",
      })
    },

    // 通用警告消息
    warning: (title: string, description?: string) => {
      toast({
        title,
        description,
        duration: 4000,
        className:
          "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100",
      })
    },

    // 通用信息消息
    info: (title: string, description?: string) => {
      toast({
        title,
        description,
        duration: 3000,
        className:
          "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100",
      })
    },
  }

  return authToast
}
