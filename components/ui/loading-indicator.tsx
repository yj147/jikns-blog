/**
 * 加载状态指示器组件
 * 提供各种类型的加载动画和状态显示
 */

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react"

/**
 * 加载状态类型
 */
export type LoadingState = "idle" | "loading" | "success" | "error"

/**
 * 加载指示器变体
 */
export type LoadingVariant = "spinner" | "dots" | "pulse" | "skeleton" | "progress"

/**
 * 基础加载指示器接口
 */
interface BaseLoadingProps {
  variant?: LoadingVariant
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

/**
 * 加载指示器属性接口
 */
interface LoadingIndicatorProps extends BaseLoadingProps {
  state?: LoadingState
  message?: string
  description?: string
  showIcon?: boolean
}

/**
 * 进度加载指示器属性
 */
interface ProgressLoadingProps extends BaseLoadingProps {
  progress: number
  label?: string
  showPercentage?: boolean
}

/**
 * 骨架加载指示器属性
 */
interface SkeletonLoadingProps extends BaseLoadingProps {
  lines?: number
  showAvatar?: boolean
  showTitle?: boolean
}

/**
 * 加载状态图标组件
 */
const LoadingIcons = {
  loading: Loader2,
  success: CheckCircle,
  error: XCircle,
  idle: AlertCircle,
}

/**
 * 尺寸配置
 */
const sizeConfig = {
  sm: {
    icon: "h-4 w-4",
    text: "text-sm",
    container: "gap-2",
  },
  md: {
    icon: "h-5 w-5",
    text: "text-base",
    container: "gap-3",
  },
  lg: {
    icon: "h-6 w-6",
    text: "text-lg",
    container: "gap-4",
  },
  xl: {
    icon: "h-8 w-8",
    text: "text-xl",
    container: "gap-4",
  },
}

/**
 * 旋转器加载指示器
 */
const SpinnerIndicator: React.FC<LoadingIndicatorProps> = ({
  state = "loading",
  size = "md",
  message,
  description,
  showIcon = true,
  className,
}) => {
  const Icon = LoadingIcons[state]
  const config = sizeConfig[size]

  const stateColors = {
    loading: "text-blue-600 dark:text-blue-400",
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    idle: "text-gray-600 dark:text-gray-400",
  }

  return (
    <div className={cn("flex items-center justify-center", config.container, className)}>
      {showIcon && (
        <Icon
          className={cn(config.icon, stateColors[state], state === "loading" && "animate-spin")}
        />
      )}
      <div className="flex flex-col items-center">
        {message && (
          <span className={cn("font-medium", config.text, stateColors[state])}>{message}</span>
        )}
        {description && (
          <span
            className={cn(
              "text-gray-500 dark:text-gray-400",
              size === "sm" ? "text-xs" : "text-sm"
            )}
          >
            {description}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 点状加载指示器
 */
const DotsIndicator: React.FC<LoadingIndicatorProps> = ({ size = "md", message, className }) => {
  const dotSizes = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
    xl: "h-5 w-5",
  }

  const dotSize = dotSizes[size]

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn("animate-pulse rounded-full bg-blue-600", dotSize)}
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: "1s",
            }}
          />
        ))}
      </div>
      {message && (
        <span className={cn("text-gray-600 dark:text-gray-400", sizeConfig[size].text)}>
          {message}
        </span>
      )}
    </div>
  )
}

/**
 * 脉冲加载指示器
 */
const PulseIndicator: React.FC<LoadingIndicatorProps> = ({ size = "md", message, className }) => {
  const pulseSizes = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-20 w-20",
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("animate-ping rounded-full bg-blue-600 opacity-75", pulseSizes[size])} />
      {message && (
        <span className={cn("text-gray-600 dark:text-gray-400", sizeConfig[size].text)}>
          {message}
        </span>
      )}
    </div>
  )
}

/**
 * 进度加载指示器
 */
const ProgressIndicator: React.FC<ProgressLoadingProps> = ({
  progress,
  label,
  showPercentage = true,
  size = "md",
  className,
}) => {
  const heightConfig = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
    xl: "h-5",
  }

  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className={cn("w-full space-y-2", className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className={cn("text-gray-700 dark:text-gray-300", sizeConfig[size].text)}>
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className={cn(
                "text-gray-500 dark:text-gray-400",
                size === "sm" ? "text-xs" : "text-sm"
              )}
            >
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700",
          heightConfig[size]
        )}
      >
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  )
}

/**
 * 骨架加载指示器
 */
const SkeletonIndicator: React.FC<SkeletonLoadingProps> = ({
  lines = 3,
  showAvatar = false,
  showTitle = false,
  size = "md",
  className,
}) => {
  const avatarSizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  }

  const linHeights = {
    sm: "h-3",
    md: "h-4",
    lg: "h-5",
    xl: "h-6",
  }

  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <div className={cn("rounded-full bg-gray-300 dark:bg-gray-600", avatarSizes[size])} />
          <div className="flex-1 space-y-2">
            <div className={cn("w-3/4 rounded bg-gray-300 dark:bg-gray-600", linHeights[size])} />
            <div
              className={cn(
                "w-1/2 rounded bg-gray-300 dark:bg-gray-600",
                size === "sm" ? "h-2" : "h-3"
              )}
            />
          </div>
        </div>
      )}

      {showTitle && (
        <div
          className={cn(
            "w-2/3 rounded bg-gray-300 dark:bg-gray-600",
            size === "sm" ? "h-5" : size === "md" ? "h-6" : "h-7"
          )}
        />
      )}

      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "rounded bg-gray-300 dark:bg-gray-600",
              linHeights[size],
              index === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 主加载指示器组件
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = (props) => {
  switch (props.variant) {
    case "dots":
      return <DotsIndicator {...props} />
    case "pulse":
      return <PulseIndicator {...props} />
    case "skeleton":
      return <SkeletonIndicator {...props} />
    default:
      return <SpinnerIndicator {...props} />
  }
}

/**
 * 进度加载指示器组件
 */
export const ProgressLoading: React.FC<ProgressLoadingProps> = (props) => {
  return <ProgressIndicator {...props} />
}

/**
 * 骨架加载指示器组件
 */
export const SkeletonLoading: React.FC<SkeletonLoadingProps> = (props) => {
  return <SkeletonIndicator {...props} />
}

/**
 * 内联加载指示器（用于按钮等）
 */
export const InlineLoading: React.FC<{
  loading?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  children: React.ReactNode
}> = ({ loading = false, size = "sm", className, children }) => {
  if (!loading) {
    return <>{children}</>
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin", sizeConfig[size].icon)} />
      {children}
    </div>
  )
}

/**
 * 全屏加载覆盖层
 */
export const FullScreenLoading: React.FC<{
  show: boolean
  message?: string
  description?: string
  variant?: LoadingVariant
}> = ({ show, message = "加载中...", description, variant = "spinner" }) => {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
      <div className="text-center">
        <LoadingIndicator variant={variant} size="lg" message={message} description={description} />
      </div>
    </div>
  )
}

/**
 * 页面级加载组件
 */
export const PageLoading: React.FC<{
  message?: string
  description?: string
}> = ({ message = "页面加载中...", description }) => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingIndicator variant="spinner" size="lg" message={message} description={description} />
    </div>
  )
}

/**
 * 卡片加载组件
 */
export const CardLoading: React.FC<{
  lines?: number
  showAvatar?: boolean
  showTitle?: boolean
  className?: string
}> = (props) => {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800",
        props.className
      )}
    >
      <SkeletonLoading {...props} />
    </div>
  )
}
