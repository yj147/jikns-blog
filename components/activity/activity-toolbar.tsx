"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Filter, RefreshCw, Search, TrendingUp, Clock, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ActivityFilters, ActivityOrderBy } from "@/types/activity"

export interface ActivityToolbarProps {
  filters: ActivityFilters
  canViewFollowing: boolean
  onOrderChange: (order: ActivityOrderBy) => void
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  onApplySearch: () => void
  onClearSearch: () => void
  hasActiveFilters: boolean
  showFilters: boolean
  onOpenFilters: () => void
  onRefresh: () => void
  isLoading: boolean
}

export function ActivityToolbar({
  filters,
  canViewFollowing,
  onOrderChange,
  searchDraft,
  onSearchDraftChange,
  onApplySearch,
  onClearSearch,
  hasActiveFilters,
  showFilters,
  onOpenFilters,
  onRefresh,
  isLoading,
}: ActivityToolbarProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Label htmlFor="order-select" className="whitespace-nowrap text-sm">
            排序方式：
          </Label>
          <Select
            value={filters.orderBy}
            onValueChange={(value) => onOrderChange(value as ActivityOrderBy)}
          >
            <SelectTrigger className="w-32" id="order-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ActivityOrderBy.LATEST}>
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  最新
                </div>
              </SelectItem>
              <SelectItem value={ActivityOrderBy.TRENDING}>
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  热门
                </div>
              </SelectItem>
              <SelectItem value={ActivityOrderBy.FOLLOWING} disabled={!canViewFollowing}>
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  关注
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="搜索动态..."
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onApplySearch()
            }}
            className="w-64 pl-10 pr-8"
          />
          {searchDraft && (
            <button
              onClick={onClearSearch}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 transform"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <Badge variant="secondary" className="text-xs">
            已应用过滤器
          </Badge>
        )}

        {showFilters && (
          <Button variant="outline" size="sm" onClick={onOpenFilters}>
            <Filter className="mr-2 h-4 w-4" />
            过滤
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onApplySearch} disabled={isLoading}>
          应用搜索
        </Button>

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          刷新
        </Button>
      </div>
    </div>
  )
}

export interface ActivityMetaSummaryProps {
  total: number | null
  appliedFilters: {
    searchTerm?: string
    tags?: string[]
    publishedFrom?: string
    publishedTo?: string
  } | null
}

export function ActivityMetaSummary({ total, appliedFilters }: ActivityMetaSummaryProps) {
  const hasAnySummary =
    total !== null ||
    !!appliedFilters?.searchTerm ||
    (appliedFilters?.tags?.length ?? 0) > 0 ||
    !!appliedFilters?.publishedFrom ||
    !!appliedFilters?.publishedTo

  if (!hasAnySummary) return null

  const formattedRange = (() => {
    const start = appliedFilters?.publishedFrom ? new Date(appliedFilters.publishedFrom) : null
    const end = appliedFilters?.publishedTo ? new Date(appliedFilters.publishedTo) : null
    if (!start && !end) return null
    const startLabel = start ? start.toLocaleDateString() : "起"
    const endLabel = end ? end.toLocaleDateString() : "今"
    return `${startLabel} ~ ${endLabel}`
  })()

  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      {total !== null && <div>共 {total} 条动态</div>}
      {appliedFilters?.searchTerm && (
        <div>
          当前搜索：<span className="font-medium">{appliedFilters.searchTerm}</span>
        </div>
      )}
      {(appliedFilters?.tags?.length ?? 0) > 0 && (
        <div>
          标签：<span className="font-medium">{appliedFilters?.tags?.join(", ")}</span>
        </div>
      )}
      {formattedRange && (
        <div>
          时间区间：<span className="font-medium">{formattedRange}</span>
        </div>
      )}
    </div>
  )
}
