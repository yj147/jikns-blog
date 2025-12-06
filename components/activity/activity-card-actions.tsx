"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { LikeButton } from "@/components/blog/like-button"
import { useRealtimeLikes } from "@/hooks/use-realtime-likes"
import { MessageCircle, Repeat2, BarChart2 } from "lucide-react"
import { bumpActivityCounts } from "@/lib/activities/cache-update"

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

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
  return String(count)
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

  useRealtimeLikes({
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
      setLikesCount(count)
      // 同步全局缓存，避免 revalidate 后回退到旧计数
      bumpActivityCounts(activityId, { likes: count - likesCount, isLiked, comments: 0 })
      onLike?.(activityId, { isLiked, count })
    },
    [activityId, likesCount, onLike]
  )

  return (
    <div className="-mx-2 mt-3">
      <div className="flex items-center justify-between max-w-md">
        {/* 评论 */}
        <button
          onClick={handleComment}
          className="group flex flex-1 items-center justify-center gap-1 py-2 text-muted-foreground transition-colors hover:text-sky-500"
        >
          <div className="rounded-full p-2 transition-colors group-hover:bg-sky-500/10">
            <MessageCircle className="h-[18px] w-[18px]" />
          </div>
          {commentsCount > 0 && (
            <span className="text-[13px] tabular-nums">{formatCount(commentsCount)}</span>
          )}
        </button>

        {/* 转发 */}
        <button
          onClick={handleShare}
          className="group flex flex-1 items-center justify-center gap-1 py-2 text-muted-foreground transition-colors hover:text-green-500"
        >
          <div className="rounded-full p-2 transition-colors group-hover:bg-green-500/10">
            <Repeat2 className="h-[18px] w-[18px]" />
          </div>
        </button>

        {/* 点赞 */}
        <div className="flex flex-1 items-center justify-center">
          <LikeButton
            targetId={activityId}
            targetType="activity"
            initialIsLiked={initialIsLiked}
            initialCount={likesCount}
            variant="ghost"
            size="sm"
            showCount={likesCount > 0}
            onLikeChange={handleLikeChange}
            className="hover:bg-pink-500/10 hover:text-pink-500"
          />
        </div>

        {/* 浏览 */}
        <button className="group flex flex-1 items-center justify-center gap-1 py-2 text-muted-foreground transition-colors hover:text-sky-500">
          <div className="rounded-full p-2 transition-colors group-hover:bg-sky-500/10">
            <BarChart2 className="h-[18px] w-[18px]" />
          </div>
          {viewsCount > 0 && (
            <span className="text-[13px] tabular-nums">{formatCount(viewsCount)}</span>
          )}
        </button>
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
