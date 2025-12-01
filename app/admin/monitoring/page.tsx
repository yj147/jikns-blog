/**
 * 系统监控页面
 * 管理员可以查看系统健康状态、性能指标和审计日志
 */

"use client"

import * as React from "react"
import { MonitoringDashboard } from "@/components/admin/monitoring-dashboard"
// import { useEnhancedAuth } from '@/hooks/use-enhanced-auth' // 暂时禁用
import { useAuth } from "@/app/providers/auth-provider"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export default function MonitoringPage() {
  const { user, isLoading } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  const [authChecked, setAuthChecked] = React.useState(false)

  React.useEffect(() => {
    const checkAuth = async () => {
      setAuthChecked(true)

      if (!isAdmin) {
        // 非管理员用户，需要重定向
        window.location.href = "/unauthorized"
        return
      }
    }

    if (!isLoading) {
      checkAuth()
    }
  }, [isLoading, isAdmin])

  if (isLoading || !authChecked) {
    return (
      <div className="flex justify-center py-12">
        <LoadingIndicator variant="spinner" size="lg" message="验证权限中..." />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-xl">
          <CardContent className="p-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h2 className="mb-2 text-xl font-semibold text-red-600 dark:text-red-400">
                访问被拒绝
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                您没有访问此页面的权限。此页面仅限管理员访问。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">监控中心</h1>
        <p className="text-muted-foreground">实时洞察系统健康、性能与审计事件</p>
      </div>
      <MonitoringDashboard />
    </section>
  )
}
