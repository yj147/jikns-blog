import { NotificationType } from "@/lib/generated/prisma"

export interface NotificationActor {
  id: string
  name: string | null
  avatarUrl: string | null
  email?: string | null
}

export interface NotificationLinkTarget {
  id: string
  title?: string | null
  slug?: string | null
  postId?: string | null
  activityId?: string | null
  content?: string | null
}

export interface NotificationView {
  id: string
  type: NotificationType
  readAt: string | null
  createdAt: string
  targetUrl?: string | null
  recipientId?: string
  actorId?: string
  activityId?: string | null
  actor: NotificationActor | null
  post?: NotificationLinkTarget | null
  comment?: NotificationLinkTarget | null
}

export interface NotificationPagination {
  limit: number
  hasMore: boolean
  nextCursor: string | null
  total?: number | null
}

export interface NotificationListPayload {
  items: NotificationView[]
  pagination: NotificationPagination
  unreadCount: number
  filteredUnreadCount: number
}
