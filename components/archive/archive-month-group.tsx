"use client"

import { memo, useState } from "react"
import { ArchiveMonth } from "@/lib/actions/archive"
import ArchivePostItem from "./archive-post-item"
import { ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ArchiveMonthGroupProps {
  year: number
  monthData: ArchiveMonth
}

function ArchiveMonthGroupComponent({ year, monthData }: ArchiveMonthGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const panelId = `archive-month-${year}-${monthData.month}-panel`
  const remainingCount = Math.max(monthData.count - monthData.posts.length, 0)

  return (
    <div className="relative" id={`month-${year}-${monthData.month}`}>
      {/* 月份时间节点 */}
      <div className="bg-primary/50 absolute -left-8 top-2 h-2 w-2 rounded-full" />

      {/* 月份标题 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={cn(
            "group flex cursor-pointer items-center gap-2",
            "hover:text-primary focus-visible:ring-ring rounded-md px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          )}
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
        >
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="h-3 w-3" />
          </motion.div>
          <h3 className="font-medium">{monthData.monthName}</h3>
          <span className="text-muted-foreground text-sm">({monthData.count} 篇)</span>
        </button>

        <Link
          href={`/archive/${year}/${monthData.month.toString().padStart(2, "0")}`}
          prefetch={false}
          className="text-muted-foreground hover:text-primary focus-visible:ring-ring rounded-md px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label={`${year} 年 ${monthData.monthName}的所有文章`}
        >
          查看全部
        </Link>
      </div>

      {/* 文章列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
            id={panelId}
            role="region"
            aria-label={`${year} 年 ${monthData.monthName} 文章列表`}
          >
            <div className="ml-4 mt-3 space-y-2">
              {monthData.posts.map((post) => (
                <ArchivePostItem key={post.id} post={post} />
              ))}
              {remainingCount > 0 && (
                <Link
                  href={`/archive/${year}/${monthData.month.toString().padStart(2, "0")}`}
                  prefetch={false}
                  className="text-muted-foreground hover:text-primary block pl-8 text-sm transition-colors"
                  aria-label={`查看 ${year} 年 ${monthData.monthName}的更多文章`}
                >
                  查看更多 ({remainingCount} 篇) →
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(ArchiveMonthGroupComponent)
