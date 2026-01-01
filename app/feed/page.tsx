import { Suspense } from "react"
import FeedPageClient from "@/components/feed/feed-page-client"
import { getFeatureFlags } from "@/lib/config/client-feature-flags"
import { listActivities } from "@/lib/repos/activity-repo"
import type { ActivityWithAuthor } from "@/types/activity"
import { signActivityListItems } from "@/lib/storage/signed-url"
import FeedLoading from "./loading"

const INITIAL_LIMIT = 10
type FeedTab = "latest" | "trending" | "following"

export const revalidate = 30

export default async function FeedPage() {
  const featureFlags = await getFeatureFlags()

  // `/feed` 首屏不应该被认证链路阻塞：默认渲染最新流；关注流由客户端在已登录后按需加载。
  const initialTab: FeedTab = "latest"
  const baseInitialResult = await fetchInitialActivities("latest")

  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedPageClient
        featureFlags={featureFlags}
        initialActivities={baseInitialResult.activities}
        initialPagination={{
          limit: INITIAL_LIMIT,
          total: baseInitialResult.totalCount,
          hasMore: baseInitialResult.hasMore,
          nextCursor: baseInitialResult.nextCursor,
        }}
        initialTab={initialTab}
      />
    </Suspense>
  )
}

async function fetchInitialActivities(orderBy: FeedTab) {
  try {
    const result = await listActivities({
      orderBy,
      limit: INITIAL_LIMIT,
      includeTotalCount: false,
    })

    const signed = await signActivityListItems(result.items)

    return {
      activities: signed as ActivityWithAuthor[],
      hasMore: result.hasMore,
      nextCursor: result.nextCursor ?? null,
      totalCount: result.totalCount,
    }
  } catch (error) {
    console.error("Failed to fetch initial activities:", error)
    return {
      activities: [] as ActivityWithAuthor[],
      hasMore: false,
      nextCursor: null,
      totalCount: null,
    }
  }
}
