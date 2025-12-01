"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Hash, Plus, Search } from "lucide-react"

interface TagQueryPanelProps {
  totalItems: number
  searchValue: string
  onSearchChange: (value: string) => void
  sortValue: string
  onSortChange: (value: string) => void
  onCreateClick: () => void
}

export function TagQueryPanel({
  totalItems,
  searchValue,
  onSearchChange,
  sortValue,
  onSortChange,
  onCreateClick,
}: TagQueryPanelProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">标签管理</h1>
          <p className="text-muted-foreground mt-2">管理博客文章的标签分类</p>
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          创建标签
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总标签数</CardTitle>
            <Hash className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <CardDescription>统计已发布文章关联的标签</CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="搜索标签名称..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postsCount-desc">文章数（多到少）</SelectItem>
            <SelectItem value="postsCount-asc">文章数（少到多）</SelectItem>
            <SelectItem value="name-asc">名称（A-Z）</SelectItem>
            <SelectItem value="name-desc">名称（Z-A）</SelectItem>
            <SelectItem value="createdAt-desc">创建时间（新到旧）</SelectItem>
            <SelectItem value="createdAt-asc">创建时间（旧到新）</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
