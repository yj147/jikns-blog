import FeedPageClient from "@/components/feed/feed-page-client"
import { getOptionalViewer } from "@/lib/auth/session"
import { getFeatureFlags } from "@/lib/config/client-feature-flags"
import { listActivities } from "@/lib/repos/activity-repo"
import type { ActivityWithAuthor } from "@/types/activity"
import { signActivityListItems } from "@/lib/storage/signed-url"

const INITIAL_LIMIT = 10
type FeedTab = "latest" | "trending" | "following"

export const dynamic = "force-dynamic"

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string | string[] }>
}) {
  const featureFlags = await getFeatureFlags()
  const viewer = await getOptionalViewer()
  const viewerId = viewer?.id ?? null
  const resolvedParams = await searchParams
  const highlightParam = resolvedParams?.highlight
  const highlightActivityId = Array.isArray(highlightParam)
    ? highlightParam[0]
    : highlightParam || undefined

  const initialTab: FeedTab = featureFlags.feedFollowingStrict && viewerId ? "following" : "latest"
  const initialResult = await fetchInitialActivities(initialTab, viewerId)

  return (
    <FeedPageClient
      featureFlags={featureFlags}
      initialActivities={initialResult.activities}
      initialPagination={{
        limit: INITIAL_LIMIT,
        total: initialResult.totalCount,
        hasMore: initialResult.hasMore,
        nextCursor: initialResult.nextCursor,
      }}
      initialTab={initialTab}
      highlightActivityId={highlightActivityId}
    />
  )
}

async function fetchInitialActivities(orderBy: FeedTab, userId: string | null) {
  try {
    const result = await listActivities({
      orderBy,
      limit: INITIAL_LIMIT,
      followingUserId: orderBy === "following" ? userId : null,
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
