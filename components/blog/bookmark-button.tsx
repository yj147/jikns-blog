"use client"

/**
 * 收藏按钮组件
 * P8-FE-1: 博客详情页收藏功能接入
 * 支持查询状态、切换收藏、乐观更新和错误回滚
 */

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Bookmark } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn, formatCompactCount } from "@/lib/utils"
import { fetchGet, fetchPost, FetchError } from "@/lib/api/fetch-json"
import { useInteractionToggle } from "@/hooks/use-interaction-toggle"
import { useInteractionErrorToast } from "@/hooks/use-interaction-error-toast"

interface BookmarkButtonProps {
  postId: string
  initialCount?: number
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showCount?: boolean
}

export function BookmarkButton({
  postId,
  initialCount = 0,
  className,
  variant = "outline",
  size = "sm",
  showCount = true,
}: BookmarkButtonProps) {
  const { toast } = useToast()
  const handleToggleError = useInteractionErrorToast("收藏文章")

  const fetchBookmarkStatus = useCallback(async () => {
    const payload = await fetchGet(`/api/bookmarks`, {
      action: "status",
      postId,
    })

    const data = payload?.data ?? payload
    return {
      isActive: Boolean(data.isBookmarked),
      count: typeof data.count === "number" ? data.count : initialCount,
    }
  }, [postId, initialCount])

  const toggleBookmarkRequest = useCallback(async () => {
    const payload = await fetchPost("/api/bookmarks", { postId })

    const data = payload?.data ?? payload
    return {
      isActive: Boolean(data.isBookmarked),
      count: typeof data.count === "number" ? data.count : 0,
    }
  }, [postId])

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
    initialIsActive: false,
    initialCount,
    fetcher: fetchBookmarkStatus,
    toggler: toggleBookmarkRequest,
    shouldFetchOnMount: true,
    externalCount: initialCount,
    onFetchError: handleFetchError,
    onToggleError: handleToggleError,
  })

  const handleToggle = useCallback(async () => {
    const result = await toggle()
    if (!result) return

    toast({
      description: result.isActive ? "已收藏文章" : "已取消收藏",
    })
  }, [toggle, toast])

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isLoading || isToggling}
      className={cn("transition-all", status.isActive && "text-primary", className)}
      aria-label={status.isActive ? "取消收藏" : "收藏文章"}
      aria-pressed={status.isActive}
      data-testid="bookmark-button"
      data-bookmarked={status.isActive}
    >
      <Bookmark className={cn("h-4 w-4", showCount && "mr-2", status.isActive && "fill-current")} />
      {showCount && (
        <span className="tabular-nums">{isLoading ? "..." : formatCompactCount(status.count)}</span>
      )}
    </Button>
  )
}
