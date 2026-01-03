import { describe, expect, it, afterEach } from "vitest"
import { resolveAuthBaseUrl } from "@/lib/auth/resolve-auth-base-url"
import { createTestRequest } from "../helpers/test-data"

const ORIGINAL_ENV = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
}

afterEach(() => {
  if (ORIGINAL_ENV.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = ORIGINAL_ENV.VERCEL_ENV

  if (ORIGINAL_ENV.VERCEL_GIT_COMMIT_REF === undefined) delete process.env.VERCEL_GIT_COMMIT_REF
  else process.env.VERCEL_GIT_COMMIT_REF = ORIGINAL_ENV.VERCEL_GIT_COMMIT_REF

  if (ORIGINAL_ENV.NEXT_PUBLIC_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SITE_URL
})

describe("resolveAuthBaseUrl", () => {
  it("保留 www 域名，避免 OAuth PKCE cookie 跨域丢失", () => {
    delete process.env.VERCEL_ENV

    const request = createTestRequest("https://www.jikns666.xyz/api/auth/github")
    expect(resolveAuthBaseUrl(request)).toBe("https://www.jikns666.xyz")
  })

  it("Preview 分支稳定域应直接使用当前 origin", () => {
    process.env.VERCEL_ENV = "preview"

    const request = createTestRequest(
      "https://jiknsblog-git-perf-phase0-preview-jikns-projects.vercel.app/api/auth/github"
    )
    expect(resolveAuthBaseUrl(request)).toBe(
      "https://jiknsblog-git-perf-phase0-preview-jikns-projects.vercel.app"
    )
  })
})
