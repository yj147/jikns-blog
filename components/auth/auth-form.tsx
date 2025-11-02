/**
 * 综合认证表单组件
 * 集成登录按钮、OAuth 状态处理和错误提示
 */

"use client"

import { Suspense } from "react"
import { LoginButton } from "./login-button"
import { OAuthStatusHandler } from "./oauth-handlers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface AuthFormProps {
  title?: string
  description?: string
  redirect?: string
  showEmailOption?: boolean
  showTitle?: boolean
}

export function AuthForm({
  title = "欢迎登录",
  description = "选择您偏好的登录方式",
  redirect = "/",
  showEmailOption = true,
  showTitle = true,
}: AuthFormProps) {
  return (
    <Card className="w-full max-w-md">
      {showTitle && (
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}

      <CardContent className="space-y-6">
        {/* OAuth 状态处理 */}
        <Suspense fallback={null}>
          <OAuthStatusHandler />
        </Suspense>

        {/* 登录选项 */}
        <div className="space-y-3">
          <Suspense fallback={<div>加载中...</div>}>
            <LoginButton redirect={redirect} showEmailOption={showEmailOption} />
          </Suspense>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 简化版认证按钮组
 * 用于导航栏等空间受限的场景
 */
export function CompactAuthButtons({
  redirect = "/",
  className = "",
}: {
  redirect?: string
  className?: string
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <Suspense fallback={null}>
        <LoginButton redirect={redirect} showEmailOption={false} size="sm" />
      </Suspense>
    </div>
  )
}

/**
 * 内联认证状态显示
 * 用于页面内的认证状态反馈
 */
export function InlineAuthStatus() {
  return (
    <Suspense fallback={null}>
      <OAuthStatusHandler />
    </Suspense>
  )
}
