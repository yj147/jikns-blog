"use client"

import * as React from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: "up" | "down" | "stable"
  status?: "good" | "warning" | "error"
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = "good",
  className,
}) => {
  const statusColors = {
    good: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  }

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null

  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <div className="flex items-center space-x-2">
              <p className={cn("text-2xl font-bold", statusColors[status])}>{value}</p>
              {TrendIcon && (
                <TrendIcon
                  className={cn("h-4 w-4", trend === "up" ? "text-green-600" : "text-red-600")}
                />
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div
            className={cn("rounded-full bg-gray-100 p-3 dark:bg-gray-800", statusColors[status])}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
