/**
 * 搜索分页组件 - Phase 11 / M3 / 优化
 * 负责上一页/下一页导航，与 URL 参数联动
 */

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

interface SearchPaginationProps {
  currentPage: number
  hasPrevious: boolean
  hasNext: boolean
  buildHref: (page: number) => string
  totalPages?: number
  className?: string
}

export function SearchPagination({
  currentPage,
  hasPrevious,
  hasNext,
  buildHref,
  totalPages,
  className,
}: SearchPaginationProps) {
  if (!hasPrevious && !hasNext) {
    return null
  }

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          {hasPrevious ? (
            <PaginationPrevious href={buildHref(currentPage - 1)} />
          ) : (
            <PaginationLink
              size="default"
              aria-disabled={true}
              className="text-muted-foreground pointer-events-none"
            >
              上一页
            </PaginationLink>
          )}
        </PaginationItem>

        <PaginationItem>
          <PaginationLink
            size="default"
            isActive
            aria-current="page"
            className={cn("pointer-events-none", !totalPages && "text-muted-foreground")}
          >
            {totalPages ? `第 ${currentPage} 页，共 ${totalPages} 页` : `第 ${currentPage} 页`}
          </PaginationLink>
        </PaginationItem>

        <PaginationItem>
          {hasNext ? (
            <PaginationNext href={buildHref(currentPage + 1)} />
          ) : (
            <PaginationLink
              size="default"
              aria-disabled={true}
              className="text-muted-foreground pointer-events-none"
            >
              下一页
            </PaginationLink>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
