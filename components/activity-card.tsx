"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import { memo, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal, Pin } from "lucide-react"
import type { ActivityCardProps } from "@/types/activity"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import Link from "@/components/app-link"

const ActivityCardActions = dynamic(
  () => import("./activity/activity-card-actions").then((mod) => mod.ActivityCardActions),
  {
    ssr: false,
    loading: () => <div className="bg-muted/30 mt-2 h-8 w-full animate-pulse rounded" />,
  }
)

const ActivityMoreMenu = dynamic(() => import("./activity/activity-more-menu"), {
  ssr: false,
  loading: () => (
    <Button variant="ghost" size="icon" className="text-muted-foreground -mr-2 h-8 w-8" disabled>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">更多</span>
    </Button>
  ),
})

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`

  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
}

function ActivityCardComponent(props: ActivityCardProps) {
  const {
    activity,
    onLike,
    onComment,
    onShare,
    onEdit,
    onDelete,
    showActions = true,
    compact = false,
    priority = false,
  } = props

  const canEdit = activity.canEdit ?? false
  const canDelete = activity.canDelete ?? false
  const [menuEnabled, setMenuEnabled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const authorName = activity.author?.name || "匿名用户"
  const authorUsername = activity.author?.name
    ? `@${activity.author.name.replace(/\s+/g, "").toLowerCase()}`
    : null
  const avatarUrl = activity.author?.avatarUrl || "/placeholder.svg"

  const timestampLabel = useMemo(() => {
    const createdAt = activity.createdAt ? new Date(activity.createdAt) : new Date()
    return formatRelativeTime(createdAt)
  }, [activity.createdAt])

  const images = activity.imageUrls ?? []
  const commentsCount = activity.commentsCount ?? 0
  const viewsCount = activity.viewsCount ?? 0
  const isPinned = activity.isPinned ?? false

  return (
    <article className="bg-background hover:bg-muted/30 px-4 py-3 transition-colors sm:px-6">
      {isPinned && (
        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
          <Pin className="h-3 w-3 fill-current" />
          <span>置顶动态</span>
        </div>
      )}

      <div className="flex gap-4">
        <div className="shrink-0">
          <Link href={`/profile/${activity.author.id ?? "#"}`}>
            <Avatar className="h-10 w-10 transition-opacity hover:opacity-90">
              <AvatarImage src={avatarUrl} alt={authorName} />
              <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1 text-[15px]">
              <Link
                href={`/profile/${activity.author.id ?? "#"}`}
                className="text-foreground font-bold hover:underline"
              >
                {authorName}
              </Link>
              {activity.author?.role === "ADMIN" && (
                <svg
                  className="h-[18px] w-[18px] text-sky-500"
                  viewBox="0 0 22 22"
                  fill="currentColor"
                >
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                </svg>
              )}
              {authorUsername && <span className="text-muted-foreground">{authorUsername}</span>}
              <span className="text-muted-foreground">·</span>
              <span
                className="text-muted-foreground cursor-pointer hover:underline"
                suppressHydrationWarning
              >
                {timestampLabel}
              </span>
            </div>
            {menuEnabled ? (
              <ActivityMoreMenu
                activityId={activity.id}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={onEdit ? () => onEdit(activity) : undefined}
                onDelete={onDelete ? () => onDelete(activity) : undefined}
              />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground -mr-2 h-8 w-8"
                onClick={() => {
                  setMenuEnabled(true)
                  setMenuOpen(true)
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">更多</span>
              </Button>
            )}
          </div>

          <div className="text-foreground mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {activity.content}
          </div>

          {images.length > 0 && (
            <div
              className={`mt-3 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
            >
              {images.map((image, index) => {
                const shouldPrioritize = priority && index === 0
                return (
                  <div
                    key={index}
                    className="border-border/50 bg-muted/20 overflow-hidden rounded-xl border"
                  >
                    <Image
                      src={
                        getOptimizedImageUrl(image, {
                          width: images.length === 1 ? 1280 : 800,
                          height: images.length === 1 ? 720 : 600,
                          quality: 75,
                          format: "webp",
                        }) ??
                        image ??
                        "/placeholder.svg"
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

          {showActions && (
            <div className="mt-2">
              <ActivityCardActions
                activityId={activity.id}
                initialIsLiked={activity.isLiked}
                initialLikesCount={activity.likesCount}
                commentsCount={commentsCount}
                viewsCount={viewsCount}
                onLike={onLike}
                onComment={onComment}
                onShare={onShare}
              />
            </div>
          )}
        </div>
      </div>
    </article>
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
    prevActivity.canEdit === nextActivity.canEdit &&
    prevActivity.canDelete === nextActivity.canDelete &&
    prev.showActions === next.showActions &&
    prev.compact === next.compact &&
    prev.priority === next.priority &&
    prev.onLike === next.onLike &&
    prev.onComment === next.onComment &&
    prev.onShare === next.onShare &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete
  )
})

ActivityCard.displayName = "ActivityCard"
