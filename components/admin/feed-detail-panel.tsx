"use client"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatCompactCount } from "@/lib/utils"
import type { FeedItem } from "@/types/feed"

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

interface FeedDetailPanelProps {
  feed: FeedItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedDetailPanel({ feed, open, onOpenChange }: FeedDetailPanelProps) {
  if (!feed) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>动态详情</SheetTitle>
          <SheetDescription>Feed ID：{feed.id}</SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            {feed.isPinned && <Badge variant="secondary">置顶</Badge>}
            {feed.deletedAt ? (
              <Badge variant="destructive">已隐藏</Badge>
            ) : (
              <Badge variant="outline">对外可见</Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-full px-6 py-4">
          <div className="space-y-4">
            <section className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">内容</h4>
              <p className="whitespace-pre-line rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
                {feed.content || "（无正文）"}
              </p>
            </section>

            {feed.imageUrls.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">图片</h4>
                <div className="grid grid-cols-2 gap-3">
                  {feed.imageUrls.map((url) => (
                    <div key={url} className="overflow-hidden rounded-md border">
                      <img src={url} alt="Feed 图片" className="h-32 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm">
              <div>
                <p className="text-muted-foreground">点赞</p>
                <p className="text-base font-semibold">{formatCompactCount(feed.likesCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">评论</p>
                <p className="text-base font-semibold">{formatCompactCount(feed.commentsCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">浏览</p>
                <p className="text-base font-semibold">{formatCompactCount(feed.viewsCount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">作者</p>
                <p className="text-base font-semibold">{feed.author.name ?? feed.author.email ?? feed.authorId}</p>
              </div>
            </section>

            <Separator />

            <section className="space-y-2 text-xs text-muted-foreground">
              <p>作者 ID：{feed.authorId}</p>
              <p>创建时间：{dateFormatter.format(new Date(feed.createdAt))}</p>
              <p>更新时间：{dateFormatter.format(new Date(feed.updatedAt))}</p>
              {feed.deletedAt && <p>隐藏时间：{dateFormatter.format(new Date(feed.deletedAt))}</p>}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
