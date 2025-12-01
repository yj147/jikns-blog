import React from "react"
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { NotificationItem } from "@/components/notifications/notification-item"
import { NotificationList } from "@/components/notifications/notification-list"
import { NotificationType } from "@/lib/generated/prisma"
import type { NotificationView } from "@/components/notifications/types"

const useSWRMock = vi.hoisted(() => vi.fn())
const useSWRInfiniteMock = vi.hoisted(() => vi.fn())
const fetchJsonMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => vi.fn())
const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock("swr", () => ({
  __esModule: true,
  default: (...args: any[]) => useSWRMock(...args),
}))

vi.mock("swr/infinite", () => ({
  __esModule: true,
  default: (...args: any[]) => useSWRInfiniteMock(...args),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock("@/lib/api/fetch-json", () => ({
  __esModule: true,
  fetchJson: fetchJsonMock,
}))

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  readonly root: Element | Document | null = null
  readonly rootMargin = ""
  readonly thresholds: ReadonlyArray<number> = []
  private target: Element | null = null

  constructor(private callback: ObserverCallback) {
    MockIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.target = element
  }
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  trigger(isIntersecting: boolean) {
    if (!this.target) {
      throw new Error("No target observed")
    }
    this.callback([
      {
        isIntersecting,
        target: this.target,
      } as IntersectionObserverEntry,
    ])
  }
}

const realIntersectionObserver = global.IntersectionObserver

const basePagination = { limit: 10, hasMore: false, nextCursor: null }

function createNotification(overrides: Partial<NotificationView> = {}): NotificationView {
  return {
    id: "notif-1",
    type: NotificationType.LIKE,
    readAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    actor: {
      id: "actor-1",
      name: "Alice",
      avatarUrl: null,
      email: "alice@example.com",
    },
    post: null,
    comment: null,
    ...overrides,
  }
}

beforeAll(() => {
  // @ts-expect-error override for test
  global.IntersectionObserver = MockIntersectionObserver
})

afterAll(() => {
  // @ts-expect-error restore
  global.IntersectionObserver = realIntersectionObserver
})

beforeEach(() => {
  vi.clearAllMocks()
  useSWRMock.mockReset()
  useSWRInfiniteMock.mockReset()
  fetchJsonMock.mockReset()
  useAuthMock.mockReset()
  toastMock.mockReset()
  routerPushMock.mockReset()
  MockIntersectionObserver.instances = []
  vi.useRealTimers()
})

describe("NotificationItem", () => {
  it.each([
    { type: NotificationType.LIKE, label: "点赞", desc: "赞了你的内容" },
    { type: NotificationType.COMMENT, label: "评论", desc: "评论了你的内容" },
    { type: NotificationType.FOLLOW, label: "关注", desc: "关注了你" },
    { type: NotificationType.SYSTEM, label: "系统", desc: "系统通知" },
  ])("渲染 %s 类型通知", ({ type, label, desc }) => {
    render(<NotificationItem notification={createNotification({ type })} />)

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(desc))).toBeInTheDocument()
  })

  it("显示未读与已读的样式差异", () => {
    const { container: unreadContainer } = render(
      <NotificationItem notification={createNotification({ id: "u", readAt: null })} />
    )
    const unreadCard = unreadContainer.querySelector('[data-slot="card"]')!
    expect(unreadCard.className).toContain("bg-primary/5")

    const { container: readContainer } = render(
      <NotificationItem notification={createNotification({ id: "r", readAt: "2025-01-02T00:00:00Z" })} />
    )
    const readCard = readContainer.querySelector('[data-slot="card"]')!
    expect(readCard.className).not.toContain("bg-primary/5")
  })

  it("点击按钮触发已读回调", async () => {
    const onMarkRead = vi.fn()
    render(<NotificationItem notification={createNotification({ id: "target" })} onMarkRead={onMarkRead} />)

    await userEvent.click(screen.getByRole("button", { name: "标记已读" }))

    expect(onMarkRead).toHaveBeenCalledWith("target")
  })

  it("点击卡片标记已读并导航", async () => {
    const onMarkRead = vi.fn()
    const notification = createNotification({ id: "nav", targetUrl: "/blog/nav" })

    render(<NotificationItem notification={notification} onMarkRead={onMarkRead} />)

    await userEvent.click(screen.getByRole("link"))

    expect(onMarkRead).toHaveBeenCalledWith("nav")
    expect(routerPushMock).toHaveBeenCalledWith("/blog/nav")
  })

  it("展示相对时间", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-01-02T00:00:00Z"))

    render(<NotificationItem notification={createNotification({ createdAt: "2025-01-01T00:00:00Z" })} />)

    expect(screen.getByText(/前/)).toBeInTheDocument()
  })
})

