"use client"

import { Filter, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { FeedFiltersValue, PinnedFilter } from "@/hooks/useFeedFilters"

interface FeedFiltersProps {
  filters: FeedFiltersValue
  isAdmin: boolean
  hasActiveFilters: boolean
  currentUserId?: string | null
  onSearchChange: (value: string) => void
  onAuthorChange: (value: string) => void
  onPinnedChange: (value: PinnedFilter) => void
  onIncludeDeletedChange: (value: boolean) => void
  onDateRangeChange: (from: string | null, to: string | null) => void
  onReset: () => void
}

export function FeedFilters({
  filters,
  isAdmin,
  hasActiveFilters,
  currentUserId,
  onSearchChange,
  onAuthorChange,
  onPinnedChange,
  onIncludeDeletedChange,
  onDateRangeChange,
  onReset,
}: FeedFiltersProps) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        筛选条件
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="feed-search">关键词</Label>
          <Input
            id="feed-search"
            placeholder="搜索内容、标签或描述"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="feed-author">作者 ID</Label>
            <div className="flex gap-2">
              <Input
                id="feed-author"
                placeholder="输入作者 ID（UUID）"
                value={filters.authorId}
                onChange={(event) => onAuthorChange(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!currentUserId}
                onClick={() => currentUserId && onAuthorChange(currentUserId)}
              >
                只看我
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>置顶状态</Label>
          <Select
            value={filters.pinned}
            onValueChange={(value) => onPinnedChange(value as PinnedFilter)}
          >
            <SelectTrigger aria-label="置顶筛选">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pinned">仅置顶</SelectItem>
              <SelectItem value="unpinned">未置顶</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feed-date-from">开始日期</Label>
          <Input
            id="feed-date-from"
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(event) => onDateRangeChange(event.target.value || null, filters.dateTo)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="feed-date-to">结束日期</Label>
          <Input
            id="feed-date-to"
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(event) => onDateRangeChange(filters.dateFrom, event.target.value || null)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Switch
              id="feed-include-deleted"
              checked={filters.includeDeleted}
              onCheckedChange={(checked) => onIncludeDeletedChange(Boolean(checked))}
            />
            <Label htmlFor="feed-include-deleted" className="font-normal">
              包含已隐藏的动态
            </Label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            清空筛选
          </Button>
        </div>
      </div>
    </section>
  )
}
