"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RealtimeStatusProps {
  state: "realtime" | "polling" | "idle" | "error"
  lastUpdated?: Date | null
}

export const RealtimeStatus: React.FC<RealtimeStatusProps> = ({ state, lastUpdated }) => {
  const config = {
    realtime: { label: "实时更新", color: "bg-status-success", text: "text-status-success" },
    polling: { label: "轮询模式", color: "bg-status-warning", text: "text-status-warning" },
    idle: { label: "初始化", color: "bg-muted-foreground/40", text: "text-muted-foreground" },
    error: { label: "已降级", color: "bg-status-error", text: "text-status-error" },
  } as const

  const current = config[state]

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn("h-2.5 w-2.5 rounded-full", current.color)} />
      <span className={cn("font-medium", current.text)}>{current.label}</span>
      {lastUpdated && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          更新于 {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
