import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

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
    const request = {
      cookies: {
        getAll: () => [{ name: "sb-auth-token", value: "test-token" }],
      },
    } as unknown as NextRequest
    const supabaseModule = await import("@/lib/supabase")
    const prismaModule = await import("@/lib/prisma")
    const sessionModule = await import("@/lib/auth/session")
    const mockUser = { id: "user-123", role: "USER", status: "ACTIVE" } as any

    vi.mocked(supabaseModule.createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as any)

    vi.mocked(prismaModule.prisma.user.findUnique).mockResolvedValue({
      id: mockUser.id,
      email: "user@test.com",
      role: mockUser.role,
      status: mockUser.status,
      name: "Test User",
      avatarUrl: null,
    } as any)

    const result = await sessionModule.getOptionalViewer({ request })

    expect(result?.id).toBe(mockUser.id)
  })
})
