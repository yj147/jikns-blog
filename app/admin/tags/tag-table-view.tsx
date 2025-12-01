"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { TagData } from "@/lib/actions/tags"
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react"

interface TagTableViewProps {
  tags: TagData[]
  isLoading: boolean
  searchTerm: string
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onEdit: (tag: TagData) => void
  onDelete: (tag: TagData) => void
  onCreateClick: () => void
}

export function TagTableView({
  tags,
  isLoading,
  searchTerm,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onCreateClick,
}: TagTableViewProps) {
  const safeTotalPages = Math.max(1, totalPages || 1)
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < safeTotalPages

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-4 p-6">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">
              {searchTerm ? "未找到匹配的标签" : "还没有标签"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "尝试使用不同的搜索词" : "创建第一个标签来开始组织你的文章"}
            </p>
            {!searchTerm && (
              <Button onClick={onCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                创建标签
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-center">文章数</TableHead>
                  <TableHead className="text-center">动态数</TableHead>
                  <TableHead className="text-center">颜色</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium">{tag.name}</span>
                        <code className="text-muted-foreground block text-xs">{tag.slug}</code>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{tag.postsCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{tag.activitiesCount ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {tag.color ? (
                        <div className="inline-flex items-center justify-center gap-2">
                          <div className="h-4 w-4 rounded" style={{ backgroundColor: tag.color }} />
                          <span className="text-muted-foreground text-xs">{tag.color}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(tag)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDelete(tag)}>
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="text-muted-foreground flex items-center justify-between border-t px-6 py-4 text-sm">
              <div>
                第 <span className="text-foreground font-semibold">{currentPage}</span> /{" "}
                <span className="text-foreground font-semibold">{safeTotalPages}</span> 页
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={!canGoPrev || isLoading}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={!canGoNext || isLoading}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
