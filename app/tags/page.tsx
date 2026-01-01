/**
 * 标签云页面
 * Phase 10 - M3 阶段
 */

import { Suspense } from "react"
import { Metadata } from "next"
import { getTags } from "@/lib/actions/tags/queries-cacheable"
import type { TagData, TagListPagination } from "@/lib/actions/tags/queries-cacheable"
import { logger } from "@/lib/utils/logger"
import { TagsPageClient } from "./tags-page-client"

const PAGE_SIZE = 60
export const revalidate = 120

// 页面元数据
export const metadata: Metadata = {
  title: "标签云 - 探索所有主题",
  description: "浏览所有博客标签，发现感兴趣的主题和内容分类",
  openGraph: {
    title: "标签云 - 探索所有主题",
    description: "浏览所有博客标签，发现感兴趣的主题和内容分类",
    type: "website",
  },
}

function TagsPageFallback() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="bg-primary/10 text-primary rounded-full p-4" aria-hidden>
              <div className="bg-muted h-8 w-8 rounded-full" />
            </div>
          </div>
          <div className="bg-muted mx-auto mb-4 h-10 w-40 animate-pulse rounded" />
          <div className="bg-muted mx-auto h-6 w-80 animate-pulse rounded" />
        </div>

        <div className="mx-auto mb-12 max-w-2xl">
          <div className="bg-muted h-10 w-full animate-pulse rounded" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="bg-muted h-40 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function TagsPage() {
  const result = await getTags({
    page: 1,
    limit: PAGE_SIZE,
    orderBy: "postsCount",
    order: "desc",
  })

  let initialError: { code: string; message: string } | null = null
  let initialTags: TagData[] = []
  let initialPagination: TagListPagination | null = null

  if (!result.success) {
    initialError = {
      code: result.error?.code ?? "UNKNOWN_ERROR",
      message: result.error?.message ?? "获取标签列表失败",
    }
    logger.warn("Tags page failed to load tag list", {
      code: initialError.code,
      message: initialError.message,
      details: result.error?.details,
    })
  } else if (result.data) {
    initialTags = result.data.tags ?? []
    initialPagination = result.data.pagination ?? null
  }

  return (
    <Suspense fallback={<TagsPageFallback />}>
      <TagsPageClient
        pageSize={PAGE_SIZE}
        initialTags={initialTags}
        initialPagination={initialPagination}
        initialError={initialError}
      />
    </Suspense>
  )
}
