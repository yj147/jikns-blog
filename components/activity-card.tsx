"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import { memo, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal } from "lucide-react"
import type { ActivityCardProps } from "@/types/activity"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"

const ActivityCardActions = dynamic(
  () => import("./activity/activity-card-actions").then((mod) => mod.ActivityCardActions),
  {
    ssr: false,
    loading: () => <div className="mt-4 h-10 rounded bg-muted animate-pulse" />,
  }
)

function ActivityCardComponent(props: ActivityCardProps) {
  const {
    activity,
    onLike,
    onComment,
    onShare,
    onCommentsChange,
    showActions = true,
    compact = false,
    priority = false,
  } = props

  const authorName = activity.author?.name || "匿名用户"
  const authorUsername = activity.author?.id ? `@${activity.author.id.slice(0, 8)}` : "@user"
  const avatarUrl = activity.author?.avatarUrl || "/placeholder.svg"

  const timestampLabel = useMemo(() => {
    const createdAt = activity.createdAt ? new Date(activity.createdAt) : new Date()
    return createdAt.toLocaleString("zh-CN", { hour12: false })
  }, [activity.createdAt])

  const images = activity.imageUrls ?? []
  const commentsCount = activity.commentsCount ?? 0
  const viewsCount = activity.viewsCount ?? 0

  return (
    <Card
      className={
        compact ? "transition-shadow hover:shadow-sm" : "transition-shadow hover:shadow-md"
      }
    >
      <CardContent className={compact ? "pt-4" : "pt-6"}>
        <div className="flex items-start space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} alt={authorName} />
            <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="font-semibold">{authorName}</p>
                  <p className="text-muted-foreground text-sm">{authorUsername}</p>
                  <span className="text-muted-foreground text-sm">·</span>
                  <p className="text-muted-foreground text-sm">{timestampLabel}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {activity.content}
            </p>

            {images.length > 0 && (
              <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {images.map((image, index) => {
                  const shouldPrioritize = priority && index === 0
                  return (
                    <div key={index} className="overflow-hidden rounded-lg">
                      <Image
                        src={
                          getOptimizedImageUrl(image, {
                            width: images.length === 1 ? 1280 : 800,
                            height: images.length === 1 ? 720 : 600,
                            quality: 75,
                            format: "webp",
                          }) ?? image ?? "/placeholder.svg"
                        }
                        alt={`动态图片 ${index + 1}`}
                        width={800}
                        height={600}
                        sizes={images.length === 1 ? "100vw" : "(max-width: 768px) 50vw, 400px"}
                        className="h-auto w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                        loading={shouldPrioritize ? "eager" : "lazy"}
                        priority={shouldPrioritize}
                        fetchPriority={shouldPrioritize ? "high" : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {showActions && (
          <ActivityCardActions
            activityId={activity.id}
            initialIsLiked={activity.isLiked}
            initialLikesCount={activity.likesCount}
            commentsCount={commentsCount}
            viewsCount={viewsCount}
            onLike={onLike}
            onComment={onComment}
            onShare={onShare}
            onCommentsChange={onCommentsChange}
          />
        )}
      </CardContent>
    </Card>
  )
}

export const ActivityCard = memo(ActivityCardComponent, (prev, next) => {
  const prevActivity = prev.activity
  const nextActivity = next.activity

  return (
    prevActivity.id === nextActivity.id &&
    prevActivity.updatedAt === nextActivity.updatedAt &&
    prevActivity.likesCount === nextActivity.likesCount &&
    prevActivity.commentsCount === nextActivity.commentsCount &&
    prevActivity.viewsCount === nextActivity.viewsCount &&
    prevActivity.content === nextActivity.content &&
    prev.showActions === next.showActions &&
    prev.compact === next.compact &&
    prev.priority === next.priority &&
    prev.onLike === next.onLike &&
    prev.onComment === next.onComment &&
    prev.onShare === next.onShare &&
    prev.onCommentsChange === next.onCommentsChange
  )
})

ActivityCard.displayName = "ActivityCard"
