"use client"

import { memo, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCompactCount } from "@/lib/utils"
import type { FeedItem } from "@/types/feed"

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

interface FeedTableProps {
  feeds: FeedItem[]
  selectedIds: string[]
  onToggleItem: (id: string) => void
  onToggleAll: () => void
  onOpenDetail: (feed: FeedItem) => void
  isLoading: boolean
}

function FeedTableComponent({ feeds, selectedIds, onToggleItem, onToggleAll, onOpenDetail, isLoading }: FeedTableProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const isAllSelected = feeds.length > 0 && feeds.every((feed) => selectedSet.has(feed.id))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label="全选当前页"
              checked={isAllSelected}
              onCheckedChange={() => onToggleAll()}
            />
          </TableHead>
          <TableHead>内容</TableHead>
          <TableHead>作者</TableHead>
          <TableHead>互动数据</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="w-[120px] text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {feeds.map((feed) => {
          const isSelected = selectedSet.has(feed.id)
          return (
            <TableRow key={feed.id} data-selected={isSelected} className={isSelected ? "bg-muted/40" : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={`选择动态 ${feed.id}`}
                  checked={isSelected}
                  onCheckedChange={() => onToggleItem(feed.id)}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {feed.isPinned && <Badge variant="secondary">置顶</Badge>}
                    {feed.deletedAt ? (
                      <Badge variant="destructive">已隐藏</Badge>
                    ) : (
                      <Badge variant="outline">可见</Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{feed.content || "（无正文）"}</p>
                  {feed.imageUrls.length > 0 && (
                    <p className="text-xs text-muted-foreground">图片 {feed.imageUrls.length} 张</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{feed.author.name ?? feed.author.email ?? "未命名"}</p>
                  <p className="text-xs text-muted-foreground">ID: {feed.authorId}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-xs text-muted-foreground">
                  <p>点赞 · {formatCompactCount(feed.likesCount)}</p>
                  <p>评论 · {formatCompactCount(feed.commentsCount)}</p>
                  <p>浏览 · {formatCompactCount(feed.viewsCount)}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">{dateFormatter.format(new Date(feed.createdAt))}</div>
                <p className="text-xs text-muted-foreground">更新 {dateFormatter.format(new Date(feed.updatedAt))}</p>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onOpenDetail(feed)}>
                  查看详情
                </Button>
              </TableCell>
            </TableRow>
          )
        })}

        {isLoading && feeds.length === 0 && (
          <TableRow>
            <TableCell colSpan={6}>
              <Skeleton className="h-16 w-full" />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export const FeedTable = memo(FeedTableComponent)
