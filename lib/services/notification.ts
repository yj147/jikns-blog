import type { Notification, NotificationType } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { createServiceRoleClient } from "@/lib/supabase"
import { createLogger } from "@/lib/utils/logger"
import {
  resolveNotificationPreference,
  type NotificationPreferencesInput,
} from "@/types/user-settings"
import { enqueueEmailNotification } from "@/lib/services/email-queue"

type NotificationPayload = {
  actorId: string
  postId?: string | null
  commentId?: string | null
  activityId?: string | null
}

type NotificationBroadcastPayload = {
  id: string
  recipientId: string
  actorId: string
  type: NotificationType
  postId: string | null
  commentId: string | null
  activityId: string | null
  readAt: string | null
  createdAt: string
}

const notificationsLogger = createLogger("notification-service")

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

  const notification = await prisma.notification.create({
    data: {
      recipientId,
      actorId: data.actorId,
      type,
      postId: data.postId ?? null,
      commentId: data.commentId ?? null,
      activityId: data.activityId ?? null,
    },
  })

  await broadcastNotification(recipientId, notification)

  enqueueEmailNotification(recipientId, type, data, notification.id).catch((err) => {
    notificationsLogger.warn("Email queue failed", { err, notificationId: notification.id })
  })

  return notification
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

async function broadcastNotification(recipientId: string, notification: Notification): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const channelName = `notifications:user-${recipientId}`
    const payload: NotificationBroadcastPayload = {
      id: notification.id,
      recipientId: notification.recipientId,
      actorId: notification.actorId,
      type: notification.type,
      postId: notification.postId,
      commentId: notification.commentId,
      activityId: notification.activityId,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    }

    // 服务端发送 broadcast 只需创建 channel 并发送
    // 不需要先 subscribe，消息会被已订阅该 channel 的客户端接收
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    // subscribe 但不等待确认（fire-and-forget 模式）
    channel.subscribe()

    // 短暂延迟确保 channel 注册完成
    await new Promise((r) => setTimeout(r, 100))

    const status = await channel.send({
      type: "broadcast",
      event: "INSERT",
      payload,
    })

    if (status !== "ok") {
      notificationsLogger.warn("Supabase broadcast failed", {
        channelName,
        notificationId: notification.id,
        status,
      })
    }

    await supabase.removeChannel(channel)
  } catch (error) {
    notificationsLogger.warn("Supabase broadcast error (ignored)", {
      channelName: `notifications:user-${recipientId}`,
      notificationId: notification.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
