/**
 * 安全确认对话框 - 高风险操作确认和安全警告
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Key,
  Clock,
  User,
  Activity,
} from "lucide-react"
import { useSecurity } from "./security-provider"
import { cn } from "@/lib/utils"

interface SecurityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "confirm" | "reauth" | "warning" | "info"
  title: string
  description: string
  severity?: "low" | "medium" | "high" | "critical"
  requiresConfirmation?: boolean
  requiresPassword?: boolean
  requiresCheckbox?: boolean
  confirmationText?: string
  checkboxText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  showSecurityInfo?: boolean
  autoCloseDelay?: number // 自动关闭延迟（毫秒）
  preventAutoClose?: boolean
}

export function SecurityDialog({
  open,
  onOpenChange,
  type,
  title,
  description,
  severity = "medium",
  requiresConfirmation = false,
  requiresPassword = false,
  requiresCheckbox = false,
  confirmationText = "",
  checkboxText = "我理解并同意执行此操作",
  onConfirm,
  onCancel,
  showSecurityInfo = true,
  autoCloseDelay,
  preventAutoClose = false,
}: SecurityDialogProps) {
  const { securityState } = useSecurity()
  const [isProcessing, setIsProcessing] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmationInput, setConfirmationInput] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  // 自动关闭倒计时
  useEffect(() => {
    if (!open || !autoCloseDelay || preventAutoClose) return

    setTimeRemaining(autoCloseDelay)

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1000) {
          clearInterval(interval)
          onOpenChange(false)
          return null
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open, autoCloseDelay, preventAutoClose, onOpenChange])

  // 重置表单状态
  useEffect(() => {
    if (open) {
      setPassword("")
      setConfirmationInput("")
      setIsChecked(false)
      setIsProcessing(false)
      setTimeRemaining(null)
    }
  }, [open])

  const getSeverityIcon = () => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-5 w-5 text-red-600" />
      case "high":
        return <ShieldAlert className="h-5 w-5 text-red-500" />
      case "medium":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "low":
      default:
        return <Shield className="h-5 w-5 text-blue-500" />
    }
  }

  const getSeverityBadge = () => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">非常危险</Badge>
      case "high":
        return <Badge variant="destructive">高危险</Badge>
      case "medium":
        return <Badge variant="secondary">中等风险</Badge>
      case "low":
      default:
        return <Badge variant="outline">低风险</Badge>
    }
  }

  const canConfirm = () => {
    if (requiresPassword && !password) return false
    if (requiresConfirmation && confirmationInput !== confirmationText) return false
    if (requiresCheckbox && !isChecked) return false
    return true
  }

  const handleConfirm = async () => {
    if (!canConfirm() || isProcessing) return

    setIsProcessing(true)
    try {
      if (onConfirm) {
        await onConfirm()
      }
      onOpenChange(false)
    } catch (error) {
      console.error("确认操作失败:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onOpenChange(false)
  }

  const formatTimeRemaining = () => {
    if (timeRemaining === null) return ""
    const seconds = Math.ceil(timeRemaining / 1000)
    return `${seconds}秒后自动关闭`
  }

  // 信息类型对话框（仅显示信息）
  if (type === "info") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {getSeverityIcon()}
              <span>{title}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <DialogDescription className="text-base">{description}</DialogDescription>

            {showSecurityInfo && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">当前用户</Label>
                    <div className="mt-1 flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{securityState.role === "ADMIN" ? "管理员" : "用户"}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">安全级别</Label>
                    <div className="mt-1">{getSeverityBadge()}</div>
                  </div>
                </div>
              </>
            )}

            {timeRemaining !== null && (
              <div className="text-muted-foreground flex items-center justify-center text-sm">
                <Clock className="mr-1 h-4 w-4" />
                {formatTimeRemaining()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // 警告类型对话框
  if (type === "warning") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              {getSeverityIcon()}
              <span>{title}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">{description}</AlertDialogDescription>
          </AlertDialogHeader>

          {(showSecurityInfo || timeRemaining !== null) && (
            <div className="space-y-3">
              {showSecurityInfo && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">安全级别</Label>
                      <div className="mt-1">{getSeverityBadge()}</div>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">会话状态</Label>
                      <div className="mt-1 flex items-center space-x-1">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        <span>{securityState.sessionValid ? "有效" : "已过期"}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {timeRemaining !== null && (
                <div className="text-muted-foreground flex items-center justify-center text-sm">
                  <Clock className="mr-1 h-4 w-4" />
                  {formatTimeRemaining()}
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={!canConfirm() || isProcessing}
              className={cn(
                severity === "critical" && "bg-red-600 hover:bg-red-700",
                severity === "high" && "bg-red-500 hover:bg-red-600"
              )}
            >
              {isProcessing ? "处理中..." : "继续"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // 确认和重新认证类型对话框
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {getSeverityIcon()}
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-base">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 安全信息 */}
          {showSecurityInfo && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">安全级别</Label>
                    <div className="mt-1">{getSeverityBadge()}</div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">当前用户</Label>
                    <div className="mt-1 flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{securityState.role === "ADMIN" ? "管理员" : "用户"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">会话状态</span>
                  <div className="flex items-center space-x-1">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span>{securityState.sessionValid ? "有效" : "已过期"}</span>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* 密码输入 */}
          {requiresPassword && (
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center space-x-1">
                <Key className="h-4 w-4" />
                <span>请输入密码确认身份</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入您的登录密码"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* 确认文本输入 */}
          {requiresConfirmation && confirmationText && (
            <div className="space-y-2">
              <Label htmlFor="confirmation" className="text-sm">
                请输入 <code className="bg-muted rounded px-1">{confirmationText}</code> 以确认操作
              </Label>
              <Input
                id="confirmation"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={confirmationText}
                className={cn(
                  "font-mono",
                  confirmationInput && confirmationInput !== confirmationText && "border-red-500"
                )}
              />
              {confirmationInput && confirmationInput !== confirmationText && (
                <p className="text-sm text-red-600">输入不匹配，请重新输入</p>
              )}
            </div>
          )}

          {/* 确认复选框 */}
          {requiresCheckbox && (
            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirmation-checkbox"
                checked={isChecked}
                onCheckedChange={(checked) => setIsChecked(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="confirmation-checkbox" className="text-sm leading-5">
                {checkboxText}
              </Label>
            </div>
          )}

          {/* 自动关闭倒计时 */}
          {timeRemaining !== null && (
            <div className="text-muted-foreground flex items-center justify-center text-sm">
              <Clock className="mr-1 h-4 w-4" />
              {formatTimeRemaining()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm() || isProcessing}
            className={cn(
              severity === "critical" && "bg-red-600 hover:bg-red-700",
              severity === "high" && "bg-red-500 hover:bg-red-600"
            )}
          >
            {isProcessing ? (
              <>
                <Activity className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : type === "reauth" ? (
              "重新认证"
            ) : (
              "确认"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SecurityDialog
