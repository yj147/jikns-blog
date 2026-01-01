"use client"

import { memo } from "react"
import { ArchiveYear } from "@/lib/actions/archive"
import ArchiveMonthGroup from "./archive-month-group"
import { ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface ArchiveYearGroupProps {
  yearData: ArchiveYear
  isExpanded: boolean
  onToggle: () => void
}

function ArchiveYearGroupComponent({ yearData, isExpanded, onToggle }: ArchiveYearGroupProps) {
  const panelId = `archive-year-${yearData.year}-panel`

  return (
    <div className="relative" id={`year-${yearData.year}`}>
      {/* 年份时间节点 */}
      <div className="bg-primary ring-background absolute -left-8 top-0 h-4 w-4 rounded-full ring-4" />

      {/* 年份标题 */}
      <button
        type="button"
        className={cn(
          "group flex cursor-pointer items-center gap-3",
          "hover:text-primary focus-visible:ring-ring rounded-md px-1 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        )}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        <Calendar className="text-muted-foreground h-5 w-5" />
        <h2 className="text-xl font-bold">{yearData.year} 年</h2>
        <span className="text-muted-foreground text-sm">({yearData.totalCount} 篇)</span>
        <ChevronRight
          className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-90")}
        />
      </button>

      {/* 月份列表 */}
      {isExpanded && (
        <div
          className="overflow-hidden"
          id={panelId}
          role="region"
          aria-label={`${yearData.year} 年份文章`}
        >
          <div className="ml-8 mt-4 space-y-4">
            {yearData.months.map((monthData) => (
              <ArchiveMonthGroup
                key={`${yearData.year}-${monthData.month}`}
                year={yearData.year}
                monthData={monthData}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ArchiveYearGroupComponent)
