import type { Notification, NotificationType } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import {
  resolveNotificationPreference,
  type NotificationPreferencesInput,
} from "@/types/user-settings"

type NotificationPayload = {
  actorId: string
  postId?: string | null
  commentId?: string | null
  activityId?: string | null
}

async function isNotificationEnabled(recipientId: string, type: NotificationType): Promise<boolean> {
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { notificationPreferences: true },
  })

  if (!recipient) return false

  return resolveNotificationPreference(
    recipient.notificationPreferences as NotificationPreferencesInput,
    type
  )
}

export async function notify(
  recipientId: string,
  type: NotificationType,
  data: NotificationPayload
): Promise<Notification | null> {
  if (!data.actorId) {
    throw new Error("actorId is required to create notification")
  }

  const enabled = await isNotificationEnabled(recipientId, type)
  if (!enabled) return null

  return prisma.notification.create({
    data: {
      recipientId,
      actorId: data.actorId,
      type,
      postId: data.postId ?? null,
      commentId: data.commentId ?? null,
      activityId: data.activityId ?? null,
    },
  })
}

export async function markAsRead(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  return result.count
}

export function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      recipientId: userId,
      readAt: null,
    },
  })
}
