import { randomBytes } from "node:crypto"
import type { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "oauth_state"
const COOKIE_PATH = "/auth/callback"
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

type OAuthStateToken = {
  state: string
  issuedAt: number
}

type ValidationReason = "missing_state_param" | "missing_cookie" | "mismatch" | "expired"

export type OAuthStateValidationResult =
  | { isValid: true; clearCookie: (response: NextResponse) => void }
  | { isValid: false; reason: ValidationReason; clearCookie: (response: NextResponse) => void }

function buildCookieValue(token: OAuthStateToken): string {
  return `${token.state}.${token.issuedAt}`
}

function parseCookieValue(raw: string | undefined): OAuthStateToken | null {
  if (!raw) return null
  const parts = raw.split(".")
  // 兼容旧格式：state.issuedAt.signature
  if (parts.length !== 2 && parts.length !== 3) return null

  const [state, issuedAtStr] = parts
  const issuedAt = Number(issuedAtStr)
  if (!state || Number.isNaN(issuedAt)) {
    return null
  }

  return { state, issuedAt }
}

export function generateOAuthState(): OAuthStateToken {
  const state = randomBytes(24).toString("hex")
  const issuedAt = Date.now()
  return { state, issuedAt }
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

  if (parsed.state !== providedState) {
    return { isValid: false, reason: "mismatch", clearCookie }
  }

  if (Date.now() - parsed.issuedAt > STATE_TTL_MS) {
    return { isValid: false, reason: "expired", clearCookie }
  }

  return { isValid: true, clearCookie }
}
