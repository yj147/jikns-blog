/**
 * 客户端分页组件 - Phase 5.2
 * 处理博客列表分页的客户端交互
 */

"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { BlogPagination } from "./blog-pagination"
import { PaginationMeta } from "@/types/blog"
import { createBlogListUrl, parseSearchParams } from "@/lib/utils/blog-helpers"

interface ClientPaginationProps {
  pagination: PaginationMeta
  className?: string
}

export function ClientPagination({ pagination, className }: ClientPaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = useCallback(
    (newPage: number) => {
      const currentParams = parseSearchParams(searchParams)

      const url = createBlogListUrl({
        page: newPage,
        q: currentParams.q,
        tag: currentParams.tag,
        sort: currentParams.sort,
        author: currentParams.author,
      })

      router.push(url)
    },
    [searchParams, router]
  )

  return (
    <BlogPagination pagination={pagination} onPageChange={handlePageChange} className={className} />
  )
}
