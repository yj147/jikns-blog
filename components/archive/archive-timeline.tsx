"use client"

import { useCallback, useEffect, useReducer } from "react"
import { ArchiveYear } from "@/lib/actions/archive"
import ArchiveYearGroup from "./archive-year-group"
import ArchiveYearSkeleton from "./archive-year-skeleton"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { logger } from "@/lib/utils/logger"

interface ArchiveTimelineProps {
  data: ArchiveYear[]
  totalYearCount?: number
  initialChunkSize?: number
}

const DEFAULT_CHUNK_SIZE = 3

type TimelineBaseState = {
  timeline: ArchiveYear[]
  expandedYears: Set<number>
  hasMore: boolean
  nextOffset: number
}

type TimelineState =
  | (TimelineBaseState & { status: "idle"; error: null })
  | (TimelineBaseState & { status: "loading"; error: null })
  | (TimelineBaseState & { status: "error"; error: string })

type TimelineAction =
  | { type: "hydrate"; payload: { timeline: ArchiveYear[]; totalYearCount?: number } }
  | { type: "toggleYear"; year: number }
  | { type: "fetchStart" }
  | {
      type: "fetchSuccess"
      payload: { incoming: ArchiveYear[]; hasMore: boolean; nextOffset: number }
    }
  | { type: "fetchError"; message: string }

function createInitialTimelineState(years: ArchiveYear[], totalYearCount?: number): TimelineState {
  const timeline = [...years]
  const expandedYears =
    timeline.length > 0 ? new Set<number>([timeline[0].year]) : new Set<number>()
  const hasMore = typeof totalYearCount === "number" ? timeline.length < totalYearCount : false

  return {
    status: "idle",
    timeline,
    expandedYears,
    hasMore,
    nextOffset: timeline.length,
    error: null,
  }
}

function mergeArchiveTimeline(current: ArchiveYear[], incoming: ArchiveYear[]): ArchiveYear[] {
  if (incoming.length === 0) {
    return current
  }

  // 使用 Map 存储年份数据，支持更新已有年份
  const yearMap = new Map(current.map((item) => [item.year, item]))

  incoming.forEach((incomingYear) => {
    const existing = yearMap.get(incomingYear.year)
    if (existing) {
      // 合并月份数据：使用 Map 去重并更新
      const monthMap = new Map(existing.months.map((m) => [m.month, m]))
      incomingYear.months.forEach((m) => monthMap.set(m.month, m))

      // 更新年份数据：重新计算月份列表和总数
      existing.months = Array.from(monthMap.values()).sort((a, b) => b.month - a.month)
      existing.totalCount = existing.months.reduce((sum, m) => sum + m.count, 0)
    } else {
      yearMap.set(incomingYear.year, incomingYear)
    }
  })

  // 按年份降序排序，确保结构稳定可预期
  return Array.from(yearMap.values()).sort((a, b) => b.year - a.year)
}

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "hydrate":
      return createInitialTimelineState(action.payload.timeline, action.payload.totalYearCount)
    case "toggleYear": {
      const nextExpandedYears = new Set(state.expandedYears)
      if (nextExpandedYears.has(action.year)) {
        nextExpandedYears.delete(action.year)
      } else {
        nextExpandedYears.add(action.year)
      }
      return {
        ...state,
        expandedYears: nextExpandedYears,
      }
    }
    case "fetchStart":
      if (state.status === "loading") {
        return state
      }
      return {
        ...state,
        status: "loading",
        error: null,
      }
    case "fetchSuccess": {
      const mergedTimeline = mergeArchiveTimeline(state.timeline, action.payload.incoming)
      return {
        ...state,
        status: "idle",
        timeline: mergedTimeline,
        hasMore: action.payload.hasMore,
        nextOffset: action.payload.nextOffset,
        error: null,
      }
    }
    case "fetchError":
      return {
        ...state,
        status: "error",
        error: action.message,
      }
    default:
      return state
  }
}

export default function ArchiveTimeline({
  data,
  totalYearCount,
  initialChunkSize = DEFAULT_CHUNK_SIZE,
}: ArchiveTimelineProps) {
  const chunkSize = initialChunkSize > 0 ? initialChunkSize : DEFAULT_CHUNK_SIZE
  const [state, dispatch] = useReducer(
    timelineReducer,
    { timeline: data, totalYearCount },
    (initialArg) => createInitialTimelineState(initialArg.timeline, initialArg.totalYearCount)
  )
  const isFetching = state.status === "loading"
  const error = state.status === "error" ? state.error : null

  const [sentinelRef, isSentinelVisible] = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "200px",
  })

  useEffect(() => {
    dispatch({ type: "hydrate", payload: { timeline: data, totalYearCount } })
  }, [data, totalYearCount])

  const toggleYear = useCallback((year: number) => {
    dispatch({ type: "toggleYear", year })
  }, [])

  const fetchMore = useCallback(async () => {
    if (!state.hasMore || state.status === "loading") {
      return
    }

    const currentOffset = state.nextOffset
    dispatch({ type: "fetchStart" })

    try {
      const response = await fetch(
        `/api/archive/chunk?offset=${currentOffset}&limit=${chunkSize}`,
        { cache: "no-store" }
      )

      if (!response.ok) {
        throw new Error("LOAD_FAILED")
      }

      const payload = await response.json()
      const incoming: ArchiveYear[] = Array.isArray(payload?.years) ? payload.years : []

      const nextOffset =
        typeof payload?.nextOffset === "number" ? payload.nextOffset : currentOffset + chunkSize

      dispatch({
        type: "fetchSuccess",
        payload: {
          incoming,
          hasMore: Boolean(payload?.hasMore),
          nextOffset,
        },
      })
    } catch (err) {
      logger.error("加载更多归档失败", { error: err })
      dispatch({ type: "fetchError", message: "加载更多失败，请稍后重试。" })
    }
  }, [state.hasMore, state.status, state.nextOffset, chunkSize])

  useEffect(() => {
    if (isSentinelVisible && state.status !== "error") {
      fetchMore().catch(() => {
        // 错误已在 fetchMore 内部处理
      })
    }
  }, [isSentinelVisible, fetchMore, state.status])

  return (
    <div className="relative" aria-live="polite">
      <div className="from-primary/50 via-primary/20 absolute bottom-0 left-0 top-0 w-0.5 bg-gradient-to-b to-transparent" />

      <div className="space-y-8 pl-8">
        {state.timeline.map((yearData, index) => (
          <motion.div
            key={yearData.year}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.3) }}
          >
            <ArchiveYearGroup
              yearData={yearData}
              isExpanded={state.expandedYears.has(yearData.year)}
              onToggle={() => toggleYear(yearData.year)}
            />
          </motion.div>
        ))}

        {isFetching && <ArchiveYearSkeleton />}

        {state.hasMore && (
          <div className="flex flex-col items-center gap-3 pt-4">
            <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
            <Button type="button" variant="outline" onClick={fetchMore} disabled={isFetching}>
              {isFetching ? "加载中…" : "加载更多年份"}
            </Button>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
