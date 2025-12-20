import { describe, it, expect, beforeEach, vi } from "vitest"
import { NotificationType } from "@/lib/generated/prisma"

let userFindUnique: ReturnType<typeof vi.fn>
let notificationCreate: ReturnType<typeof vi.fn>
let notificationUpdateMany: ReturnType<typeof vi.fn>
let notificationCount: ReturnType<typeof vi.fn>
let createServiceRoleClientMock: ReturnType<typeof vi.fn>
let supabaseChannelMock: ReturnType<typeof vi.fn>
let supabaseChannelSendMock: ReturnType<typeof vi.fn>
let supabaseRemoveChannelMock: ReturnType<typeof vi.fn>
let enqueueEmailNotificationMock: ReturnType<typeof vi.fn>

vi.mock("@/lib/prisma", () => {
  userFindUnique = vi.fn()
  notificationCreate = vi.fn()
  notificationUpdateMany = vi.fn()
  notificationCount = vi.fn()

  return {
    prisma: {
      user: {
        findUnique: userFindUnique,
      },
      notification: {
        create: notificationCreate,
        updateMany: notificationUpdateMany,
        count: notificationCount,
      },
    },
  }
})

vi.mock("@/lib/supabase", () => {
  supabaseChannelSendMock = vi.fn().mockResolvedValue("ok")
  supabaseRemoveChannelMock = vi.fn().mockResolvedValue(undefined)
  supabaseChannelMock = vi.fn(() => ({
    send: supabaseChannelSendMock,
    subscribe: vi.fn((callback) => {
      // 同步触发 SUBSCRIBED 状态
      Promise.resolve().then(() => callback("SUBSCRIBED"))
      return { unsubscribe: vi.fn() }
    }),
  }))

  const client = {
    channel: supabaseChannelMock,
    removeChannel: supabaseRemoveChannelMock,
  }

  createServiceRoleClientMock = vi.fn(() => client)

  return {
    createServiceRoleClient: createServiceRoleClientMock,
  }
})

vi.mock("@/lib/services/email-queue", () => {
  enqueueEmailNotificationMock = vi.fn().mockResolvedValue(null)
  return {
    enqueueEmailNotification: enqueueEmailNotificationMock,
  }
})

const { notify, markAsRead, getUnreadCount } = await import("@/lib/services/notification")

