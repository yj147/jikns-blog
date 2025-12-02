import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createRetryScheduler } from "@/lib/realtime/retry"
import { logger } from "@/lib/utils/logger"

describe("createRetryScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(logger, "debug").mockImplementation(() => {})
    vi.spyOn(logger, "warn").mockImplementation(() => {})
    vi.spyOn(logger, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("按指数退避调度任务并触发回调", () => {
    const scheduler = createRetryScheduler({ baseDelay: 100, backoffFactor: 2, maxRetry: 3 })
    const task = vi.fn()

    const delay1 = scheduler.schedule(task)
    expect(delay1).toBe(100)
    expect(scheduler.attempts).toBe(1)

    vi.advanceTimersByTime(99)
    expect(task).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(task).toHaveBeenCalledTimes(1)

    const delay2 = scheduler.schedule(task)
    expect(delay2).toBe(200)
    expect(scheduler.attempts).toBe(2)
    vi.advanceTimersByTime(200)
    expect(task).toHaveBeenCalledTimes(2)

    const delay3 = scheduler.schedule(task)
    expect(delay3).toBe(400)
    expect(scheduler.attempts).toBe(3)
    vi.advanceTimersByTime(400)
    expect(task).toHaveBeenCalledTimes(3)
  })

  it("达到最大重试次数后停止调度", () => {
    const scheduler = createRetryScheduler({ maxRetry: 2, baseDelay: 50, backoffFactor: 1 })
    const task = vi.fn()

    scheduler.schedule(task)
    vi.advanceTimersByTime(50)

    scheduler.schedule(task)
    vi.advanceTimersByTime(50)

    const skipped = scheduler.schedule(task)

    expect(skipped).toBeNull()
    expect(scheduler.attempts).toBe(2)

    expect(task).toHaveBeenCalledTimes(2)
  })

  it("reset 会清除计时器并重置计数", () => {
    const scheduler = createRetryScheduler({ baseDelay: 100 })
    const task = vi.fn()

    scheduler.schedule(task)
    scheduler.reset()

    expect(scheduler.attempts).toBe(0)

    vi.advanceTimersByTime(200)
    expect(task).not.toHaveBeenCalled()

    scheduler.schedule(task)
    vi.advanceTimersByTime(100)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it("clear 取消未完成的重试", () => {
    const scheduler = createRetryScheduler({ baseDelay: 100 })
    const task = vi.fn()

    scheduler.schedule(task)
    scheduler.clear()

    vi.advanceTimersByTime(200)
    expect(task).not.toHaveBeenCalled()
    expect(scheduler.attempts).toBe(1)
  })

  it("任务抛出异常时记录日志并不中断", () => {
    const scheduler = createRetryScheduler({ baseDelay: 50 })
    const errorSpy = vi.spyOn(logger, "error")
    const failure = new Error("boom")

    scheduler.schedule(() => {
      throw failure
    })

    vi.advanceTimersByTime(50)
    expect(errorSpy).toHaveBeenCalledWith("重试任务执行失败", { attempt: 1 }, failure)
  })
})
