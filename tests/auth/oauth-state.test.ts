import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState, validateOAuthState } from "@/lib/auth/oauth-state"

const CALLBACK_URL = "http://localhost:3000/auth/callback"
const TEN_MINUTES_MS = 10 * 60 * 1000

function createRequestWithStateCookie(token: ReturnType<typeof generateOAuthState>) {
  const headers = new Headers()
  headers.set("cookie", `oauth_state=${token.state}.${token.issuedAt}.${token.signature}`)
  return new NextRequest(new URL(CALLBACK_URL), { headers })
}

describe("OAuth state 校验", () => {
  beforeEach(() => {
    process.env.OAUTH_STATE_SECRET = "test-oauth-state-secret"
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("缺失 state 参数应返回 missing_state_param", () => {
    const request = new NextRequest(new URL(CALLBACK_URL))
    const result = validateOAuthState(request, null)

    expect(result.isValid).toBe(false)
    expect(result.reason).toBe("missing_state_param")
  })

  it("state 不匹配应返回 mismatch", () => {
    const token = generateOAuthState()
    const request = createRequestWithStateCookie(token)

    const result = validateOAuthState(request, "different-state")

    expect(result.isValid).toBe(false)
    expect(result.reason).toBe("mismatch")
  })

  it("过期的 state 应返回 expired", () => {
    vi.useFakeTimers()
    const issuedAt = new Date("2024-01-01T00:00:00.000Z")
    vi.setSystemTime(issuedAt)

    const token = generateOAuthState()
    const request = createRequestWithStateCookie(token)

    vi.setSystemTime(new Date(issuedAt.getTime() + TEN_MINUTES_MS + 1))

    const result = validateOAuthState(request, token.state)

    expect(result.isValid).toBe(false)
    expect(result.reason).toBe("expired")
  })

  it("有效的 state 应通过校验并可清理 cookie", () => {
    const token = generateOAuthState()
    const request = createRequestWithStateCookie(token)

    const result = validateOAuthState(request, token.state)
    expect(result.isValid).toBe(true)

    const response = new NextResponse(null, { status: 200 })
    result.clearCookie(response)
    const cleared = response.cookies.get("oauth_state")

    expect(cleared?.value).toBe("")
    expect(cleared?.maxAge).toBe(0)
  })
})
