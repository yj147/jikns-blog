import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

describe("getOptionalViewer helper", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns null without Supabase session cookies", async () => {
    const request = new NextRequest("http://localhost/api/test")
    const sessionModule = await import("@/lib/auth/session")
    const fetchSpy = vi.spyOn(sessionModule, "fetchAuthenticatedUser").mockResolvedValue(null)

    const result = await sessionModule.getOptionalViewer({ request })

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("delegates to fetchAuthenticatedUser when session cookies present", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: {
        cookie: "sb-access-token=test-token; Path=/; HttpOnly",
      },
    })
    const sessionModule = await import("@/lib/auth/session")
    const mockUser = { id: "user-123", role: "USER", status: "ACTIVE" } as any
    const fetchSpy = vi.spyOn(sessionModule, "fetchAuthenticatedUser").mockResolvedValue(mockUser)

    const result = await sessionModule.getOptionalViewer({ request })

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(result).toBe(mockUser)
  })
})
