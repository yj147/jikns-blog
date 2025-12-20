import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useRealtimeDashboard } from "@/hooks/use-realtime-dashboard"
import type { AdminDashboardCounterRow, MonitoringStats } from "@/types/monitoring"

vi.mock("@/lib/api/fetch-json", () => ({
  fetchJson: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/realtime/connection", () => ({
  ensureSessionReady: vi.fn(),
  useNetworkStatus: vi.fn(),
  useOnlineCallback: vi.fn(),
}))

vi.mock("@/lib/realtime/retry", () => ({
  createRetryScheduler: vi.fn(),
}))

const fetchJsonMock = vi.mocked((await import("@/lib/api/fetch-json")).fetchJson)
const createClientMock = vi.mocked((await import("@/lib/supabase")).createClient)
const ensureSessionReadyMock = vi.mocked(
  (await import("@/lib/realtime/connection")).ensureSessionReady
)
const useNetworkStatusMock = vi.mocked((await import("@/lib/realtime/connection")).useNetworkStatus)
const useOnlineCallbackMock = vi.mocked(
  (await import("@/lib/realtime/connection")).useOnlineCallback
)
const createRetrySchedulerMock = vi.mocked(
  (await import("@/lib/realtime/retry")).createRetryScheduler
)

const baseStats: MonitoringStats = {
  users: 1,
  posts: 2,
  comments: 3,
  activities: 4,
  generatedAt: new Date().toISOString(),
}

function createSupabaseStub() {
  const handlers: {
    change?: (payload: any) => void
    status?: (status: any) => void
  } = {}

  const channel = {
    on: vi.fn((_event, _filter, handler) => {
      handlers.change = handler
      return channel
    }),
    subscribe: vi.fn((callback?: (status: any) => void) => {
      handlers.status = callback
      callback?.("SUBSCRIBED")
      return channel
    }),
  }

  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    emit(payload: any) {
      handlers.change?.(payload)
    },
    emitStatus(status: any) {
      handlers.status?.(status)
    },
  }

  return client
}

describe("useRealtimeDashboard", () => {
  let scheduledTask: (() => void) | null
  let retryScheduler: {
    schedule: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
    readonly attempts: number
  }
  let onlineCallback: (() => void) | null

  beforeEach(() => {
    vi.clearAllMocks()
    fetchJsonMock.mockResolvedValue({ success: true, data: baseStats })
    scheduledTask = null
    onlineCallback = null
    let attempts = 0
    retryScheduler = {
      schedule: vi.fn((task: () => void) => {
        attempts += 1
        scheduledTask = task
        return 0
      }),
      reset: vi.fn(() => {
        attempts = 0
      }),
      clear: vi.fn(() => {
        scheduledTask = null
      }),
      get attempts() {
        return attempts
      },
    }
    createRetrySchedulerMock.mockReturnValue(retryScheduler as any)
    ensureSessionReadyMock.mockResolvedValue(true)
    useNetworkStatusMock.mockReturnValue(true)
    useOnlineCallbackMock.mockImplementation((cb) => {
      onlineCallback = cb
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("在 Realtime 不可用时回退为轮询并保留数据", async () => {
    vi.useFakeTimers()
    createClientMock.mockReturnValue({} as any)

    const { result } = renderHook(() => useRealtimeDashboard({ pollInterval: 1000 }))

    await waitFor(() => {
      expect(result.current.data?.users).toBe(1)
    })

    expect(result.current.isPollingFallback).toBe(true)
    expect(result.current.isRealtimeConnected).toBe(false)
    expect(fetchJsonMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(fetchJsonMock).toHaveBeenCalledTimes(2)
  })

  it("收到 Realtime 事件时刷新仪表盘计数", async () => {
    const supabaseStub = createSupabaseStub()
    createClientMock.mockReturnValue(supabaseStub as any)

    const { result } = renderHook(() => useRealtimeDashboard())

    await waitFor(() => {
      expect(result.current.isRealtimeConnected).toBe(true)
    })

    const updatedRow: AdminDashboardCounterRow = {
      id: 1,
      users_count: 9,
      posts_count: 8,
      comments_count: 7,
      activities_count: 6,
      updated_at: new Date().toISOString(),
    }

    await act(async () => {
      supabaseStub.emit({
        eventType: "UPDATE",
        new: updatedRow,
        old: null,
      })
    })

    await waitFor(() => {
      expect(result.current.data?.users).toBe(9)
      expect(result.current.data?.posts).toBe(8)
      expect(result.current.connectionState).toBe("realtime")
    })
  })

  it("Supabase 客户端创建失败时回退轮询并暴露错误", async () => {
    vi.useFakeTimers()
    const creationError = new Error("创建失败")
    createClientMock.mockImplementation(() => {
      throw creationError
    })

    const { result, unmount } = renderHook(() => useRealtimeDashboard({ pollInterval: 1000 }))

    await waitFor(() => {
      expect(result.current.error).toBe(creationError)
      expect(result.current.isPollingFallback).toBe(true)
      expect(result.current.connectionState).toBe("polling")
      expect(retryScheduler.schedule).toHaveBeenCalled()
    })

    unmount()
  })

  it("Realtime 订阅中断时切换为轮询", async () => {
    vi.useFakeTimers()
    const supabaseStub = createSupabaseStub()
    createClientMock.mockReturnValue(supabaseStub as any)

    const { result, unmount } = renderHook(() => useRealtimeDashboard({ pollInterval: 1000 }))

    await waitFor(() => {
      expect(result.current.isRealtimeConnected).toBe(true)
    })

    await act(async () => {
      supabaseStub.emitStatus("CHANNEL_ERROR")
    })

    await waitFor(() => {
      expect(result.current.isRealtimeConnected).toBe(false)
      expect(result.current.isPollingFallback).toBe(true)
      expect(result.current.connectionState).toBe("polling")
      expect(retryScheduler.schedule).toHaveBeenCalled()
    })

    act(() => {
      scheduledTask?.()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe("realtime")
      expect(retryScheduler.reset).toHaveBeenCalled()
    })

    unmount()
  })

  it("离线时暂停订阅，上线回调后恢复 realtime", async () => {
    useNetworkStatusMock.mockReturnValueOnce(false).mockReturnValue(true)
    const supabaseStub = createSupabaseStub()
    createClientMock.mockReturnValue(supabaseStub as any)

    const { result } = renderHook(() => useRealtimeDashboard())

    expect(result.current.connectionState).toBe("idle")
    expect(createClientMock).not.toHaveBeenCalled()

    act(() => {
      onlineCallback?.()
    })

    await waitFor(() => expect(createClientMock).toHaveBeenCalled())
    await waitFor(() => expect(result.current.connectionState).toBe("realtime"))
  })

  it("刷新失败时 connectionState 为 error", async () => {
    const failure = new Error("获取失败")
    fetchJsonMock.mockRejectedValueOnce(failure)

    const { result } = renderHook(() => useRealtimeDashboard({ enabled: false }))

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.error).toBe(failure)
      expect(result.current.isPollingFallback).toBe(false)
      expect(result.current.connectionState).toBe("error")
    })
  })
})
