import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import MobileNavigation from "@/components/navigation-mobile"

const mockUseAuth = vi.fn()

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

type MockUser = {
  id: string
  name: string | null
  email: string
  avatarUrl?: string | null
  role: "USER" | "ADMIN"
  status: "ACTIVE" | "BANNED"
}

const createAuthState = (
  overrides?: Partial<{ user: MockUser | null; loading: boolean; signOut: () => Promise<void> }>
) => {
  return {
    user: overrides?.user ?? null,
    session: null,
    loading: overrides?.loading ?? false,
    isLoading: overrides?.loading ?? false,
    isAdmin: overrides?.user?.role === "ADMIN",
    signOut: overrides?.signOut ?? vi.fn().mockResolvedValue(undefined),
  }
}

let authState = createAuthState()

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
})

beforeEach(() => {
  authState = createAuthState()
  mockUseAuth.mockImplementation(() => authState)
})

afterEach(() => {
  mockUseAuth.mockClear()
})

describe("Navigation mobile drawer", () => {
  it("opens and closes the sheet via trigger and Escape", async () => {
    render(<MobileNavigation />)
    const user = userEvent.setup()

    const trigger = screen.getByLabelText("打开导航菜单")
    await user.click(trigger)

    expect(await screen.findByRole("link", { name: "动态" })).toBeVisible()

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("closes the sheet when navigating from authenticated shortcuts", async () => {
    authState = createAuthState({
      user: {
        id: "user-1",
        name: "测试用户",
        email: "test@example.com",
        role: "ADMIN",
        status: "ACTIVE",
        avatarUrl: null,
      },
    })
    mockUseAuth.mockImplementation(() => authState)

    render(<MobileNavigation />)
    const user = userEvent.setup()

    await user.click(screen.getByLabelText("打开导航菜单"))

    const profileLink = await screen.findByRole("link", { name: "个人资料" })
    profileLink.addEventListener("click", (event) => event.preventDefault())
    await user.click(profileLink)

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
