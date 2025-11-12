"use client"

import { ActivityFilters } from "@/types/activity"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ActivityFiltersDialogProps {
  open: boolean
  onOpenChange: (value: boolean) => void
  filters: ActivityFilters
  hasActiveFilters: boolean
  canFilterPinned: boolean
  tagDraft: string
  onTagDraftChange: (value: string) => void
  applyTags: () => void
  dateFromDraft: string
  onDateFromChange: (value: string) => void
  dateToDraft: string
  onDateToChange: (value: string) => void
  handleDateChange: (type: "start" | "end", value: string) => void
  clearTagsAndDates: () => void
  clearAllFilters: () => void
  mergeFilters: (payload: Partial<ActivityFilters>) => void
}

export function ActivityFiltersDialog({
  open,
  onOpenChange,
  filters,
  hasActiveFilters,
  canFilterPinned,
  tagDraft,
  onTagDraftChange,
  applyTags,
  dateFromDraft,
  onDateFromChange,
  dateToDraft,
  onDateToChange,
  handleDateChange,
  clearTagsAndDates,
  clearAllFilters,
  mergeFilters,
}: ActivityFiltersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>过滤动态</DialogTitle>
          <DialogDescription>选择过滤条件来缩小动态范围</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">图片内容</Label>
            <Select
              value={
                filters.hasImages === undefined ? "all" : filters.hasImages ? "with" : "without"
              }
              onValueChange={(value) =>
                mergeFilters({ hasImages: value === "all" ? undefined : value === "with" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="with">包含图片</SelectItem>
                <SelectItem value="without">纯文字</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canFilterPinned && (
            <div>
              <Label className="text-sm font-medium">置顶状态</Label>
              <Select
                value={
                  filters.isPinned === undefined ? "all" : filters.isPinned ? "pinned" : "normal"
                }
                onValueChange={(value) =>
                  mergeFilters({ isPinned: value === "all" ? undefined : value === "pinned" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pinned">置顶动态</SelectItem>
                  <SelectItem value="normal">普通动态</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">标签（用逗号分隔）</Label>
            <div className="flex gap-2">
              <Input
                placeholder="design, marketing"
                value={tagDraft}
                onChange={(event) => onTagDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applyTags()
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={applyTags}>
                应用
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">开始日期</Label>
              <Input
                type="date"
                value={dateFromDraft}
                onChange={(event) => {
                  const value = event.target.value
                  onDateFromChange(value)
                  handleDateChange("start", value)
                }}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">结束日期</Label>
              <Input
                type="date"
                value={dateToDraft}
                onChange={(event) => {
                  const value = event.target.value
                  onDateToChange(value)
                  handleDateChange("end", value)
                }}
              />
            </div>
          </div>

          {(filters.tags && filters.tags.length > 0) ||
          filters.dateRange?.start ||
          filters.dateRange?.end ? (
            <Button variant="ghost" size="sm" onClick={clearTagsAndDates}>
              清除标签与日期
            </Button>
          ) : null}

          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="w-full">
              清除所有过滤器
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
