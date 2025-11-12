"use client"

import { memo, useMemo } from "react"
import { ArchiveStats as ArchiveStatsType } from "@/lib/actions/archive"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Calendar, TrendingUp, Clock } from "lucide-react"
import { motion } from "framer-motion"

interface ArchiveStatsProps {
  stats: ArchiveStatsType
}

function ArchiveStatsComponent({ stats }: ArchiveStatsProps) {
  const dateRange = useMemo(() => {
    if (!stats.oldestPost || !stats.newestPost) {
      return "暂无数据"
    }

    const oldest = new Date(stats.oldestPost)
    const newest = new Date(stats.newestPost)

    return `${oldest.getFullYear()}年${oldest.getMonth() + 1}月 - ${newest.getFullYear()}年${newest.getMonth() + 1}月`
  }, [stats.oldestPost, stats.newestPost])

  const averagePerYear = useMemo(() => {
    if (stats.totalYears === 0) return 0
    return Math.round(stats.totalPosts / stats.totalYears)
  }, [stats.totalPosts, stats.totalYears])

  const statItems = useMemo(
    () => [
      {
        icon: FileText,
        label: "总文章数",
        value: stats.totalPosts,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      },
      {
        icon: Calendar,
        label: "时间跨度",
        value: `${stats.totalYears} 年`,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
      },
      {
        icon: TrendingUp,
        label: "年均文章",
        value: averagePerYear,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
      },
      {
        icon: Clock,
        label: "发布时间",
        value: dateRange,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        wide: true,
      },
    ],
    [stats.totalPosts, stats.totalYears, averagePerYear, dateRange]
  )

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={item.wide ? "md:col-span-3" : ""}
        >
          <Card className="border-none shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-lg p-3 ${item.bgColor}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">{item.label}</p>
                <p className="text-xl font-semibold">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

export default memo(ArchiveStatsComponent)