describe("notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()

    userFindUnique.mockReset()
    notificationCreate.mockReset()
    notificationUpdateMany.mockReset()
    notificationCount.mockReset()
    createServiceRoleClientMock.mockReset()
    supabaseChannelMock.mockReset()
    supabaseChannelSendMock.mockReset()
    supabaseChannelSendMock.mockResolvedValue("ok")
    supabaseRemoveChannelMock.mockReset()
    supabaseChannelMock.mockImplementation(() => ({
      send: supabaseChannelSendMock,
      subscribe: vi.fn(),
    }))
    createServiceRoleClientMock.mockImplementation(() => ({
      channel: supabaseChannelMock,
      removeChannel: supabaseRemoveChannelMock,
    }))
    supabaseRemoveChannelMock.mockResolvedValue(undefined)
    enqueueEmailNotificationMock.mockReset()
    enqueueEmailNotificationMock.mockResolvedValue(null)
  })

  describe("notify", () => {
    it("throws when actorId is missing", async () => {
      // @ts-expect-error 允许故意传入不合法数据以覆盖异常分支
      await expect(
        notify("recipient-1", NotificationType.LIKE, { actorId: undefined })
      ).rejects.toThrow("actorId is required to create notification")
      expect(notificationCreate).not.toHaveBeenCalled()
    })

    it("returns null when user disabled the notification type", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: { LIKE: false },
      })

      const result = await notify("recipient-2", NotificationType.LIKE, { actorId: "actor-1" })

      expect(result).toBeNull()
      expect(notificationCreate).not.toHaveBeenCalled()
      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: "recipient-2" },
        select: { notificationPreferences: true },
      })
    })

    it("creates notification with optional ids defaulting to null", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: {},
      })

      const created = {
        id: "notif-1",
        recipientId: "recipient-3",
        actorId: "actor-2",
        type: NotificationType.COMMENT,
        postId: null,
        commentId: null,
      }
      notificationCreate.mockResolvedValueOnce(created as any)

      const result = await notify("recipient-3", NotificationType.COMMENT, { actorId: "actor-2" })

      expect(result).toBe(created)
      expect(notificationCreate).toHaveBeenCalledWith({
        data: {
          recipientId: "recipient-3",
          actorId: "actor-2",
          type: NotificationType.COMMENT,
          postId: null,
          commentId: null,
          activityId: null,
        },
      })
    })

    it("passes through provided postId and commentId", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: { COMMENT: true },
      })

      notificationCreate.mockResolvedValueOnce({ id: "notif-2" } as any)

      await notify("recipient-4", NotificationType.COMMENT, {
        actorId: "actor-3",
        postId: "post-1",
        commentId: "comment-9",
      })

      expect(notificationCreate).toHaveBeenCalledWith({
        data: {
          recipientId: "recipient-4",
          actorId: "actor-3",
          type: NotificationType.COMMENT,
          postId: "post-1",
          commentId: "comment-9",
          activityId: null,
        },
      })
    })

    it("broadcasts notification after creation", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: {},
      })

      const created = {
        id: "notif-broadcast",
        recipientId: "recipient-5",
        actorId: "actor-9",
        type: NotificationType.LIKE,
        postId: null,
        commentId: null,
        activityId: "activity-1",
        readAt: null,
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      }

      notificationCreate.mockResolvedValueOnce(created as any)

      await notify("recipient-5", NotificationType.LIKE, {
        actorId: "actor-9",
        activityId: "activity-1",
      })

      expect(createServiceRoleClientMock).toHaveBeenCalled()
      expect(supabaseChannelMock).toHaveBeenCalledWith("notifications:user-recipient-5", {
        config: { broadcast: { self: false } },
      })
      expect(supabaseChannelSendMock).toHaveBeenCalledWith({
        type: "broadcast",
        event: "INSERT",
        payload: expect.objectContaining({
          id: created.id,
          activityId: created.activityId,
          readAt: null,
          createdAt: created.createdAt.toISOString(),
        }),
      })
      expect(supabaseRemoveChannelMock).toHaveBeenCalled()
    })

    it("enqueues email notification without blocking notify", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: {},
      })

      const created = {
        id: "notif-email-1",
        recipientId: "recipient-7",
        actorId: "actor-email",
        type: NotificationType.LIKE,
        postId: "post-email",
        commentId: null,
        activityId: null,
        readAt: null,
        createdAt: new Date("2025-01-04T00:00:00.000Z"),
      }

      notificationCreate.mockResolvedValueOnce(created as any)

      await notify("recipient-7", NotificationType.LIKE, {
        actorId: "actor-email",
        postId: "post-email",
      })

      expect(enqueueEmailNotificationMock).toHaveBeenCalledWith(
        "recipient-7",
        NotificationType.LIKE,
        { actorId: "actor-email", postId: "post-email" },
        created.id
      )
    })

    it("ignores email queue errors", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: {},
      })

      const created = {
        id: "notif-email-error",
        recipientId: "recipient-8",
        actorId: "actor-email-err",
        type: NotificationType.FOLLOW,
        postId: null,
        commentId: null,
        activityId: null,
        readAt: null,
        createdAt: new Date("2025-01-05T00:00:00.000Z"),
      }

      notificationCreate.mockResolvedValueOnce(created as any)
      enqueueEmailNotificationMock.mockRejectedValueOnce(new Error("queue-fail"))

      await expect(
        notify("recipient-8", NotificationType.FOLLOW, { actorId: "actor-email-err" })
      ).resolves.toBeTruthy()
    })

    it("ignores broadcast errors without failing notify", async () => {
      userFindUnique.mockResolvedValueOnce({
        notificationPreferences: {},
      })

      notificationCreate.mockResolvedValueOnce({
        id: "notif-error",
        recipientId: "recipient-6",
        actorId: "actor-error",
        type: NotificationType.LIKE,
        postId: null,
        commentId: null,
        activityId: null,
        readAt: null,
        createdAt: new Date("2025-01-03T00:00:00.000Z"),
      } as any)

      supabaseChannelSendMock.mockResolvedValueOnce("error")

      await expect(
        notify("recipient-6", NotificationType.LIKE, { actorId: "actor-error" })
      ).resolves.toBeTruthy()
    })
  })

  describe("markAsRead", () => {
    it("returns 0 for empty id list", async () => {
      const result = await markAsRead([])

      expect(result).toBe(0)
      expect(notificationUpdateMany).not.toHaveBeenCalled()
    })

    it("updates only unread notifications and returns count", async () => {
      const ids = ["n-1", "n-2"]
      const now = new Date("2025-01-01T12:00:00.000Z")
      vi.useFakeTimers()
      vi.setSystemTime(now)

      notificationUpdateMany.mockResolvedValueOnce({ count: 2 })

      const result = await markAsRead(ids)

      expect(result).toBe(2)
      expect(notificationUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ids }, readAt: null },
        data: { readAt: now },
      })
    })
  })

  describe("getUnreadCount", () => {
    it("returns 0 when user has no notifications", async () => {
      notificationCount.mockResolvedValueOnce(0)

      const result = await getUnreadCount("user-empty")

      expect(result).toBe(0)
      expect(notificationCount).toHaveBeenCalledWith({
        where: { recipientId: "user-empty", readAt: null },
      })
    })

    it("counts unread notifications across all types", async () => {
      notificationCount.mockResolvedValueOnce(3)

      const result = await getUnreadCount("user-mixed")

      expect(result).toBe(3)
      expect(notificationCount).toHaveBeenCalledWith({
        where: { recipientId: "user-mixed", readAt: null },
      })
    })
  })
})
