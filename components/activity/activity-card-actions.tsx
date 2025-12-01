"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, Share, Eye } from "lucide-react"
import { LikeButton } from "@/components/blog/like-button"
import { useRealtimeLikes } from "@/hooks/use-realtime-likes"

export interface ActivityCardActionsProps {
  activityId: string
  initialIsLiked?: boolean
  initialLikesCount?: number
  commentsCount?: number
  viewsCount?: number
  onLike?: (activityId: string, nextState?: { isLiked: boolean; count: number }) => void
  onComment?: (activityId: string) => void
  onShare?: (activityId: string) => void
}

function ActivityCardActionsComponent({
  activityId,
  initialIsLiked = false,
  initialLikesCount = 0,
  commentsCount = 0,
  viewsCount = 0,
  onLike,
  onComment,
  onShare,
}: ActivityCardActionsProps) {
  const [likesCount, setLikesCount] = useState(initialLikesCount)

  useEffect(() => {
    setLikesCount(initialLikesCount)
  }, [initialLikesCount])

  const handleRealtimeLike = useCallback(() => {
    setLikesCount((prev) => prev + 1)
  }, [])

  const handleRealtimeUnlike = useCallback(() => {
    setLikesCount((prev) => Math.max(0, prev - 1))
  }, [])

  const {
    isSubscribed: isLikesSubscribed,
    error: likesSubscriptionError,
  } = useRealtimeLikes({
    targetType: "activity",
    targetId: activityId,
    onLike: handleRealtimeLike,
    onUnlike: handleRealtimeUnlike,
  })

  const handleComment = useCallback(() => {
    onComment?.(activityId)
  }, [activityId, onComment])

  const handleShare = useCallback(() => {
    onShare?.(activityId)
  }, [activityId, onShare])

  const handleLikeChange = useCallback(
    (isLiked: boolean, count: number) => {
      onLike?.(activityId, { isLiked, count })
    },
    [activityId, onLike]
  )

  return (
    <div className="mt-4 space-y-1 border-t pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <LikeButton
            targetId={activityId}
            targetType="activity"
            initialIsLiked={initialIsLiked}
            initialCount={likesCount}
            variant="ghost"
            size="sm"
            onLikeChange={handleLikeChange}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleComment}
            className="hover:text-blue-500"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            <span className="tabular-nums">{commentsCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="hover:text-blue-500"
          >
            <Share className="mr-2 h-4 w-4" />
            分享
          </Button>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" />
          <span className="tabular-nums">{viewsCount}</span>
        </div>
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span>
          实时点赞：
          <span className={isLikesSubscribed ? "text-emerald-600" : "text-amber-600"}>
            {isLikesSubscribed ? "已连接" : "连接中..."}
          </span>
        </span>
        {likesSubscriptionError && <span className="text-red-500">订阅失败</span>}
      </div>
    </div>
  )
}

export const ActivityCardActions = memo(
  ActivityCardActionsComponent,
  (prev, next) =>
    prev.activityId === next.activityId &&
    prev.initialIsLiked === next.initialIsLiked &&
    prev.initialLikesCount === next.initialLikesCount &&
    prev.commentsCount === next.commentsCount &&
    prev.viewsCount === next.viewsCount &&
    prev.onLike === next.onLike &&
    prev.onComment === next.onComment &&
    prev.onShare === next.onShare
)

ActivityCardActions.displayName = "ActivityCardActions"
