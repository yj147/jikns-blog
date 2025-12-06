import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { NextRequest, NextResponse } from "next/server"
import { authLogger } from "@/lib/utils/logger"

const COOKIE_NAME = "oauth_state"
const COOKIE_PATH = "/auth/callback"
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const SECRET_ENV_KEYS = ["OAUTH_STATE_SECRET", "NEXTAUTH_SECRET"]

type OAuthStateToken = {
  state: string
  issuedAt: number
  signature: string
}

type ValidationReason =
  | "missing_state_param"
  | "missing_cookie"
  | "invalid_format"
  | "invalid_signature"
  | "mismatch"
  | "expired"

export type OAuthStateValidationResult =
  | { isValid: true; clearCookie: (response: NextResponse) => void }
  | { isValid: false; reason: ValidationReason; clearCookie: (response: NextResponse) => void }

let cachedSecret: string | null = null

function getSigningSecret(): string {
  if (cachedSecret) return cachedSecret

  for (const key of SECRET_ENV_KEYS) {
    const candidate = process.env[key]
    if (candidate && candidate.trim().length > 0) {
      cachedSecret = candidate
      return cachedSecret
    }
  }

  throw new Error(`Missing OAuth state signing secret. Set ${SECRET_ENV_KEYS.join(" or ")}.`)
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex")
}

function buildCookieValue(token: OAuthStateToken): string {
  return `${token.state}.${token.issuedAt}.${token.signature}`
}

function parseCookieValue(raw: string | undefined): OAuthStateToken | null {
  if (!raw) return null
  const parts = raw.split(".")
  if (parts.length !== 3) return null

  const [state, issuedAtStr, signature] = parts
  const issuedAt = Number(issuedAtStr)
  if (!state || Number.isNaN(issuedAt) || !signature) {
    return null
  }

  return { state, issuedAt, signature }
}

function safeEquals(expected: string, provided: string): boolean {
  try {
    const expectedBuf = Buffer.from(expected)
    const providedBuf = Buffer.from(provided)
    if (expectedBuf.length !== providedBuf.length) {
      return false
    }
    return timingSafeEqual(expectedBuf, providedBuf)
  } catch {
    return false
  }
}

export function generateOAuthState(): OAuthStateToken {
  const state = randomBytes(24).toString("hex")
  const issuedAt = Date.now()
  const signature = sign(`${state}.${issuedAt}`)

  return { state, issuedAt, signature }
}

export function setOAuthStateCookie(response: NextResponse, token: OAuthStateToken) {
  const maxAgeSeconds = Math.floor(STATE_TTL_MS / 1000)
  response.cookies.set({
    name: COOKIE_NAME,
    value: buildCookieValue(token),
    path: COOKIE_PATH,
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
  })
}

export function validateOAuthState(
  request: NextRequest,
  providedState: string | null
): OAuthStateValidationResult {
  const clearCookie = (response: NextResponse) => {
    response.cookies.set({
      name: COOKIE_NAME,
      value: "",
      path: COOKIE_PATH,
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "lax",
      expires: new Date(0),
      maxAge: 0,
    })
  }

  if (!providedState) {
    return { isValid: false, reason: "missing_state_param", clearCookie }
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value
  const parsed = parseCookieValue(cookieValue)

  if (!parsed) {
    return { isValid: false, reason: "missing_cookie", clearCookie }
  }

  const expectedSignature = sign(`${parsed.state}.${parsed.issuedAt}`)

  if (!safeEquals(expectedSignature, parsed.signature)) {
    authLogger.warn("OAuth state signature mismatch")
    return { isValid: false, reason: "invalid_signature", clearCookie }
  }

  if (!safeEquals(parsed.state, providedState)) {
    return { isValid: false, reason: "mismatch", clearCookie }
  }

  if (Date.now() - parsed.issuedAt > STATE_TTL_MS) {
    return { isValid: false, reason: "expired", clearCookie }
  }

  return { isValid: true, clearCookie }
}
