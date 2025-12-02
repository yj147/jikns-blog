import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import SubscribeForm from "@/components/subscribe-form"

describe("SubscribeForm", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("shows validation error for invalid email", async () => {
    render(<SubscribeForm />)

    fireEvent.click(screen.getByRole("button", { name: /订阅更新/ }))

    await waitFor(() => {
      expect(screen.getByText("请输入有效的邮箱地址")).toBeInTheDocument()
    })
  })

  it("submits successfully and shows success message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { status: "pending" } }),
    } as any)
    global.fetch = fetchMock as any

    render(<SubscribeForm />)

    const input = screen.getByTestId("email-input")
    fireEvent.change(input, { target: { value: "user@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /订阅更新/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
      expect(screen.getByTestId("success-alert")).toBeInTheDocument()
    })
  })

  it("handles api error response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { message: "rate limited" } }),
    } as any)
    global.fetch = fetchMock as any

    render(<SubscribeForm />)

    const input = screen.getByTestId("email-input")
    fireEvent.change(input, { target: { value: "user@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /订阅更新/ }))

    await waitFor(() => {
      expect(screen.getByTestId("error-alert")).toBeInTheDocument()
      expect(screen.getByText(/rate limited/)).toBeInTheDocument()
    })
  })
})
