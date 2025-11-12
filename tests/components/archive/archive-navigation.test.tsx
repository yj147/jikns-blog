import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const prefetchMock = vi.fn()
const pushMock = vi.fn()
const useIsMobileMock = vi.fn(() => false)

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: prefetchMock,
    push: pushMock,
  }),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => (
      <div {...props} data-motion="div">
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

import ArchiveNavigation from "@/components/archive/archive-navigation"

const YEARS = [
  { year: 2025, count: 8 },
  { year: 2024, count: 6 },
] as const

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  // @ts-expect-error jsdom shim
  window.ResizeObserver = ResizeObserverMock
}

describe("ArchiveNavigation", () => {
  const originalScrollTo = window.scrollTo
  let scrollToMock: ReturnType<typeof vi.fn>
  let scrollIntoViewMock: ReturnType<typeof vi.fn>
  let anchor: HTMLElement

  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false)
    scrollToMock = vi.fn()
    // @ts-expect-error override for test
    window.scrollTo = scrollToMock

    anchor = document.createElement("div")
    anchor.id = "year-2025"
    scrollIntoViewMock = vi.fn()
    ;(anchor as any).scrollIntoView = scrollIntoViewMock
    document.body.appendChild(anchor)
  })

  afterEach(() => {
    document.body.removeChild(anchor)
    // @ts-expect-error restore
    window.scrollTo = originalScrollTo
    delete (window as any).scrollY
    prefetchMock.mockClear()
    pushMock.mockClear()
    useIsMobileMock.mockReset()
  })

  it("渲染带有 aria-label 的年份导航并支持页面内跳转", async () => {
    render(<ArchiveNavigation years={YEARS} />)

    const nav = screen.getByRole("navigation", { name: "年份导航" })
    expect(nav).toBeInTheDocument()
    expect(prefetchMock).toHaveBeenCalled()

    const button = screen.getByRole("button", { name: "2025 (8)" })
    const user = userEvent.setup()
    await user.click(button)

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
  })

  it("滚动后展示返回顶部按钮并触发平滑滚动", async () => {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 500,
    })

    render(<ArchiveNavigation years={YEARS} />)

    await act(async () => {
      window.dispatchEvent(new Event("scroll"))
    })

    const user = userEvent.setup()
    const backToTop = await screen.findByRole("button", { name: "返回顶部" })
    await user.click(backToTop)

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
  })

  it("小屏滚动时不渲染返回顶部按钮", async () => {
    useIsMobileMock.mockReturnValue(true)

    render(<ArchiveNavigation years={YEARS} />)

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 500,
    })

    await act(async () => {
      window.dispatchEvent(new Event("scroll"))
    })

    expect(screen.queryByRole("button", { name: "返回顶部" })).not.toBeInTheDocument()
  })

  it("在年份页面为其他年份渲染跳转链接", () => {
    render(<ArchiveNavigation years={YEARS} currentYear={2024} />)

    const link = screen.getByRole("link", { name: "2025 (8)" })
    expect(link).toHaveAttribute("href", "/archive/2025")

    expect(screen.getByRole("button", { name: "2024 (6)" })).toBeInTheDocument()
  })

  it("页面缺少年份锚点时回退为路由跳转", async () => {
    const user = userEvent.setup()

    render(<ArchiveNavigation years={YEARS} />)

    await user.click(screen.getByRole("button", { name: "2024 (6)" }))

    expect(pushMock).toHaveBeenCalledWith("/archive/2024")
  })
})
