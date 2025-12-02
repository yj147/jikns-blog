import type { EmailQueue, EmailSubscriber } from "@/lib/generated/prisma"
import { EmailQueueStatus, EmailSubscriptionStatus, NotificationType } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import {
  resolveNotificationPreference,
  type NotificationPreferencesInput,
} from "@/types/user-settings"

const normalizeEmail = (email: string) => email.trim().toLowerCase()

async function findVerifiedSubscriber(recipientId: string): Promise<EmailSubscriber | null> {
  const byUser = await prisma.emailSubscriber.findFirst({
    where: { userId: recipientId, status: EmailSubscriptionStatus.VERIFIED },
  })
  if (byUser) return byUser

  const user = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { email: true },
  })

  if (!user?.email) return null

  const email = normalizeEmail(user.email)

  return prisma.emailSubscriber.findFirst({
    where: { email, status: EmailSubscriptionStatus.VERIFIED },
  })
}

export async function enqueueEmailNotification(
  recipientId: string,
  type: NotificationType,
  data: Record<string, any>,
  notificationId?: string
): Promise<EmailQueue | null> {
  const subscriber = await findVerifiedSubscriber(recipientId)
  if (!subscriber) return null

  const enabled = resolveNotificationPreference(
    (subscriber.preferences as NotificationPreferencesInput) ?? {},
    type
  )
  if (!enabled) return null

  return prisma.emailQueue.create({
    data: {
      subscriberId: subscriber.id,
      type,
      payload: data,
      status: EmailQueueStatus.PENDING,
      notificationId: notificationId ?? null,
      postId: (data as { postId?: string | null })?.postId ?? null,
    },
  })
}

export async function enqueueNewPostNotification(postId: string): Promise<EmailQueue> {
  if (!postId) {
    throw new Error("postId is required to enqueue new post notification")
  }

  return prisma.emailQueue.create({
    data: {
      subscriberId: null,
      type: NotificationType.NEW_POST,
      payload: { postId },
      status: EmailQueueStatus.PENDING,
      notificationId: null,
      postId,
    },
  })
}
