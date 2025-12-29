import { createHash, randomBytes } from "crypto"
import { EmailSubscriptionStatus } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/services/resend"
import VerificationEmail from "@/emails/verification-email"
import { logger } from "@/lib/utils/logger"

const VERIFY_TOKEN_TTL_MS =
  Number(process.env.EMAIL_VERIFY_TTL_MS ?? 24 * 60 * 60 * 1000) || 24 * 60 * 60 * 1000
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export type SubscriptionErrorCode =
  | "INVALID_EMAIL"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "ALREADY_VERIFIED"
  | "NOT_FOUND"

export class SubscriptionError extends Error {
  code: SubscriptionErrorCode
  status: number

  constructor(message: string, code: SubscriptionErrorCode, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

interface TokenPair {
  token: string
  hash: string
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email)

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

const generateToken = (): TokenPair => {
  const token = randomBytes(32).toString("hex")
  return {
    token,
    hash: hashToken(token),
  }
}

function isEmailServiceConfigError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message === "Resend client is not configured" ||
    error.message === "EMAIL_FROM is not configured"
  )
}

async function sendVerificationEmail(input: {
  email: string
  token: string
  unsubscribeToken: string
}) {
  const verificationLink = `${APP_URL}/api/subscribe/verify?token=${input.token}`
  const unsubscribeLink = `${APP_URL}/api/subscribe/unsubscribe?token=${input.unsubscribeToken}`

  await sendEmail({
    to: input.email,
    subject: "确认订阅 Jikns Blog",
    react: VerificationEmail({
      verificationLink,
      unsubscribeLink,
    }),
  })
}

export async function getSubscriberByEmail(email: string) {
  const normalized = normalizeEmail(email)
  return prisma.emailSubscriber.findUnique({ where: { email: normalized } })
}

export async function createSubscription(email: string, userId?: string) {
  if (!email || !isValidEmail(email)) {
    throw new SubscriptionError("邮箱格式不正确", "INVALID_EMAIL")
  }

  const normalizedEmail = normalizeEmail(email)
  const existing = await prisma.emailSubscriber.findUnique({ where: { email: normalizedEmail } })

  if (existing && existing.status === EmailSubscriptionStatus.VERIFIED) {
    return { subscriber: existing, status: "already_verified" as const }
  }

  const verifyToken = generateToken()
  const unsubscribeToken = generateToken()
  const verifyExpiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS)

  const data = {
    email: normalizedEmail,
    userId: userId ?? existing?.userId ?? null,
    status: EmailSubscriptionStatus.PENDING,
    verifyTokenHash: verifyToken.hash,
    verifyExpiresAt,
    unsubscribeTokenHash: unsubscribeToken.hash,
    verifiedAt: null,
  }

  const subscriber = existing
    ? await prisma.emailSubscriber.update({ where: { id: existing.id }, data })
    : await prisma.emailSubscriber.create({ data })

  try {
    await sendVerificationEmail({
      email: normalizedEmail,
      token: verifyToken.token,
      unsubscribeToken: unsubscribeToken.token,
    })
  } catch (error) {
    if (!isEmailServiceConfigError(error)) {
      throw error
    }

    logger.warn("Email service not configured; skipping verification email", {
      email: normalizedEmail,
    })
  }

  return {
    subscriber,
    verificationToken: verifyToken.token,
    unsubscribeToken: unsubscribeToken.token,
  }
}

export async function verifySubscription(token: string) {
  if (!token) {
    throw new SubscriptionError("无效的验证链接", "INVALID_TOKEN")
  }

  const hashed = hashToken(token)
  const subscriber = await prisma.emailSubscriber.findFirst({
    where: { verifyTokenHash: hashed },
  })

  if (!subscriber) {
    throw new SubscriptionError("验证链接无效", "INVALID_TOKEN")
  }

  if (!subscriber.verifyExpiresAt || subscriber.verifyExpiresAt.getTime() < Date.now()) {
    throw new SubscriptionError("验证链接已过期", "TOKEN_EXPIRED")
  }

  const updated = await prisma.emailSubscriber.update({
    where: { id: subscriber.id },
    data: {
      status: EmailSubscriptionStatus.VERIFIED,
      verifiedAt: new Date(),
      verifyTokenHash: null,
      verifyExpiresAt: null,
    },
  })

  return updated
}

export async function unsubscribe(token: string) {
  if (!token) {
    throw new SubscriptionError("无效的退订链接", "INVALID_TOKEN")
  }

  const hashed = hashToken(token)
  const subscriber = await prisma.emailSubscriber.findFirst({
    where: {
      OR: [{ unsubscribeTokenHash: hashed }, { unsubscribeTokenHash: token }],
    },
  })

  if (!subscriber) {
    throw new SubscriptionError("退订链接无效", "NOT_FOUND")
  }

  const updated = await prisma.emailSubscriber.update({
    where: { id: subscriber.id },
    data: {
      status: EmailSubscriptionStatus.UNSUBSCRIBED,
      verifyTokenHash: null,
      verifyExpiresAt: null,
    },
  })

  return updated
}

export async function unsubscribeByEmail(email: string) {
  if (!email || !isValidEmail(email)) {
    throw new SubscriptionError("邮箱格式不正确", "INVALID_EMAIL")
  }

  const normalized = normalizeEmail(email)
  const subscriber = await prisma.emailSubscriber.findUnique({
    where: { email: normalized },
  })

  if (!subscriber) {
    return null
  }

  if (subscriber.status === EmailSubscriptionStatus.UNSUBSCRIBED) {
    return subscriber
  }

  return prisma.emailSubscriber.update({
    where: { id: subscriber.id },
    data: {
      status: EmailSubscriptionStatus.UNSUBSCRIBED,
      verifyTokenHash: null,
      verifyExpiresAt: null,
    },
  })
}