describe("NotificationBell", () => {
  const bellNotifications = [
    createNotification({ id: "n1", type: NotificationType.LIKE, targetUrl: "/blog/n1" }),
    createNotification({
      id: "n2",
      type: NotificationType.COMMENT,
      targetUrl: "/blog/n2#comments",
      actor: { id: "actor-2", name: "Bob", avatarUrl: null, email: null },
    }),
  ]

  const bellData = {
    success: true,
    data: {
      items: bellNotifications,
      pagination: { ...basePagination, hasMore: false },
      unreadCount: 3,
      filteredUnreadCount: 3,
    },
  }

  const renderBell = () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
    useSWRMock.mockReturnValue({
      data: bellData,
      isLoading: false,
      mutate: vi.fn(),
    })
    return render(<NotificationBell />)
  }

  it("渲染未读角标", () => {
    renderBell()

    const badge = screen.getByText("3", { selector: "span.bg-destructive" })
    expect(badge).toBeInTheDocument()
  })

  it("无未读时不显示角标", () => {
    useAuthMock.mockReturnValue({ user: { id: "user-1" }, loading: false })
    useSWRMock.mockReturnValue({
      data: { ...bellData, data: { ...bellData.data, unreadCount: 0, filteredUnreadCount: 0 } },
      isLoading: false,
      mutate: vi.fn(),
    })

    const { container } = render(<NotificationBell />)

    expect(container.querySelector(".bg-destructive")).toBeNull()
  })

  it("点击铃铛展开下拉", async () => {
    renderBell()

    const trigger = screen.getByRole("button")
    await userEvent.click(trigger)

    const content = screen.getByText("通知").closest("[data-slot=\"dropdown-menu-content\"]")
    await waitFor(() => {
      expect(content).toHaveAttribute("data-state", "open")
    })
  })

  it("下拉展示最近通知预览", async () => {
    renderBell()

    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })

  it("点击通知关闭下拉并跳转", async () => {
    fetchJsonMock.mockResolvedValue({ success: true })
    renderBell()

    await userEvent.click(screen.getByRole("button"))
    const content = screen.getByText("通知").closest("[data-slot=\"dropdown-menu-content\"]")!
    await waitFor(() => expect(content).toHaveAttribute("data-state", "open"))

    await userEvent.click(screen.getByText("Alice"))

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/blog/n1")
      expect(content).toHaveAttribute("data-state", "closed")
    })
  })

  it("点击查看全部跳转通知中心", async () => {
    renderBell()

    await userEvent.click(screen.getByRole("button"))
    await userEvent.click(screen.getByRole("button", { name: "查看全部" }))

    expect(routerPushMock).toHaveBeenCalledWith("/notifications")
  })
})

describe("NotificationList", () => {
  const basePage = {
    success: true,
    data: {
      items: [
        createNotification({ id: "a", actor: { id: "actor-a", name: "Alice", avatarUrl: null, email: null } }),
        createNotification({ id: "b", type: NotificationType.COMMENT, actor: { id: "actor-b", name: "Bob", avatarUrl: null, email: null } }),
      ],
      pagination: { ...basePagination, hasMore: true, nextCursor: "cursor-2" },
      unreadCount: 2,
      filteredUnreadCount: 1,
    },
  }

  it("无数据时显示空状态", () => {
    useSWRInfiniteMock.mockReturnValue({
      data: [
        {
          success: true,
          data: { items: [], pagination: basePagination, unreadCount: 0, filteredUnreadCount: 0 },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<NotificationList />)

    expect(screen.getByText("暂时没有通知")).toBeInTheDocument()
  })

  it("渲染通知列表", () => {
    useSWRInfiniteMock.mockReturnValue({
      data: [basePage],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<NotificationList />)

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })

  it("切换过滤器时重置列表", async () => {
    const mutate = vi.fn()
    const setSize = vi.fn()
    useSWRInfiniteMock.mockReturnValue({
      data: [basePage],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize,
      mutate,
    })

    render(<NotificationList />)

    await userEvent.click(screen.getByRole("tab", { name: "评论" }))

    expect(mutate).toHaveBeenCalledWith([], false)
    expect(setSize).toHaveBeenCalledWith(1)
  })

  it("IntersectionObserver 触发加载更多", () => {
    const setSize = vi.fn()
    useSWRInfiniteMock.mockReturnValue({
      data: [basePage],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize,
      mutate: vi.fn(),
    })

    render(<NotificationList />)

    const observer = MockIntersectionObserver.instances[0]
    act(() => observer.trigger(true))

    expect(setSize).toHaveBeenCalledWith(expect.any(Function))
  })

  it("按类型过滤时生成正确的请求 key", async () => {
    const keyFns: Array<(index: number, previous: any) => string | null> = []
    const state = {
      data: [basePage],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    }

    useSWRInfiniteMock.mockImplementation((keyFn) => {
      keyFns.push(keyFn)
      return state
    })

    render(<NotificationList />)

    const initialKey = keyFns.at(-1)!(0, null)
    expect(initialKey).not.toContain("type=")

    await userEvent.click(screen.getByRole("tab", { name: "关注" }))

    const followKey = keyFns.at(-1)!(0, null)
    expect(followKey).toContain("type=FOLLOW")
  })

  it("全部已读按钮调用接口并刷新", async () => {
    const mutate = vi.fn()
    useSWRInfiniteMock.mockReturnValue({
      data: [
        {
          ...basePage,
          data: {
            ...basePage.data,
            items: [
              createNotification({ id: "x", readAt: null }),
              createNotification({ id: "y", readAt: null }),
            ],
            unreadCount: 2,
            filteredUnreadCount: 2,
          },
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate,
    })

    fetchJsonMock.mockResolvedValueOnce({ success: true })

    render(<NotificationList />)

    await userEvent.click(screen.getByRole("button", { name: "全部已读" }))

    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ ids: ["x", "y"] }),
      })
    )
    expect(mutate).toHaveBeenCalled()
  })

  it("初次加载时展示加载提示", () => {
    useSWRInfiniteMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isValidating: false,
      size: 1,
      setSize: vi.fn(),
      mutate: vi.fn(),
    })

    render(<NotificationList />)

    expect(screen.getByText("加载通知中...")).toBeInTheDocument()
  })
})
