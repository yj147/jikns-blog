/**
 * 错误处理系统演示页面
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertTriangle,
  Wifi,
  Shield,
  RefreshCw,
  Bug,
  Network,
  Lock,
  FileText,
  Activity,
} from "lucide-react"
import { ErrorBoundary, ErrorFactory } from "@/lib/error-handling"
import {
  SecurityProvider as SecurityCtxProvider,
  useSecurity,
  useSecurityEvents,
  SecurityStatus,
  SecurityAlert,
  SecurityDialog,
} from "@/components/security"
import { ErrorType, SecurityErrorType, NetworkErrorType, BusinessErrorType } from "@/types/error"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { useRetry } from "@/hooks/use-retry"
import { useSecurityState } from "@/hooks/use-security-state"
import { toast } from "@/hooks/use-toast"

// 故意失败的组件
function FaultyComponent({ shouldFail }: { shouldFail: boolean }) {
  if (shouldFail) {
    throw new Error("组件故意失败用于测试错误边界")
  }
  return <div className="text-green-600">组件正常运行</div>
}

function ErrorHandlingDemo() {
  const [componentError, setComponentError] = useState(false)
  const [showSecurityDialog, setShowSecurityDialog] = useState(false)
  const [dialogType, setDialogType] = useState<"confirm" | "reauth" | "warning" | "info">("info")

  const {
    handleError,
    handleSecurityError,
    handleNetworkError,
    handleBusinessError,
    currentError,
    isHandling,
  } = useErrorHandler()
  const { retry, isRetrying, retryCount, canRetry, lastError } = useRetry({
    maxRetries: 3,
    baseDelay: 1000,
    showToast: true,
  })
  const { securityEvents, clearSecurityEvents } = useSecurityEvents()
  const securityState = useSecurityState()

  // 模拟各种错误类型
  const simulateErrors = {
    // 安全错误
    sessionExpired: () => {
      handleSecurityError(SecurityErrorType.SESSION_EXPIRED, "您的会话已过期，请重新登录")
    },

    csrfFailed: () => {
      handleSecurityError(SecurityErrorType.CSRF_FAILED, "CSRF 令牌验证失败，请刷新页面")
    },

    insufficientPermissions: () => {
      handleSecurityError(SecurityErrorType.INSUFFICIENT_PERMISSIONS, "您没有权限执行此操作")
    },

    // 网络错误
    connectionFailed: () => {
      handleNetworkError(NetworkErrorType.CONNECTION_FAILED, "网络连接失败，请检查网络")
    },

    timeout: () => {
      handleNetworkError(NetworkErrorType.TIMEOUT, "请求超时，请稍后重试")
    },

    serverError: () => {
      handleNetworkError(NetworkErrorType.SERVER_ERROR, "服务器内部错误")
    },

    // 业务错误
    validationFailed: () => {
      handleBusinessError(BusinessErrorType.VALIDATION_FAILED, "表单验证失败，请检查输入")
    },

    resourceNotFound: () => {
      handleBusinessError(BusinessErrorType.RESOURCE_NOT_FOUND, "请求的资源不存在")
    },

    // JavaScript 错误
    jsError: () => {
      handleError(new TypeError("未定义的属性访问"))
    },

    // 字符串错误
    stringError: () => {
      handleError("简单的字符串错误消息")
    },
  }

  // 模拟重试操作
  const simulateRetryOperation = async () => {
    let attemptCount = 0

    await retry(async () => {
      attemptCount++

      // 前两次尝试失败，第三次成功
      if (attemptCount < 3) {
        throw new Error(`第 ${attemptCount} 次尝试失败`)
      }

      toast({
        title: "操作成功",
        description: `经过 ${attemptCount} 次尝试后成功`,
        variant: "default",
      })

      return "成功结果"
    })
  }

  const openSecurityDialog = (type: typeof dialogType) => {
    setDialogType(type)
    setShowSecurityDialog(true)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">错误处理系统演示</h1>
        <p className="text-muted-foreground">Phase 5: 前端错误处理与用户体验优化</p>
      </div>

      {/* 安全状态显示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>安全状态</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <SecurityStatus
              variant="detailed"
              showNetworkStatus={true}
              showSessionInfo={true}
              showPermissions={true}
            />
            <Button
              variant="outline"
              onClick={clearSecurityEvents}
              disabled={securityEvents.length === 0}
            >
              清除事件 ({securityEvents.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="errors" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="errors">错误模拟</TabsTrigger>
          <TabsTrigger value="retry">重试演示</TabsTrigger>
          <TabsTrigger value="boundary">错误边界</TabsTrigger>
          <TabsTrigger value="security">安全对话</TabsTrigger>
        </TabsList>

        {/* 错误模拟 */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 安全错误 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-4 w-4" />
                  <span>安全错误</span>
                </CardTitle>
                <CardDescription>模拟各种安全相关错误</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={simulateErrors.sessionExpired}
                  className="w-full"
                >
                  会话过期
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={simulateErrors.csrfFailed}
                  className="w-full"
                >
                  CSRF 失败
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={simulateErrors.insufficientPermissions}
                  className="w-full"
                >
                  权限不足
                </Button>
              </CardContent>
            </Card>

            {/* 网络错误 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Network className="h-4 w-4" />
                  <span>网络错误</span>
                </CardTitle>
                <CardDescription>模拟网络连接相关错误</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateErrors.connectionFailed}
                  className="w-full"
                >
                  连接失败
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateErrors.timeout}
                  className="w-full"
                >
                  请求超时
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateErrors.serverError}
                  className="w-full"
                >
                  服务器错误
                </Button>
              </CardContent>
            </Card>

            {/* 业务错误 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>业务错误</span>
                </CardTitle>
                <CardDescription>模拟业务逻辑相关错误</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={simulateErrors.validationFailed}
                  className="w-full"
                >
                  验证失败
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={simulateErrors.resourceNotFound}
                  className="w-full"
                >
                  资源不存在
                </Button>
              </CardContent>
            </Card>

            {/* 系统错误 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bug className="h-4 w-4" />
                  <span>系统错误</span>
                </CardTitle>
                <CardDescription>模拟 JavaScript 和系统错误</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateErrors.jsError}
                  className="w-full"
                >
                  JavaScript 错误
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={simulateErrors.stringError}
                  className="w-full"
                >
                  字符串错误
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 当前错误状态 */}
          {currentError && (
            <Card>
              <CardHeader>
                <CardTitle>当前错误</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="destructive">{currentError.type}</Badge>
                    {currentError.subType && (
                      <Badge variant="outline">{currentError.subType}</Badge>
                    )}
                    <Badge
                      variant={currentError.severity === "critical" ? "destructive" : "secondary"}
                    >
                      {currentError.severity}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{currentError.userMessage}</p>
                  <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                    <span>可恢复: {currentError.recoverable ? "是" : "否"}</span>
                    <span>可重试: {currentError.retryable ? "是" : "否"}</span>
                    <span>时间: {new Date(currentError.timestamp).toLocaleTimeString("zh-CN", { hour12: false })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 重试演示 */}
        <TabsContent value="retry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>重试机制演示</span>
              </CardTitle>
              <CardDescription>模拟操作失败后的自动重试流程</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">模拟一个前两次失败，第三次成功的操作</p>
                  <div className="text-muted-foreground mt-1 flex items-center space-x-2 text-xs">
                    <span>重试次数: {retryCount}</span>
                    <span>是否重试中: {isRetrying ? "是" : "否"}</span>
                    <span>可继续重试: {canRetry ? "是" : "否"}</span>
                  </div>
                </div>
                <Button
                  onClick={simulateRetryOperation}
                  disabled={isRetrying}
                  className="flex items-center space-x-1"
                >
                  {isRetrying ? (
                    <>
                      <Activity className="h-4 w-4 animate-spin" />
                      <span>重试中...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>开始测试</span>
                    </>
                  )}
                </Button>
              </div>

              {lastError && (
                <div className="bg-destructive/10 rounded-md p-3">
                  <p className="text-destructive text-sm">最后一次错误: {lastError.message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 错误边界 */}
        <TabsContent value="boundary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>错误边界演示</CardTitle>
              <CardDescription>测试 React 错误边界捕获组件错误</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant={componentError ? "destructive" : "outline"}
                  onClick={() => setComponentError(!componentError)}
                >
                  {componentError ? "恢复组件" : "触发组件错误"}
                </Button>
              </div>

              <div className="rounded-md border p-4">
                <ErrorBoundary
                  enableRetry={true}
                  maxRetries={3}
                  showErrorDetails={true}
                  isolationLevel="component"
                >
                  <FaultyComponent shouldFail={componentError} />
                </ErrorBoundary>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 安全对话 */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>安全对话框演示</CardTitle>
              <CardDescription>测试各种安全相关的用户交互对话框</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => openSecurityDialog("info")}>
                  信息对话框
                </Button>
                <Button variant="outline" onClick={() => openSecurityDialog("warning")}>
                  警告对话框
                </Button>
                <Button variant="outline" onClick={() => openSecurityDialog("confirm")}>
                  确认对话框
                </Button>
                <Button variant="outline" onClick={() => openSecurityDialog("reauth")}>
                  重新认证
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 安全事件列表 */}
      {securityEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>安全事件</span>
                <Badge variant="secondary">{securityEvents.length}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSecurityEvents}>
                清除全部
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-60">
              <div className="space-y-2">
                {securityEvents.map((event) => (
                  <SecurityAlert
                    key={event.id}
                    event={event}
                    variant="compact"
                    showActions={false}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 安全对话框 */}
      <SecurityDialog
        open={showSecurityDialog}
        onOpenChange={setShowSecurityDialog}
        type={dialogType}
        title={
          dialogType === "info"
            ? "系统信息"
            : dialogType === "warning"
              ? "安全警告"
              : dialogType === "confirm"
                ? "操作确认"
                : "重新认证"
        }
        description={
          dialogType === "info"
            ? "这是一个系统信息对话框的演示。"
            : dialogType === "warning"
              ? "警告：您即将执行一个可能具有风险的操作。"
              : dialogType === "confirm"
                ? "请确认您要执行此操作。该操作不可撤销。"
                : "出于安全考虑，请重新输入您的凭据。"
        }
        severity={dialogType === "warning" || dialogType === "confirm" ? "high" : "low"}
        requiresPassword={dialogType === "reauth"}
        requiresConfirmation={dialogType === "confirm"}
        confirmationText={dialogType === "confirm" ? "DELETE" : undefined}
        onConfirm={() => {
          toast({
            title: "操作确认",
            description: `${dialogType} 对话框操作已确认`,
            variant: "default",
          })
        }}
        showSecurityInfo={true}
      />
    </div>
  )
}

export default function ErrorHandlingDemoPage() {
  return (
    <SecurityCtxProvider>
      <ErrorHandlingDemo />
    </SecurityCtxProvider>
  )
}
