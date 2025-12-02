import { beforeEach, describe, expect, it, vi } from "vitest"
import { processEmailQueue } from "@/lib/cron/email-queue"
import {
  EmailQueueStatus,
  EmailSubscriptionStatus,
  NotificationType,
} from "@/lib/generated/prisma"
import * as resendService from "@/lib/services/resend"
import { prisma, resetPrismaMocks } from "@/tests/__mocks__/prisma"

vi.mock("@/lib/services/resend", () => ({
  sendEmail: vi.fn(async () => ({ id: "mock-email" })),
}))

const mockedSendEmail = vi.mocked(resendService.sendEmail)

describe("processEmailQueue", () => {
  beforeEach(() => {
    resetPrismaMocks()
    mockedSendEmail.mockClear()
  })

  it("sends pending notification items", async () => {
    const subscriber = await prisma.emailSubscriber.create({
      data: {
        email: "notify@test.com",
        status: EmailSubscriptionStatus.VERIFIED,
        unsubscribeTokenHash: "unsub-token-1",
      },
    })

    await prisma.user.create({
      data: { id: "actor-1", email: "actor@test.com", name: "Test Actor" },
    })

    await prisma.emailQueue.create({
      data: {
        subscriberId: subscriber.id,
        type: NotificationType.COMMENT,
        payload: { actorId: "actor-1", postId: "post-1" },
        status: EmailQueueStatus.PENDING,
      },
    })

    const stats = await processEmailQueue()

    expect(stats).toEqual({ processed: 1, sent: 1, failed: 0 })
    expect(mockedSendEmail).toHaveBeenCalledTimes(1)

    const queues = await prisma.emailQueue.findMany({})
    expect(queues[0].status).toBe(EmailQueueStatus.SENT)
    expect(queues[0].sentAt).toBeInstanceOf(Date)
  })

  it("broadcasts NEW_POST to verified subscribers", async () => {
    await prisma.post.create({
      data: { id: "post-xyz", slug: "hello-world", title: "Hello World", published: true },
    })

    const subs = await Promise.all([
      prisma.emailSubscriber.create({
        data: { email: "a@test.com", status: EmailSubscriptionStatus.VERIFIED },
      }),
      prisma.emailSubscriber.create({
        data: { email: "b@test.com", status: EmailSubscriptionStatus.VERIFIED },
      }),
    ])

    await prisma.emailQueue.create({
      data: {
        type: NotificationType.NEW_POST,
        payload: { postId: "post-xyz" },
        status: EmailQueueStatus.PENDING,
      },
    })

    const stats = await processEmailQueue()

    expect(stats.sent).toBe(1)
    expect(mockedSendEmail).toHaveBeenCalledTimes(subs.length)

    const [queue] = await prisma.emailQueue.findMany({})
    expect(queue.status).toBe(EmailQueueStatus.SENT)
  })

  it("marks failed after max attempts", async () => {
    mockedSendEmail.mockRejectedValueOnce(new Error("send failed"))

    const subscriber = await prisma.emailSubscriber.create({
      data: {
        email: "retry@test.com",
        status: EmailSubscriptionStatus.VERIFIED,
        unsubscribeTokenHash: "retry-unsub",
      },
    })

    const queue = await prisma.emailQueue.create({
      data: {
        subscriberId: subscriber.id,
        type: NotificationType.LIKE,
        payload: { actorId: "actor-x" },
        status: EmailQueueStatus.PENDING,
        attempts: 2,
      },
    })

    const stats = await processEmailQueue()

    expect(stats.failed).toBe(1)
    const [updated] = await prisma.emailQueue.findMany({ where: { id: queue.id } })
    expect(updated.status).toBe(EmailQueueStatus.FAILED)
    expect(updated.attempts).toBe(3)
    expect(String(updated.lastError)).toContain("send failed")
  })
})
