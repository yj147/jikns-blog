/**
 * 认证系统演示组件
 * 用于测试和演示认证功能
 */

"use client"

import { useState } from "react"
import { useAuth, usePermissions } from "@/hooks/use-auth"
import { useAuthToast } from "@/hooks/use-auth-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { LoginButton } from "./login-button"
import { ClientUserMenu } from "./client-user-menu"
import { AuthRequired } from "./auth-required"
import { ProtectedRoute } from "./protected-route"
import { User, Shield, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"

export function AuthDemo() {
  const { user, session, isLoading, isAdmin } = useAuth()
  const permissions = usePermissions()
  const authToast = useAuthToast()
  const [testingToast, setTestingToast] = useState(false)

  const testToasts = async () => {
    setTestingToast(true)

    // 测试各种 toast 类型
    authToast.info("测试信息", "这是一条信息提示")

    setTimeout(() => {
      authToast.success("测试成功", "这是一条成功提示")
    }, 1000)

    setTimeout(() => {
      authToast.warning("测试警告", "这是一条警告提示")
    }, 2000)

    setTimeout(() => {
      authToast.error("测试错误", "这是一条错误提示")
    }, 3000)

    setTimeout(() => {
      setTestingToast(false)
    }, 4000)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">认证系统演示</h1>
        <p className="text-muted-foreground">
          完整的前端认证系统，支持 GitHub OAuth 和邮箱密码登录
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 认证状态卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              认证状态
            </CardTitle>
            <CardDescription>当前用户的认证信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>加载中...</span>
              </div>
            ) : user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-600">已登录</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">邮箱：</span>
                    {session?.user?.email}
                  </div>
                  <div>
                    <span className="font-medium">姓名：</span>
                    {user.name || "未设置"}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">角色：</span>
                    <Badge variant={isAdmin ? "default" : "secondary"}>{user.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">状态：</span>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>
                      {user.status}
                    </Badge>
                  </div>
                </div>

                {/* 用户菜单演示 */}
                <div className="pt-2">
                  <p className="mb-2 text-sm font-medium">用户菜单：</p>
                  <ClientUserMenu />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-600">未登录</span>
                </div>

                <div className="pt-2">
                  <p className="mb-2 text-sm font-medium">登录选项：</p>
                  <LoginButton size="sm" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 权限系统卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              权限系统
            </CardTitle>
            <CardDescription>基于角色的权限管理</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <PermissionItem name="创建文章" granted={permissions.canCreatePost} />
              <PermissionItem name="管理用户" granted={permissions.canManageUsers} />
              <PermissionItem name="发表评论" granted={permissions.canComment} />
              <PermissionItem name="点赞互动" granted={permissions.canLike} />
              <PermissionItem name="关注用户" granted={permissions.canFollow} />
              <PermissionItem name="管理后台" granted={permissions.canAccessAdmin} />
            </div>
          </CardContent>
        </Card>

        {/* Toast 测试卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Toast 反馈
            </CardTitle>
            <CardDescription>用户反馈提示系统</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testToasts} disabled={testingToast} className="w-full">
              {testingToast ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  测试中...
                </>
              ) : (
                "测试 Toast 提示"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 路由保护演示 */}
        <Card>
          <CardHeader>
            <CardTitle>路由保护演示</CardTitle>
            <CardDescription>认证必需和权限检查</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">需要登录的内容：</p>
              <AuthRequired message="演示：需要登录才能查看" showFallback={true}>
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
                  ✅ 您已登录，可以查看此内容
                </div>
              </AuthRequired>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">需要管理员权限：</p>
              {isAdmin ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
                  ✅ 您是管理员，可以访问管理功能
                </div>
              ) : (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-100">
                  ⚠️ 需要管理员权限才能访问
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold">系统架构</h2>
        <p className="text-muted-foreground text-sm">
          基于 Next.js 15 + React 19 + Supabase Auth + Prisma ORM
        </p>
        <div className="text-muted-foreground flex justify-center gap-2 text-xs">
          <Badge variant="outline">GitHub OAuth</Badge>
          <Badge variant="outline">邮箱密码</Badge>
          <Badge variant="outline">权限管理</Badge>
          <Badge variant="outline">Toast 反馈</Badge>
          <Badge variant="outline">路由保护</Badge>
        </div>
      </div>
    </div>
  )
}

function PermissionItem({ name, granted }: { name: string; granted: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {granted ? (
        <CheckCircle className="h-3 w-3 text-green-600" />
      ) : (
        <XCircle className="h-3 w-3 text-red-400" />
      )}
      <span className={granted ? "text-green-600" : "text-muted-foreground"}>{name}</span>
    </div>
  )
}
