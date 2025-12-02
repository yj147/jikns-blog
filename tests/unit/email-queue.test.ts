import { describe, it, expect, beforeEach, vi } from "vitest"
import { enqueueEmailNotification, enqueueNewPostNotification } from "@/lib/services/email-queue"
import { prisma, resetPrismaMocks } from "@/tests/__mocks__/prisma"
import { EmailSubscriptionStatus, NotificationType } from "@/lib/generated/prisma"

describe("email queue service", () => {
  beforeEach(() => {
    resetPrismaMocks()
    vi.clearAllMocks()
  })

  it("skips enqueue when subscriber does not exist", async () => {
    const result = await enqueueEmailNotification("user-test-id-001", NotificationType.LIKE, {
      actorId: "actor-1",
    })

    expect(result).toBeNull()
    expect(prisma.emailQueue.create).not.toHaveBeenCalled()
  })

  it("skips enqueue when subscriber disabled the type", async () => {
    await prisma.emailSubscriber.create({
      data: {
        email: "user@test.com",
        userId: "user-test-id-001",
        status: EmailSubscriptionStatus.VERIFIED,
        preferences: { LIKE: false },
      },
    })

    const result = await enqueueEmailNotification("user-test-id-001", NotificationType.LIKE, {
      actorId: "actor-2",
    })

    expect(result).toBeNull()
    expect(prisma.emailQueue.create).not.toHaveBeenCalled()
  })

  it("enqueues email notification for verified subscriber", async () => {
    const subscriber = await prisma.emailSubscriber.create({
      data: {
        email: "user@test.com",
        userId: "user-test-id-001",
        status: EmailSubscriptionStatus.VERIFIED,
      },
    })

    const payload = { actorId: "actor-3", postId: "post-1" }

    const queue = await enqueueEmailNotification(
      "user-test-id-001",
      NotificationType.COMMENT,
      payload,
      "notif-123"
    )

    expect(queue?.subscriberId).toBe(subscriber.id)
    expect(prisma.emailQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriberId: subscriber.id,
        type: NotificationType.COMMENT,
        payload,
        status: "PENDING",
        notificationId: "notif-123",
        postId: "post-1",
      }),
    })
  })

  it("finds subscriber by email when userId is missing", async () => {
    await prisma.emailSubscriber.create({
      data: {
        email: "user@test.com",
        status: EmailSubscriptionStatus.VERIFIED,
        preferences: { FOLLOW: true },
      },
    })

    const queue = await enqueueEmailNotification("user-test-id-001", NotificationType.FOLLOW, {
      actorId: "actor-4",
    })

    expect(queue?.type).toBe(NotificationType.FOLLOW)
    expect(prisma.emailQueue.create).toHaveBeenCalled()
  })

  it("creates NEW_POST queue entry with postId", async () => {
    const queue = await enqueueNewPostNotification("post-xyz")

    expect(queue.type).toBe(NotificationType.NEW_POST)
    expect(queue.postId).toBe("post-xyz")
    expect(queue.subscriberId).toBeNull()
    expect(queue.payload).toEqual({ postId: "post-xyz" })
  })
})
