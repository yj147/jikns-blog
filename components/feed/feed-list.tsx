"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { ActivityCard } from "@/components/activity-card"
import { CommentList } from "@/components/activity/comment-list"
import { LazyActivityCard } from "@/components/feed/lazy-activity-card"
import { Button } from "@/components/ui/button"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import type { User as DatabaseUser } from "@/lib/generated/prisma"
import { cn } from "@/lib/utils"
import type { ActivityLikeState, ActivityWithAuthor } from "@/types/activity"
import type { FeedTab } from "@/components/feed/hooks/use-feed-state"

interface FeedListProps {
  activities: ActivityWithAuthor[]
  initialActivities: ActivityWithAuthor[]
  hasInitialSnapshot: boolean
  activeTab: FeedTab
  highlightedActivityIds: Set<string>
  realtimeActivityIds: Set<string>
  hasDisplayActivities: boolean
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  onLike: (activityId: string, nextState?: ActivityLikeState) => void
  onCommentsChange: () => void
  onEdit?: (activity: ActivityWithAuthor) => void
  onDelete?: (activity: ActivityWithAuthor) => void
  user: DatabaseUser | null
  baseActivitiesCount: number
}

export function FeedList({
  activities,
  initialActivities,
  hasInitialSnapshot,
  activeTab,
  highlightedActivityIds,
  realtimeActivityIds,
  hasDisplayActivities,
  hasMore,
  isLoading,
  onLoadMore,
  onLike,
  onCommentsChange,
  onEdit,
  onDelete,
  user,
  baseActivitiesCount,
}: FeedListProps) {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())

  const hasEffectiveActivities = hasDisplayActivities || initialActivities.length > 0
  const effectiveActivities = hasDisplayActivities ? activities : initialActivities

  const [sentinelRef, isSentinelVisible] = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "400px",
  })

  const handleEndReached = useCallback(() => {
    if (!hasMore || isLoading) return
    onLoadMore()
  }, [hasMore, isLoading, onLoadMore])

  useEffect(() => {
    if (!isSentinelVisible) return
    if (typeof window !== "undefined" && window.scrollY === 0) return
    handleEndReached()
  }, [handleEndReached, isSentinelVisible])

  const handleComment = useCallback((id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const renderItem = useCallback(
    (index: number, activity: ActivityWithAuthor) => {
      const isRealtimeItem = realtimeActivityIds.has(activity.id)
      const isHighlighted = highlightedActivityIds.has(activity.id)
      const isExpanded = expandedComments.has(activity.id)

      return (
        <div
          id={`activity-${activity.id}`}
          className={cn(
            "bg-background hover:bg-muted/5 border-border border-b transition-colors",
            isHighlighted && "bg-primary/5",
            isRealtimeItem && "animate-in fade-in slide-in-from-top-4 duration-500",
            index === effectiveActivities.length - 1 && "last:border-b-0"
          )}
        >
          {index === 0 ? (
            <ActivityCard
              activity={activity}
              onLike={onLike}
              onComment={handleComment}
              onEdit={onEdit}
              onDelete={onDelete}
              showActions={true}
              priority
            />
          ) : (
            <LazyActivityCard
              activity={activity}
              index={index}
              onLike={onLike}
              onComment={handleComment}
              onEdit={onEdit}
              onDelete={onDelete}
              showActions={true}
            />
          )}
          {isExpanded && (
            <div className="px-4 pb-4">
              <CommentList
                activityId={activity.id}
                className="border-border mt-2 border-l-2 pl-4"
                showComposer={Boolean(user)}
                onCommentAdded={onCommentsChange}
                onCommentDeleted={onCommentsChange}
              />
            </div>
          )}
        </div>
      )
    },
    [
      effectiveActivities.length,
      expandedComments,
      handleComment,
      highlightedActivityIds,
      onCommentsChange,
      onDelete,
      onEdit,
      onLike,
      realtimeActivityIds,
      user,
    ]
  )

  if (isLoading && !hasEffectiveActivities && !hasInitialSnapshot) {
    return (
      <div className="divide-border min-h-[50vh] divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 p-4">
            <div className="bg-muted h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="bg-muted h-4 w-1/3 rounded" />
              <div className="bg-muted h-16 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!hasEffectiveActivities) {
    return (
      <div className="py-20 text-center">
        <div className="mb-4 text-4xl">📭</div>
        <h3 className="text-lg font-semibold">暂无动态</h3>
        <p className="text-muted-foreground mt-2">
          {activeTab === "following" ? "你关注的人还没有发布任何内容" : "去发布第一条动态吧！"}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-border min-h-[50vh] divide-y">
        {effectiveActivities.map((activity, index) => renderItem(index, activity))}
      </div>

      {hasMore && baseActivitiesCount > 0 ? (
        <div className="border-border flex flex-col items-center gap-6 border-t py-8">
          <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            加载更多
          </Button>
        </div>
      ) : null}
    </>
  )
}
