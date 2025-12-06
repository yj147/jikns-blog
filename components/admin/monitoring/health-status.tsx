"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface HealthStatusProps {
  status: "healthy" | "degraded" | "unhealthy"
  uptime: number
}

export const HealthStatus: React.FC<HealthStatusProps> = ({ status, uptime }) => {
  const statusConfig = {
    healthy: {
      color: "bg-status-success",
      textColor: "text-status-success",
      label: "健康",
      description: "系统运行正常",
    },
    degraded: {
      color: "bg-status-warning",
      textColor: "text-status-warning",
      label: "降级",
      description: "系统性能下降",
    },
    unhealthy: {
      color: "bg-status-error",
      textColor: "text-status-error",
      label: "异常",
      description: "系统存在问题",
    },
  }

  const config = statusConfig[status]
  const uptimeHours = Math.floor(uptime / 3600)
  const uptimeDays = Math.floor(uptimeHours / 24)

  const formatUptime = () => {
    if (uptimeDays > 0) {
      return `${uptimeDays} 天 ${uptimeHours % 24} 小时`
    }
    return `${uptimeHours} 小时 ${Math.floor((uptime % 3600) / 60)} 分钟`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded-full", config.color)} />
          系统健康状态
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className={cn("text-lg font-semibold", config.textColor)}>{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">运行时间</p>
            <p className="text-sm text-muted-foreground">{formatUptime()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
