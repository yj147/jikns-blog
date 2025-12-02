import DigestEmail from "@/emails/digest-email"
import NotificationEmail from "@/emails/notification-email"
import type { EmailQueue, EmailSubscriber } from "@/lib/generated/prisma"
import {
  EmailQueueStatus,
  EmailSubscriptionStatus,
  NotificationType,
} from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/services/resend"
import { logger } from "@/lib/utils/logger"

const queueLogger = logger.child({ module: "email-queue" })
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

type QueueStats = {
  processed: number
  sent: number
  failed: number
}

type NotificationPayload = {
  actorId?: string
  postId?: string | null
  activityId?: string | null
  commentId?: string | null
}

const buildUnsubscribeLink = (subscriber: Pick<EmailSubscriber, "unsubscribeTokenHash">) => {
  const token = subscriber.unsubscribeTokenHash ?? ""
  return `${APP_URL}/unsubscribe?token=${token}`
}

const resolveActorName = async (actorId?: string | null) => {
  if (!actorId) return "有人"
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true, email: true },
  })
  if (!actor) return "有人"
  return actor.name || actor.email || "有人"
}

const resolvePostInfo = async (postId?: string | null) => {
  if (!postId) return null
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true, title: true, excerpt: true },
  })
  if (!post) return null

  const slug = post.slug || postId
  return {
    url: `${APP_URL}/blog/${slug}`,
    title: post.title,
    excerpt: post.excerpt ?? undefined,
    isActivity: false,
  }
}

const resolveActivityInfo = async (activityId?: string | null) => {
  if (!activityId) return null
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, content: true },
  })
  if (!activity) return null

  return {
    url: `${APP_URL}/feed#activity-${activity.id}`,
    title: "动态",
    excerpt: activity.content?.slice(0, 100) ?? undefined,
    isActivity: true,
  }
}

const resolveCommentTarget = async (commentId?: string | null) => {
  if (!commentId) return { activityId: null, postId: null }
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { activityId: true, postId: true },
  })
  return { activityId: comment?.activityId ?? null, postId: comment?.postId ?? null }
}

const buildNotificationCopy = async (queue: EmailQueue) => {
  const payload = (queue.payload ?? {}) as NotificationPayload
  const actor = await resolveActorName(payload.actorId)

  // 如果有 commentId，通过 comment 追溯目标
  const commentTarget = await resolveCommentTarget(payload.commentId)
  const activityId = payload.activityId || commentTarget.activityId
  const postId = payload.postId || commentTarget.postId

  // 优先使用动态，其次使用文章
  const activity = await resolveActivityInfo(activityId)
  const post = await resolvePostInfo(postId)
  const target = activity || post

  const title = "你有新的通知"
  let message = "你有一条新的站内通知"
  const contentType = target?.isActivity ? "动态" : "文章"

  switch (queue.type) {
    case NotificationType.LIKE:
      message = `${actor} 点赞了你的${contentType}`
      break
    case NotificationType.COMMENT:
      message = `${actor} 评论了你的${contentType}`
      break
    case NotificationType.FOLLOW:
      message = `${actor} 关注了你`
      break
    case NotificationType.SYSTEM:
      message = "你收到一条系统通知"
      break
    default:
      message = "你有新的消息"
  }

  return {
    title,
    message,
    actionLink: target?.url ?? `${APP_URL}/notifications`,
  }
}

async function markFailed(queue: EmailQueue, error: unknown) {
  const attempts = queue.attempts + 1
  const status = attempts >= 3 ? EmailQueueStatus.FAILED : EmailQueueStatus.PENDING

  await prisma.emailQueue.update({
    where: { id: queue.id },
    data: {
      attempts,
      status,
      lastError: error instanceof Error ? error.message : String(error),
    },
  })
}

async function markSent(queue: EmailQueue) {
  await prisma.emailQueue.update({
    where: { id: queue.id },
    data: {
      status: EmailQueueStatus.SENT,
      sentAt: new Date(),
      lastError: null,
    },
  })
}

async function sendSingleNotification(queue: EmailQueue) {
  if (!queue.subscriberId) {
    throw new Error("subscriberId is required for notification emails")
  }

  const subscriber = await prisma.emailSubscriber.findUnique({
    where: { id: queue.subscriberId },
    select: { email: true, status: true, unsubscribeTokenHash: true },
  })

  if (!subscriber || subscriber.status !== EmailSubscriptionStatus.VERIFIED) {
    throw new Error("subscriber not found or not verified")
  }

  const { title, message, actionLink } = await buildNotificationCopy(queue)

  await sendEmail({
    to: subscriber.email,
    subject: "Jikns Blog 通知",
    react: NotificationEmail({
      title,
      message,
      actionLink,
      unsubscribeLink: buildUnsubscribeLink(subscriber),
    }),
  })

  await markSent(queue)
}

async function sendNewPostBroadcast(queue: EmailQueue) {
  const payload = (queue.payload ?? {}) as { postId?: string }
  const post = await resolvePostInfo(payload.postId)
  if (!post) {
    throw new Error("post not found for NEW_POST notification")
  }

  const subscribers = await prisma.emailSubscriber.findMany({
    where: { status: EmailSubscriptionStatus.VERIFIED },
    select: { email: true, unsubscribeTokenHash: true, id: true },
  })

  if (subscribers.length === 0) {
    await markSent(queue)
    return
  }

  const errors: string[] = []
  for (const subscriber of subscribers) {
    try {
      await sendEmail({
        to: subscriber.email,
        subject: `新文章发布：${post.title}`,
        react: DigestEmail({
          posts: [{ title: post.title, url: post.url, excerpt: post.excerpt }],
          unsubscribeLink: buildUnsubscribeLink(subscriber),
        }),
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (errors.length > 0) {
    throw new Error(errors[0])
  }

  await markSent(queue)
}

export async function processEmailQueue(): Promise<QueueStats> {
  const pending = await prisma.emailQueue.findMany({
    where: { status: EmailQueueStatus.PENDING, attempts: { lt: 3 } },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  })

  const stats: QueueStats = { processed: 0, sent: 0, failed: 0 }

  if (pending.length === 0) {
    return stats
  }

  for (const queue of pending) {
    stats.processed += 1
    try {
      await prisma.emailQueue.update({
        where: { id: queue.id },
        data: { status: EmailQueueStatus.SENDING },
      })

      if (queue.type === NotificationType.NEW_POST) {
        await sendNewPostBroadcast(queue)
      } else {
        await sendSingleNotification(queue)
      }

      stats.sent += 1
    } catch (error) {
      stats.failed += 1
      await markFailed(queue, error)
      queueLogger.warn("Email queue item failed", {
        id: queue.id,
        type: queue.type,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return stats
}
