import { logger } from "@/lib/utils/logger"

export interface RetryConfig {
  maxRetry?: number
  baseDelay?: number
  backoffFactor?: number
}

export interface RetryScheduler {
  schedule: (task: () => void) => number | null
  reset: () => void
  clear: () => void
  readonly attempts: number
}

const normalizePositiveNumber = (value: number | undefined, fallback: number) => {
  if (Number.isFinite(value) && value !== undefined && value > 0) {
    return value
  }
  return fallback
}

export function createRetryScheduler(config: RetryConfig = {}): RetryScheduler {
  const maxRetry = Math.max(0, Math.floor(config.maxRetry ?? 3))
  const baseDelay = normalizePositiveNumber(config.baseDelay, 1000)
  const backoffFactor = normalizePositiveNumber(config.backoffFactor, 2)

  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const reset = () => {
    clear()
    attempts = 0
  }

  const schedule = (task: () => void): number | null => {
    if (maxRetry === 0) {
      logger.warn("重试已禁用", { maxRetry })
      return null
    }

    if (attempts >= maxRetry) {
      logger.warn("达到最大重试次数，停止调度", { attempts, maxRetry })
      return null
    }

    clear()
    attempts += 1

    const delay = Math.round(baseDelay * backoffFactor ** (attempts - 1))

    timer = setTimeout(() => {
      timer = null
      try {
        task()
      } catch (error) {
        logger.error("重试任务执行失败", { attempt: attempts }, error)
      }
    }, delay)

    logger.debug("调度重试", { attempt: attempts, delay })
    return delay
  }

  return {
    schedule,
    reset,
    clear,
    get attempts() {
      return attempts
    },
  }
}
