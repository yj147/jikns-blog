import FeedPageClient from "@/components/feed/feed-page-client"
import { getFeatureFlags } from "@/lib/config/client-feature-flags"
import { prisma } from "@/lib/prisma"
import { listActivities } from "@/lib/repos/activity-repo"
import type { ActivityListItem } from "@/lib/repos/activity-repo"
import type { ActivityWithAuthor } from "@/types/activity"
import { signActivityListItems } from "@/lib/storage/signed-url"
import { unstable_cache } from "next/cache"

const INITIAL_LIMIT = 10
const INITIAL_LATEST_CACHE_SECONDS = 30
type FeedTab = "latest" | "trending" | "following"

export const dynamic = "force-dynamic"

const getCachedLatestInitialActivities = unstable_cache(
  async () => fetchInitialActivities("latest", null),
  ["feed", "initial", "latest"],
  { revalidate: INITIAL_LATEST_CACHE_SECONDS }
)

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string | string[] }>
}) {
  const featureFlags = await getFeatureFlags()
  const resolvedParams = await searchParams
  const highlightParam = resolvedParams?.highlight
  const highlightActivityId = Array.isArray(highlightParam)
    ? highlightParam[0]
    : highlightParam || undefined

  // `/feed` 首屏不应该被认证链路阻塞：默认渲染最新流；关注流由客户端在已登录后按需加载。
  const initialTab: FeedTab = "latest"
  const baseInitialResult = await getCachedLatestInitialActivities()
  let initialActivities = baseInitialResult.activities

  if (highlightActivityId && !initialActivities.some((item) => item.id === highlightActivityId)) {
    const highlighted = await fetchHighlightedActivity(highlightActivityId)
    if (highlighted) {
      const [signedHighlighted] = await signActivityListItems([highlighted])
      initialActivities = [signedHighlighted as ActivityWithAuthor, ...initialActivities]
    }
  }

  return (
    <FeedPageClient
      featureFlags={featureFlags}
      initialActivities={initialActivities}
      initialPagination={{
        limit: INITIAL_LIMIT,
        total: baseInitialResult.totalCount,
        hasMore: baseInitialResult.hasMore,
        nextCursor: baseInitialResult.nextCursor,
      }}
      initialTab={initialTab}
      highlightActivityId={highlightActivityId}
    />
  )
}

async function fetchHighlightedActivity(activityId: string): Promise<ActivityListItem | null> {
  if (!activityId) return null

  const activity = await prisma.activity.findUnique({
    where: { id: activityId, deletedAt: null },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
        },
      },
    },
  })

  if (!activity) return null

  return {
    id: activity.id,
    authorId: activity.authorId,
    content: activity.content,
    imageUrls: activity.imageUrls,
    isPinned: activity.isPinned,
    likesCount: activity.likesCount,
    commentsCount: activity.commentsCount,
    viewsCount: activity.viewsCount,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    author: {
      id: activity.author.id,
      name: activity.author.name,
      avatarUrl: activity.author.avatarUrl,
      role: activity.author.role,
      status: activity.author.status,
    },
  }
}

async function fetchInitialActivities(
  orderBy: FeedTab,
  userId: string | null,
  highlightActivityId?: string
) {
  try {
    const result = await listActivities({
      orderBy,
      limit: INITIAL_LIMIT,
      followingUserId: orderBy === "following" ? userId : null,
      includeTotalCount: false,
    })

    let items = result.items
    if (highlightActivityId && !items.some((item) => item.id === highlightActivityId)) {
      const highlighted = await fetchHighlightedActivity(highlightActivityId)
      if (highlighted) {
        items = [highlighted, ...items]
      }
    }

    const signed = await signActivityListItems(items)

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
