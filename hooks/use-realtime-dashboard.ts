/**
 * Admin 监控仪表盘 Realtime Hook
 * - 监听 admin_dashboard_counters 表的 postgres_changes
 * - Realtime 不可用时回退为定时轮询 API
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import { fetchJson } from "@/lib/api/fetch-json"
import { logger } from "@/lib/utils/logger"
import type { Database } from "@/types/database"
import type { AdminDashboardCounterRow, MonitoringResponse, MonitoringStats } from "@/types/monitoring"

interface UseRealtimeDashboardOptions {
  enabled?: boolean
  pollInterval?: number
  supabaseClient?: SupabaseClient<Database> | null
}

interface UseRealtimeDashboardResult {
  data: MonitoringResponse | null
  isLoading: boolean
  error: Error | null
  isRealtimeConnected: boolean
  isPollingFallback: boolean
  lastUpdated: Date | null
  connectionState: "realtime" | "polling" | "idle" | "error"
  refresh: () => Promise<MonitoringStats | null>
}

type DashboardChangePayload = RealtimePostgresChangesPayload<AdminDashboardCounterRow>

const DEFAULT_POLL_INTERVAL = 30000

export function useRealtimeDashboard({
  enabled = true,
  pollInterval = DEFAULT_POLL_INTERVAL,
  supabaseClient = null,
}: UseRealtimeDashboardOptions = {}): UseRealtimeDashboardResult {
  const [data, setData] = useState<MonitoringStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [isPollingFallback, setIsPollingFallback] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const supabaseRef = useRef<SupabaseClient<Database> | null>(supabaseClient)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    supabaseRef.current = supabaseClient
  }, [supabaseClient])

  const updateFromRow = useCallback((row: AdminDashboardCounterRow) => {
    const snapshot: MonitoringResponse = {
      users: Number(row.users_count),
      posts: Number(row.posts_count),
      comments: Number(row.comments_count),
      activities: Number(row.activities_count),
      generatedAt: new Date(row.updated_at).toISOString(),
    }
    setData(snapshot)
    setLastUpdated(new Date(row.updated_at))
    setError(null)
    setIsLoading(false)
  }, [])

  const fetchStats = useCallback(
    async (showLoading = false): Promise<MonitoringResponse | null> => {
      if (showLoading) {
        setIsLoading(true)
      }
      try {
        const response = await fetchJson<{ success: boolean; data: MonitoringResponse }>(
          "/api/admin/monitoring"
        )
        const payload = response.data
        if (!payload) {
          throw new Error("监控数据为空")
        }
        setData(payload)
        setLastUpdated(new Date(payload.generatedAt))
        setError(null)
        return payload
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error("获取监控数据失败")
        setError(normalized)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setIsPollingFallback(false)
  }, [])

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      return
    }
    setIsRealtimeConnected(false)
    setIsPollingFallback(true)
    pollTimerRef.current = setInterval(() => {
      void fetchStats()
    }, pollInterval)
  }, [fetchStats, pollInterval])

  useEffect(() => {
    mountedRef.current = true
    if (!enabled) {
      setIsLoading(false)
      return () => {
        mountedRef.current = false
      }
    }

    void fetchStats(true)

    const setupRealtime = async () => {
      if (supabaseRef.current) {
        logger.debug("复用外部 Supabase 客户端订阅监控仪表盘")
      } else {
        try {
          supabaseRef.current = createClient()
        } catch (err) {
          const message = err instanceof Error ? err.message : "创建 Supabase 客户端失败"
          logger.error("创建 Supabase 客户端失败，启用轮询降级", { message })
          if (mountedRef.current) {
            setError(err instanceof Error ? err : new Error(message))
            startPolling()
          }
          return
        }
      }

      const supabase = supabaseRef.current
      if (!supabase || typeof (supabase as any).channel !== "function") {
        logger.warn("当前环境不支持 Realtime，启用轮询")
        startPolling()
        return
      }

      const channelName = "admin-dashboard:counters"
      logger.info("订阅 admin_dashboard_counters", { channelName })

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "admin_dashboard_counters",
          },
          (payload: DashboardChangePayload) => {
            if (!mountedRef.current) return
            const row = (payload.new ?? payload.old) as AdminDashboardCounterRow | null
            if (!row) return
            updateFromRow(row)
          }
        )
        .subscribe((status) => {
          if (!mountedRef.current) return
          if (status === "SUBSCRIBED") {
            setIsRealtimeConnected(true)
            stopPolling()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            logger.warn("Realtime 订阅中断，回退轮询", { channelName, status })
            setIsRealtimeConnected(false)
            startPolling()
          }
        })

      channelRef.current = channel
    }

    void setupRealtime()

    return () => {
      mountedRef.current = false
      stopPolling()
      if (channelRef.current && supabaseRef.current) {
        logger.info("取消订阅 admin_dashboard_counters")
        supabaseRef.current.removeChannel(channelRef.current)
      }
      channelRef.current = null
    }
  }, [enabled, fetchStats, startPolling, stopPolling, updateFromRow])

  const connectionState: UseRealtimeDashboardResult["connectionState"] = isRealtimeConnected
    ? "realtime"
    : isPollingFallback
      ? "polling"
      : error
        ? "error"
        : "idle"

  return {
    data,
    isLoading,
    error,
    isRealtimeConnected,
    isPollingFallback,
    lastUpdated,
    connectionState,
    refresh: () => fetchStats(true),
  }
}
