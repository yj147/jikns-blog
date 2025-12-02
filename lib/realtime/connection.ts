import { useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { logger } from "@/lib/utils/logger"

const isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined"

const getInitialStatus = () => {
  if (!isBrowser) return true
  return navigator.onLine
}

export async function ensureSessionReady(
  supabase: SupabaseClient<Database> | null | undefined,
  channelName: string,
  requireSession = true
): Promise<boolean> {
  const name = channelName || "realtime"

  if (!supabase?.auth?.getSession) {
    logger.error("Supabase 客户端未初始化，无法进行 Realtime 订阅", { channelName: name })
    return false
  }

  if (!requireSession) {
    logger.debug("公共频道允许匿名订阅，跳过会话检测", { channelName: name })
    return true
  }

  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      logger.error("获取 Supabase 会话失败", { channelName: name }, error)
      return false
    }

    if (!data?.session) {
      logger.warn("Supabase 会话不存在，延迟订阅", { channelName: name })
      return false
    }

    logger.debug("Supabase 会话就绪", {
      channelName: name,
      userId: data.session.user?.id ?? "anonymous",
      expiresAt: data.session.expires_at,
    })

    return true
  } catch (err) {
    logger.error("检查 Supabase 会话异常", { channelName: name }, err)
    return false
  }
}

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialStatus)

  useEffect(() => {
    if (!isBrowser) return

    const handleOnline = () => {
      setIsOnline(true)
      logger.debug("网络恢复在线")
    }

    const handleOffline = () => {
      setIsOnline(false)
      logger.warn("检测到网络离线")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}

export function useOnlineCallback(callback: () => void) {
  const callbackRef = useRef(callback)
  const previousStatusRef = useRef<boolean | null>(null)
  const isOnline = useNetworkStatus()

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (previousStatusRef.current === null) {
      previousStatusRef.current = isOnline
      return
    }

    if (!previousStatusRef.current && isOnline) {
      logger.info("网络恢复，执行挂起操作")
      callbackRef.current()
    }

    previousStatusRef.current = isOnline
  }, [isOnline])
}
