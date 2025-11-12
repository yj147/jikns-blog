"use client"

import { memo } from "react"
import { ActivityCard } from "@/components/activity-card"
import { Card, CardContent } from "@/components/ui/card"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import type { ActivityCardProps } from "@/types/activity"

type ForwardedProps = Pick<
  ActivityCardProps,
  "onLike" | "onComment" | "onShare" | "onCommentsChange" | "showActions" | "compact"
>

interface LazyActivityCardProps extends ForwardedProps {
  activity: ActivityCardProps["activity"]
  index: number
}

function ActivityCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center space-x-3">
          <div className="bg-muted h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-4 w-1/4 rounded" />
            <div className="bg-muted h-3 w-1/6 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-4 w-full rounded" />
          <div className="bg-muted h-4 w-3/4 rounded" />
        </div>
        <div className="mt-4 flex items-center space-x-4">
          <div className="bg-muted h-8 w-16 rounded" />
          <div className="bg-muted h-8 w-16 rounded" />
          <div className="bg-muted h-8 w-16 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

function LazyActivityCardComponent({
  activity,
  index,
  showActions = true,
  compact,
  onLike,
  onComment,
  onShare,
  onCommentsChange,
}: LazyActivityCardProps) {
  const [ref, isIntersecting] = useIntersectionObserver<HTMLDivElement>({
    once: true,
    rootMargin: "200px",
  })

  return (
    <div ref={ref} data-feed-index={index}>
      {isIntersecting ? (
        <ActivityCard
          activity={activity}
          showActions={showActions}
          compact={compact}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onCommentsChange={onCommentsChange}
        />
      ) : (
        <ActivityCardSkeleton />
      )}
    </div>
  )
}

export const LazyActivityCard = memo(
  LazyActivityCardComponent,
  (prev, next) =>
    prev.activity.id === next.activity.id &&
    prev.index === next.index &&
    prev.showActions === next.showActions &&
    prev.compact === next.compact
)

LazyActivityCard.displayName = "LazyActivityCard"
