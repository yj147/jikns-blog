import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import {
  createSubscription,
  SubscriptionError,
  unsubscribe,
  verifySubscription,
} from "@/lib/services/email-subscription"
import { prisma, resetPrismaMocks } from "@/tests/__mocks__/prisma"
import VerificationEmail from "@/emails/verification-email"
import NotificationEmail from "@/emails/notification-email"
import DigestEmail from "@/emails/digest-email"
import { EmailSubscriptionStatus } from "@/lib/generated/prisma"
import * as resendService from "@/lib/services/resend"

vi.mock("@/lib/services/resend", () => ({
  sendEmail: vi.fn(async () => ({ id: "mock-email-id" })),
}))

const mockedSendEmail = vi.mocked(resendService.sendEmail)

describe("email-subscription service", () => {
  beforeEach(() => {
    resetPrismaMocks()
    mockedSendEmail.mockClear()
  })

  it("creates a new subscription and sends verification email", async () => {
    const result = await createSubscription("newuser@example.com")

    expect(result.subscriber.email).toBe("newuser@example.com")
    expect(result.subscriber.status).toBe(EmailSubscriptionStatus.PENDING)
    expect(result.verificationToken).toBeTruthy()
    expect(result.unsubscribeToken).toBeTruthy()
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "newuser@example.com" })
    )
  })

  it("verifies a pending subscription", async () => {
    const { verificationToken, subscriber } = await createSubscription("verifyme@example.com")

    const verified = await verifySubscription(verificationToken)

    expect(verified.id).toBe(subscriber.id)
    expect(verified.status).toBe(EmailSubscriptionStatus.VERIFIED)
  })

  it("throws when verification token expired", async () => {
    const { verificationToken, subscriber } = await createSubscription("expire@example.com")

    await prisma.emailSubscriber.update({
      where: { id: subscriber.id },
      data: { verifyExpiresAt: new Date(Date.now() - 1000) },
    })

    await expect(verifySubscription(verificationToken)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    })
  })

  it("unsubscribes with valid token", async () => {
    const { unsubscribeToken, subscriber } = await createSubscription("leave@example.com")
    const updated = await unsubscribe(unsubscribeToken)

    expect(updated.id).toBe(subscriber.id)
    expect(updated.status).toBe(EmailSubscriptionStatus.UNSUBSCRIBED)
  })

  it("allows resubscribe after unsubscribe", async () => {
    const first = await createSubscription("come-back@example.com")
    await unsubscribe(first.unsubscribeToken)

    const second = await createSubscription("come-back@example.com")
    expect(second.subscriber.status).toBe(EmailSubscriptionStatus.PENDING)
    expect(mockedSendEmail).toHaveBeenCalledTimes(2)
  })
})

describe("email templates", () => {
  it("renders verification email with links", () => {
    const verifyLink = "http://localhost/api/subscribe/verify?token=abc"
    const unsubLink = "http://localhost/api/subscribe/unsubscribe?token=xyz"
    const html = renderToStaticMarkup(
      <VerificationEmail verificationLink={verifyLink} unsubscribeLink={unsubLink} />
    )
    expect(html).toContain(verifyLink)
    expect(html).toContain(unsubLink)
  })

  it("renders notification email content", () => {
    const unsubLink = "http://localhost/unsub"
    const html = renderToStaticMarkup(
      <NotificationEmail
        title="新评论"
        message="有人评论了你的文章"
        actionLink="http://localhost/comment"
        unsubscribeLink={unsubLink}
      />
    )
    expect(html).toContain("新评论")
    expect(html).toContain(unsubLink)
  })

  it("renders digest email list", () => {
    const unsubLink = "http://localhost/unsub"
    const html = renderToStaticMarkup(
      <DigestEmail
        unsubscribeLink={unsubLink}
        posts={[
          { title: "文章1", url: "http://localhost/p1", excerpt: "摘要1" },
          { title: "文章2", url: "http://localhost/p2" },
        ]}
      />
    )
    expect(html).toContain("文章1")
    expect(html).toContain("摘要1")
    expect(html).toContain(unsubLink)
  })
})
