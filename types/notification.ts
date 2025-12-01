import { z } from "zod"
import { NotificationType } from "@/lib/generated/prisma"

export const notificationTypeSchema = z.nativeEnum(NotificationType)

const nullableDateSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return value
    }
    return new Date(value as any)
  },
  z.date().nullable().optional()
)

const requiredDateSchema = z.preprocess((value) => new Date(value as any), z.date())

export const notificationSchema = z.object({
  id: z.string().uuid(),
  recipientId: z.string().uuid(),
  actorId: z.string().uuid(),
  type: notificationTypeSchema,
  postId: z.string().uuid().nullable().optional(),
  commentId: z.string().uuid().nullable().optional(),
  readAt: nullableDateSchema,
  createdAt: requiredDateSchema,
})

export type NotificationInput = z.input<typeof notificationSchema>
export type NotificationRecord = z.output<typeof notificationSchema>

export const normalizeNotification = (value: NotificationInput): NotificationRecord =>
  notificationSchema.parse(value)

export const isNotificationUnread = (notification: NotificationRecord): boolean =>
  notification.readAt === null || notification.readAt === undefined
