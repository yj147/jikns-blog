"use client"

/**
 * 通用点赞按钮组件
 * 支持文章和动态的点赞功能
 * 支持查询状态、切换点赞、乐观更新和错误回滚
 */

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn, formatCompactCount } from "@/lib/utils"
import { fetchGet, fetchPost, FetchError } from "@/lib/api/fetch-json"
import { useInteractionToggle } from "@/hooks/use-interaction-toggle"
import { useInteractionErrorToast } from "@/hooks/use-interaction-error-toast"
import type { LikeTargetType } from "@/lib/interactions/likes"

interface LikeButtonProps {
  targetId: string
  targetType?: LikeTargetType
  initialCount?: number
  initialIsLiked?: boolean
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showCount?: boolean
  onLikeChange?: (isLiked: boolean, count: number) => void
}

export function LikeButton({
  targetId,
  targetType = "post",
  initialCount = 0,
  initialIsLiked,
  className,
  variant = "outline",
  size = "sm",
  showCount = true,
  onLikeChange,
}: LikeButtonProps) {
  const { toast } = useToast()
  const targetLabel = targetType === "post" ? "文章" : "动态"
  const handleToggleError = useInteractionErrorToast(`点赞${targetLabel}`)

  const fetchLikeStatus = useCallback(async () => {
    const payload = await fetchGet(`/api/likes`, {
      action: "status",
      targetType,
      targetId,
    })

    const data = payload?.data ?? payload
    return {
      isActive: Boolean(data.isLiked),
      count: typeof data.count === "number" ? data.count : initialCount,
    }
  }, [targetId, targetType, initialCount])

  const toggleLikeRequest = useCallback(async () => {
    const payload = await fetchPost("/api/likes", {
      targetType,
      targetId,
    })

    const data = payload?.data ?? payload
    return {
      isActive: Boolean(data.isLiked),
      count: typeof data.count === "number" ? data.count : 0,
    }
  }, [targetType, targetId])

  const handleFetchError = useCallback(
    (error: unknown) => {
      if (error instanceof FetchError && error.statusCode === 401) {
        return { isActive: false, count: initialCount }
      }
      return undefined
    },
    [initialCount]
  )

  const { status, isLoading, isToggling, toggle } = useInteractionToggle({
    initialIsActive: initialIsLiked ?? false,
    initialCount,
    fetcher: fetchLikeStatus,
    toggler: toggleLikeRequest,
    shouldFetchOnMount: initialIsLiked === undefined,
    externalIsActive: initialIsLiked,
    externalCount: initialCount,
    onStatusChange: onLikeChange,
    onFetchError: handleFetchError,
    onToggleError: handleToggleError,
  })

  const handleToggle = useCallback(async () => {
    const result = await toggle()
    if (!result) return

    toast({
      description: result.isActive ? `已点赞${targetLabel}` : "已取消点赞",
    })
  }, [toggle, targetLabel, toast])

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isLoading || isToggling}
      className={cn("transition-all", status.isActive && "text-red-500", className)}
      aria-label={status.isActive ? "取消点赞" : `点赞${targetLabel}`}
      aria-pressed={status.isActive}
      data-testid="like-button"
      data-liked={status.isActive}
    >
      <Heart className={cn("h-4 w-4", showCount && "mr-2", status.isActive && "fill-current")} />
      {showCount && (
        <span className="tabular-nums" data-testid="like-count">
          {isLoading ? "..." : formatCompactCount(status.count)}
        </span>
      )}
    </Button>
  )
}
