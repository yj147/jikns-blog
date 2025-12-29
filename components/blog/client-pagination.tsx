/**
 * 客户端分页组件 - Phase 5.2
 * 处理博客列表分页的客户端交互
 */

"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { BlogPagination } from "./blog-pagination"
import { PaginationMeta } from "@/types/blog"

interface ClientPaginationProps {
  pagination: PaginationMeta
  className?: string
}

export function ClientPagination({ pagination, className }: ClientPaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", String(newPage))

      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  return (
    <BlogPagination pagination={pagination} onPageChange={handlePageChange} className={className} />
  )
}
