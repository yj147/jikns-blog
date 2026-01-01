/**
 * 博客分页组件 - Phase 5.2
 * 提供用户友好的分页导航
 */

"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { PaginationMeta } from "@/types/blog"

interface BlogPaginationProps {
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  className?: string
}

export function BlogPagination({ pagination, onPageChange, className = "" }: BlogPaginationProps) {
  const { page: currentPage, totalPages, hasNext, hasPrev } = pagination

  // 生成页码数组
  const generatePageNumbers = () => {
    const pages: (number | "ellipsis")[] = []
    const delta = 2 // 当前页面前后显示的页数

    // 总是显示第一页
    pages.push(1)

    // 计算开始和结束页码
    const startPage = Math.max(2, currentPage - delta)
    const endPage = Math.min(totalPages - 1, currentPage + delta)

    // 添加省略号（如果需要）
    if (startPage > 2) {
      pages.push("ellipsis")
    }

    // 添加中间的页码
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    // 添加省略号（如果需要）
    if (endPage < totalPages - 1) {
      pages.push("ellipsis")
    }

    // 总是显示最后一页（如果总页数大于1）
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = generatePageNumbers()

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      {/* 上一页按钮 */}
      <div className="transition-transform duration-200 hover:scale-105 active:scale-95">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="flex items-center space-x-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">上一页</span>
        </Button>
      </div>

      {/* 页码按钮 */}
      <div className="flex items-center space-x-1">
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "ellipsis") {
            return (
              <div key={`ellipsis-${index}`} className="px-2">
                <MoreHorizontal className="text-muted-foreground h-4 w-4" />
              </div>
            )
          }

          const isActive = pageNum === currentPage

          return (
            <div
              key={pageNum}
              className={`transition-transform duration-200 active:scale-95 ${isActive ? "" : "hover:scale-110"}`}
            >
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[40px] ${isActive ? "pointer-events-none" : ""}`}
              >
                {pageNum}
              </Button>
            </div>
          )
        })}
      </div>

      {/* 下一页按钮 */}
      <div className="transition-transform duration-200 hover:scale-105 active:scale-95">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="flex items-center space-x-1"
        >
          <span className="hidden sm:inline">下一页</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 页面信息 */}
      <div className="text-muted-foreground ml-4 hidden items-center text-sm lg:flex">
        第 {currentPage} 页，共 {totalPages} 页
      </div>
    </div>
  )
}

interface SimplePaginationProps {
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  className?: string
}

// 简化版分页组件（只显示上一页/下一页）
export function SimplePagination({
  pagination,
  onPageChange,
  className = "",
}: SimplePaginationProps) {
  const { page: currentPage, totalPages, hasNext, hasPrev } = pagination

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="transition-transform duration-200 hover:scale-105 active:scale-95">
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>上一页</span>
        </Button>
      </div>

      <span className="text-muted-foreground text-sm">
        第 {currentPage} 页，共 {totalPages} 页
      </span>

      <div className="transition-transform duration-200 hover:scale-105 active:scale-95">
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="flex items-center space-x-2"
        >
          <span>下一页</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
