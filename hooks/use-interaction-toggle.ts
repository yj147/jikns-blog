import { useCallback, useEffect, useRef, useState } from "react"
import { logger } from "@/lib/utils/logger"

export interface InteractionStatus {
  isActive: boolean
  count: number
}

/**
 * 安全调用回调函数，捕获并记录异常
 * @param callback 回调函数
 * @param isActive 激活状态
 * @param count 计数
 * @param phase 调用阶段（用于日志）
 */
function safeInvoke(
  callback: ((isActive: boolean, count: number) => void) | undefined,
  isActive: boolean,
  count: number,
  phase: string
): void {
  if (!callback) return
  try {
    callback(isActive, count)
  } catch (error) {
    logger.warn(`onStatusChange 回调异常（${phase}）`, { error, isActive, count })
  }
}

interface UseInteractionToggleOptions {
  initialIsActive?: boolean
  initialCount?: number
  fetcher?: () => Promise<InteractionStatus>
  toggler: () => Promise<InteractionStatus>
  shouldFetchOnMount?: boolean
  onStatusChange?: (isActive: boolean, count: number) => void
  onFetchError?: (error: unknown) => InteractionStatus | undefined
  onToggleError?: (error: unknown) => void
  externalIsActive?: boolean
  externalCount?: number
}

interface UseInteractionToggleResult {
  status: InteractionStatus
  isLoading: boolean
  isToggling: boolean
  fetchStatus: () => Promise<InteractionStatus | undefined>
  toggle: () => Promise<InteractionStatus | undefined>
}

export function useInteractionToggle(
  options: UseInteractionToggleOptions
): UseInteractionToggleResult {
  const {
    initialIsActive = false,
    initialCount = 0,
    fetcher,
    toggler,
    shouldFetchOnMount = Boolean(fetcher),
    onStatusChange,
    onFetchError,
    onToggleError,
    externalIsActive,
    externalCount,
  } = options

  const [status, setStatus] = useState<InteractionStatus>({
    isActive: initialIsActive,
    count: initialCount,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const statusRef = useRef(status)
  const togglingRef = useRef(false)
  const externalIsActiveRef = useRef(externalIsActive)
  const externalCountRef = useRef(externalCount)

  // 使用 ref 存储回调函数，避免 useCallback 依赖数组包含函数导致重新创建
  const fetcherRef = useRef(fetcher)
  const onFetchErrorRef = useRef(onFetchError)
  const togglerRef = useRef(toggler)
  const onStatusChangeRef = useRef(onStatusChange)
  const onToggleErrorRef = useRef(onToggleError)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  // 同步回调函数到 ref
  useEffect(() => {
    fetcherRef.current = fetcher
    onFetchErrorRef.current = onFetchError
    togglerRef.current = toggler
    onStatusChangeRef.current = onStatusChange
    onToggleErrorRef.current = onToggleError
  }, [fetcher, onFetchError, toggler, onStatusChange, onToggleError])

  const fetchStatus = useCallback(async () => {
    if (!fetcherRef.current) return undefined

    setIsLoading(true)
    try {
      const result = await fetcherRef.current()
      setStatus(result)
      return result
    } catch (error) {
      if (onFetchErrorRef.current) {
        const fallback = onFetchErrorRef.current(error)
        if (fallback) {
          setStatus(fallback)
          return fallback
        }
      }
      return undefined
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!shouldFetchOnMount || !fetcherRef.current) return
    void fetchStatus()
  }, [shouldFetchOnMount, fetchStatus])

  useEffect(() => {
    if (externalIsActive === undefined || externalIsActiveRef.current === externalIsActive) return
    externalIsActiveRef.current = externalIsActive
    setStatus((previous) =>
      previous.isActive === externalIsActive
        ? previous
        : { ...previous, isActive: externalIsActive }
    )
  }, [externalIsActive])

  useEffect(() => {
    if (externalCount === undefined || externalCountRef.current === externalCount) return
    externalCountRef.current = externalCount
    setStatus((previous) =>
      previous.count === externalCount ? previous : { ...previous, count: externalCount }
    )
  }, [externalCount])

  const toggle = useCallback(async () => {
    if (togglingRef.current) {
      return statusRef.current
    }

    togglingRef.current = true
    setIsToggling(true)

    const previous = statusRef.current
    const optimistic: InteractionStatus = {
      isActive: !previous.isActive,
      count: previous.isActive ? Math.max(0, previous.count - 1) : previous.count + 1,
    }

    setStatus(optimistic)
    safeInvoke(onStatusChangeRef.current, optimistic.isActive, optimistic.count, "乐观更新")

    try {
      const result = await togglerRef.current()
      setStatus(result)
      safeInvoke(onStatusChangeRef.current, result.isActive, result.count, "成功")
      return result
    } catch (error) {
      setStatus(previous)
      safeInvoke(onStatusChangeRef.current, previous.isActive, previous.count, "回滚")
      onToggleErrorRef.current?.(error)
      return undefined
    } finally {
      togglingRef.current = false
      setIsToggling(false)
    }
  }, [])

  return {
    status,
    isLoading,
    isToggling,
    fetchStatus,
    toggle,
  }
}
