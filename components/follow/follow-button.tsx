"use client"

import React, { useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useFollowUser } from "@/hooks/use-follow-user"
import { cn } from "@/lib/utils"
import { FollowButtonContent } from "./follow-button-content"
import { FollowButtonError } from "./follow-button-error"
import { FollowButtonDisabled } from "./follow-button-disabled"

type ButtonVariant = "default" | "outline" | "secondary" | "ghost"
type ButtonSize = "default" | "sm" | "lg" | "icon"

export interface FollowButtonProps {
  /** 目标用户ID */
  targetUserId: string
  /** 目标用户名（用于可访问性标签） */
  targetUserName?: string
  /** 初始关注状态 */
  initialFollowing?: boolean
  /** 按钮尺寸 */
  size?: ButtonSize
  /** 按钮变体 */
  variant?: ButtonVariant
  /** 是否禁用 */
  disabled?: boolean
  /** Feature Flag：是否启用关注功能（为 false 时禁用并展示提示） */
  featureFlagEnabled?: boolean
  /** 仅显示图标 */
  iconOnly?: boolean
  /** 自定义样式类 */
  className?: string
  /** 关注成功回调 */
  onFollowSuccess?: (userId: string) => void
  /** 取关成功回调 */
  onUnfollowSuccess?: (userId: string) => void
  /** 错误回调 */
  onError?: (error: any) => void
  /** 测试选择器（默认 follow-button） */
  "data-testid"?: string
}

export default function FollowButton({
  targetUserId,
  targetUserName,
  initialFollowing = false,
  size = "default",
  variant = "default",
  disabled = false,
  featureFlagEnabled = true,
  iconOnly = false,
  className,
  onFollowSuccess,
  onUnfollowSuccess,
  onError,
  "data-testid": dataTestId = "follow-button",
}: FollowButtonProps) {
  const initialFollowingIds = useMemo(
    () => (initialFollowing ? [targetUserId] : []),
    [initialFollowing, targetUserId]
  )

  const { toggleFollow, isFollowing, isLoading, error, clearError } = useFollowUser({
    optimistic: true,
    showToast: true,
    initialFollowing: initialFollowingIds,
  })

  const isCurrentlyFollowing = isFollowing(targetUserId)

  const handleClick = useCallback(async () => {
    if (disabled || isLoading) return

    if (error) clearError()

    try {
      const result = await toggleFollow(targetUserId, isCurrentlyFollowing)
      if (result.success) {
        if (isCurrentlyFollowing) {
          onUnfollowSuccess?.(targetUserId)
        } else {
          onFollowSuccess?.(targetUserId)
        }
      } else {
        onError?.(result.error)
      }
    } catch (err) {
      onError?.(err)
    }
  }, [
    disabled,
    isLoading,
    error,
    clearError,
    toggleFollow,
    targetUserId,
    onFollowSuccess,
    onUnfollowSuccess,
    onError,
    isCurrentlyFollowing,
  ])

  const buttonVariant = isCurrentlyFollowing && variant === "default" ? "outline" : variant

  if (!featureFlagEnabled) {
    return <FollowButtonDisabled dataTestId={dataTestId} />
  }

  return (
    <div className="relative">
      <Button
        data-testid={dataTestId}
        variant={buttonVariant}
        size={iconOnly ? "icon" : size}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        onClick={handleClick}
        aria-pressed={isCurrentlyFollowing}
        aria-label={
          iconOnly
            ? isCurrentlyFollowing
              ? `取消关注用户 ${targetUserName || targetUserId}`
              : `关注用户 ${targetUserName || targetUserId}`
            : undefined
        }
        className={cn(
          "gap-2 transition-all",
          isCurrentlyFollowing &&
            variant === "default" && [
              "border-primary bg-background text-primary border-2",
              "hover:bg-primary hover:text-primary-foreground",
            ],
          error && "ring-destructive/20 ring-2",
          isLoading && "cursor-not-allowed",
          className
        )}
      >
        <FollowButtonContent
          isFollowing={isCurrentlyFollowing}
          isLoading={isLoading}
          iconOnly={iconOnly}
        />
      </Button>

      <FollowButtonError error={error} />
    </div>
  )
}
