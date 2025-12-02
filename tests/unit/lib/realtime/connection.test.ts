import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ensureSessionReady, useNetworkStatus, useOnlineCallback } from "@/lib/realtime/connection"
import { logger } from "@/lib/utils/logger"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type SessionShape = {
  access_token?: string
  user?: { id?: string | null }
  expires_at?: number | null
}

const createSupabaseStub = (
  options: {
    session?: SessionShape | null
    error?: Error | null
    throws?: Error
  } = {}
) => {
  const auth = {
    getSession: vi.fn(async () => {
      if (options.throws) {
        throw options.throws
      }

      return {
        data: { session: options.session ?? null },
        error: options.error ?? null,
      }
    }),
  }

  return { auth } as unknown as SupabaseClient<Database>
}

describe("ensureSessionReady", () => {
  beforeEach(() => {
    vi.spyOn(logger, "debug").mockImplementation(() => {})
    vi.spyOn(logger, "warn").mockImplementation(() => {})
    vi.spyOn(logger, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("会话存在时返回 true", async () => {
    const supabase = createSupabaseStub({
      session: {
        access_token: "token",
        user: { id: "u1" },
      },
    })

    const ready = await ensureSessionReady(supabase, "channel-a")

    expect(ready).toBe(true)
    expect(supabase.auth.getSession).toHaveBeenCalled()
  })

  it("会话缺失时返回 false 并记录警告", async () => {
    const supabase = createSupabaseStub({ session: null })
    const warnSpy = vi.spyOn(logger, "warn")

    const ready = await ensureSessionReady(supabase, "channel-b")

    expect(ready).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
  })

  it("公共频道允许跳过会话检测", async () => {
    const supabase = createSupabaseStub({ session: null })
    const warnSpy = vi.spyOn(logger, "warn")

    const ready = await ensureSessionReady(supabase, "channel-public", false)

    expect(ready).toBe(true)
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("getSession 报错时返回 false 并记录错误", async () => {
    const sessionError = new Error("session failed")
    const supabase = createSupabaseStub({ error: sessionError })
    const errorSpy = vi.spyOn(logger, "error")

    const ready = await ensureSessionReady(supabase, "channel-c")

    expect(ready).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      "获取 Supabase 会话失败",
      { channelName: "channel-c" },
      sessionError
    )
  })

  it("getSession 抛出异常时返回 false", async () => {
    const thrown = new Error("boom")
    const supabase = createSupabaseStub({ throws: thrown })
    const errorSpy = vi.spyOn(logger, "error")

    const ready = await ensureSessionReady(supabase, "channel-d")

    expect(ready).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      "检查 Supabase 会话异常",
      { channelName: "channel-d" },
      thrown
    )
  })

  it("Supabase 客户端未初始化时返回 false", async () => {
    const errorSpy = vi.spyOn(logger, "error")

    const ready = await ensureSessionReady(null as unknown as SupabaseClient<Database>, "channel-e")

    expect(ready).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      "Supabase 客户端未初始化，无法进行 Realtime 订阅",
      { channelName: "channel-e" }
    )
  })
})

describe("useNetworkStatus", () => {
  let onlineGetter: vi.SpyInstance<boolean, []>

  beforeEach(() => {
    onlineGetter = vi.spyOn(navigator, "onLine", "get")
    onlineGetter.mockReturnValue(true)
    vi.spyOn(logger, "debug").mockImplementation(() => {})
    vi.spyOn(logger, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("跟踪 online/offline 事件", async () => {
    onlineGetter.mockReturnValue(false)

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current).toBe(false)

    await act(async () => {
      onlineGetter.mockReturnValue(true)
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })

    await act(async () => {
      onlineGetter.mockReturnValue(false)
      window.dispatchEvent(new Event("offline"))
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })
})

describe("useOnlineCallback", () => {
  let onlineGetter: vi.SpyInstance<boolean, []>

  beforeEach(() => {
    onlineGetter = vi.spyOn(navigator, "onLine", "get")
    onlineGetter.mockReturnValue(true)
    vi.spyOn(logger, "debug").mockImplementation(() => {})
    vi.spyOn(logger, "warn").mockImplementation(() => {})
    vi.spyOn(logger, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("仅在离线后恢复在线时触发回调", async () => {
    const callback = vi.fn()

    const { unmount } = renderHook(() => useOnlineCallback(callback))

    expect(callback).not.toHaveBeenCalled()

    await act(async () => {
      onlineGetter.mockReturnValue(false)
      window.dispatchEvent(new Event("offline"))
    })

    await act(async () => {
      onlineGetter.mockReturnValue(true)
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1)
    })

    unmount()
  })

  it("初始在线状态下不会立即触发回调", async () => {
    const callback = vi.fn()

    renderHook(() => useOnlineCallback(callback))

    await waitFor(() => {
      expect(callback).not.toHaveBeenCalled()
    })
  })
})
