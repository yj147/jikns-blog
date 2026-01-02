/**
 * 单条通知卡片
 */
"use client"

import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Bell, Heart, MessageCircle, Newspaper, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { NotificationType } from "@/lib/generated/prisma"
import type { NotificationView } from "./types"

interface NotificationItemProps {
  notification: NotificationView
  onMarkRead?: (id: string) => Promise<void> | void
  onNavigate?: (href: string) => void
  compact?: boolean
}

const TYPE_META: Record<
  NotificationType,
  { label: string; icon: typeof Bell; tone: string; background: string }
> = {
  LIKE: { label: "点赞", icon: Heart, tone: "text-action-like", background: "bg-action-like/10" },
  COMMENT: {
    label: "评论",
    icon: MessageCircle,
    tone: "text-action-comment",
    background: "bg-action-comment/10",
  },
  FOLLOW: {
    label: "关注",
    icon: UserPlus,
    tone: "text-action-share",
    background: "bg-action-share/10",
  },
  SYSTEM: {
    label: "系统",
    icon: Bell,
    tone: "text-status-warning",
    background: "bg-status-warning/10",
  },
  NEW_POST: {
    label: "新文章",
    icon: Newspaper,
    tone: "text-primary",
    background: "bg-primary/10",
  },
}

function formatRelative(value: string) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: zhCN })
  } catch {
    return "刚刚"
  }
}

export function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
  compact = false,
}: NotificationItemProps) {
  const unread = !notification.readAt
  const meta = TYPE_META[notification.type]
  const actorName = notification.actor?.name || notification.actor?.email || "神秘用户"
  const avatarText = actorName?.[0]?.toUpperCase() || "U"
  const postIdentifier =
    notification.post?.slug || notification.post?.id || notification.comment?.postId
  const postLink = postIdentifier ? `/blog/${postIdentifier}` : undefined
  const profileLink =
    notification.type === NotificationType.FOLLOW &&
    (notification.actor?.id || notification.actorId)
      ? `/profile/${notification.actor?.id ?? notification.actorId}`
      : undefined
  const commentLink =
    notification.type === NotificationType.COMMENT && postLink ? `${postLink}#comments` : undefined
  const detailLink = notification.targetUrl ?? commentLink ?? postLink ?? profileLink

  const description =
    notification.type === NotificationType.LIKE
      ? "赞了你的内容"
      : notification.type === NotificationType.COMMENT
        ? "评论了你的内容"
        : notification.type === NotificationType.FOLLOW
          ? "关注了你"
          : notification.type === NotificationType.NEW_POST
            ? "发布了新文章"
            : "系统通知"

  const router = useRouter()

  const handleMarkRead = () => {
    if (!unread) return
    void onMarkRead?.(notification.id)
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleMarkRead()
  }

  const handleNavigate = (event?: React.MouseEvent | React.KeyboardEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    handleMarkRead()
    if (!detailLink) return
    if (onNavigate) {
      onNavigate(detailLink)
      return
    }
    router.push(detailLink)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      handleNavigate(event)
    }
  }

  const renderBody = () => (
    <div className="flex flex-1 items-start gap-3">
      <div className={cn("rounded-full p-2 transition-colors", meta.background)}>
        <meta.icon className={cn("h-4 w-4", meta.tone)} />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("border-transparent", meta.tone)}>
            {meta.label}
          </Badge>
          <span className="text-muted-foreground text-xs" suppressHydrationWarning>
            {formatRelative(notification.createdAt)}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={notification.actor?.avatarUrl ?? undefined} alt={actorName} />
            <AvatarFallback>{avatarText}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">
              {actorName} <span className="text-muted-foreground font-normal">{description}</span>
            </p>
            {notification.post?.title ? (
              <p className="text-muted-foreground line-clamp-1 text-sm">
                {notification.post.title}
              </p>
            ) : null}
            {notification.comment?.content ? (
              <p className="text-muted-foreground line-clamp-2 text-xs">
                {notification.comment.content}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )

  const cardClasses = cn(
    "relative border bg-card/80 transition-colors hover:border-primary/40 hover:bg-muted/70 hover:shadow-sm",
    unread ? "border-primary/40 bg-primary/5" : "border-border/80",
    compact ? "px-4 py-3" : "px-5 py-4",
    detailLink ? "cursor-pointer" : "cursor-default",
    "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-background focus-visible:border-primary/50"
  )

  return (
    <Card
      className={cardClasses}
      role={detailLink ? "link" : undefined}
      tabIndex={detailLink ? 0 : undefined}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        {renderBody()}

        {!compact ? (
          <Button
            variant={unread ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={handleButtonClick}
          >
            {unread ? "标记已读" : "已读"}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

export default NotificationItem
