import { describe, it, expect, beforeEach, vi } from "vitest"
import { NotificationType } from "@/lib/generated/prisma"

let userFindUnique: ReturnType<typeof vi.fn>
let notificationCreate: ReturnType<typeof vi.fn>
let notificationUpdateMany: ReturnType<typeof vi.fn>
let notificationCount: ReturnType<typeof vi.fn>

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

const { notify, markAsRead, getUnreadCount } = await import("@/lib/services/notification")

describe("notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()

    userFindUnique.mockReset()
    notificationCreate.mockReset()
    notificationUpdateMany.mockReset()
    notificationCount.mockReset()
  })

  describe("notify", () => {
    it("throws when actorId is missing", async () => {
      // @ts-expect-error 允许故意传入不合法数据以覆盖异常分支
      await expect(notify("recipient-1", NotificationType.LIKE, { actorId: undefined })).rejects.toThrow(
        "actorId is required to create notification"
      )
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
