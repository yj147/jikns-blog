"use client"

import { memo } from "react"
import { ActivityCard } from "@/components/activity-card"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import type { ActivityCardProps } from "@/types/activity"

type ForwardedProps = Pick<
  ActivityCardProps,
  "onLike" | "onComment" | "onShare" | "onEdit" | "onDelete" | "showActions" | "compact"
>

interface LazyActivityCardProps extends ForwardedProps {
  activity: ActivityCardProps["activity"]
  index: number
}

function ActivityCardSkeleton() {
  return (
    <div className="border-border flex animate-pulse gap-4 border-b px-4 py-5 sm:px-6">
      <div className="bg-muted h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-3">
        <div className="flex justify-between">
          <div className="bg-muted h-4 w-1/3 rounded" />
        </div>
        <div className="bg-muted h-12 w-3/4 rounded" />
        <div className="bg-muted h-4 w-1/4 rounded" />
      </div>
    </div>
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
  onEdit,
  onDelete,
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
          onEdit={onEdit}
          onDelete={onDelete}
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
