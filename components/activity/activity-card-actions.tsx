"use client"

import { memo, useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, MessageCircle, Share, Eye } from "lucide-react"

export interface ActivityCardActionsProps {
  activityId: string
  initialIsLiked?: boolean
  initialLikesCount?: number
  commentsCount?: number
  viewsCount?: number
  onLike?: (activityId: string) => void
  onComment?: (activityId: string) => void
  onShare?: (activityId: string) => void
  onCommentsChange?: () => void
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
  onCommentsChange,
}: ActivityCardActionsProps) {
  const [isLiked, setIsLiked] = useState(Boolean(initialIsLiked))
  const [likesCount, setLikesCount] = useState(initialLikesCount ?? 0)

  const handleLike = useCallback(() => {
    setIsLiked((prev) => {
      const nextLiked = !prev
      setLikesCount((prevLikes) => (nextLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1)))
      onLike?.(activityId)
      return nextLiked
    })
  }, [activityId, onLike])

  const handleComment = useCallback(() => {
    onComment?.(activityId)
    onCommentsChange?.()
  }, [activityId, onComment, onCommentsChange])

  const handleShare = useCallback(() => {
    onShare?.(activityId)
  }, [activityId, onShare])

  return (
    <div className="mt-4 flex items-center justify-between border-t pt-2">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={isLiked ? "text-red-500 hover:text-red-600" : "hover:text-red-500"}
        >
          <Heart className={`mr-2 h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
          <span className="tabular-nums">{likesCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleComment} className="hover:text-blue-500">
          <MessageCircle className="mr-2 h-4 w-4" />
          <span className="tabular-nums">{commentsCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare} className="hover:text-blue-500">
          <Share className="mr-2 h-4 w-4" />
          分享
        </Button>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Eye className="h-4 w-4" />
        <span className="tabular-nums">{viewsCount}</span>
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
    prev.onShare === next.onShare &&
    prev.onCommentsChange === next.onCommentsChange
)

ActivityCardActions.displayName = "ActivityCardActions"
