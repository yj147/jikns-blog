import { Resend } from "resend"
import { logger } from "@/lib/utils/logger"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const DEFAULT_FROM = process.env.EMAIL_FROM

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  react?: any
  text?: string
  from?: string
  replyTo?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
}

export function getResendClient(): Resend {
  if (!resendClient) {
    throw new Error("Resend client is not configured")
  }
  return resendClient
}

export async function sendEmail(options: SendEmailOptions) {
  const from = options.from ?? DEFAULT_FROM
  if (!from) {
    throw new Error("EMAIL_FROM is not configured")
  }
  if (!options.react && !options.html && !options.text) {
    throw new Error("Email content is required (react/html/text)")
  }

  const { react, html, text, ...rest } = options
  const client = getResendClient()

  try {
    const payload = {
      ...rest,
      from,
      ...(react ? { react } : {}),
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    } as Parameters<typeof client.emails.send>[0]

    return await client.emails.send(payload)
  } catch (error) {
    logger.error("Failed to send email via Resend", { to: options.to }, error as any)
    throw error
  }
}
