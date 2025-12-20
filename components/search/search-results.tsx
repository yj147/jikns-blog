/**
 * 搜索结果组件 - Phase 11 / M3 / T3.3
 * 展示搜索结果列表，支持流式渲染
 */

import type { ReactElement } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, FileText, Activity, User, Hash } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { searchContent } from "@/lib/actions/search"
import type { SearchResults as SearchResultsType } from "@/lib/actions/search"
import type { ParsedSearchParams, SearchContentType } from "@/lib/search/search-params"
import { SEARCH_SORT_OPTION_LABELS } from "@/lib/search/search-params"
import { buildUrlSearchParams } from "@/lib/search/search-params"
import { SearchResultCard } from "@/components/search/search-result-card"
import { SearchPagination } from "@/components/search/search-pagination"
import type { ApiError } from "@/types/api"
import type { SearchActivityHit, SearchPostHit, SearchTagHit, SearchUserHit } from "@/types/search"

type ResultBucketKey = Exclude<SearchContentType, "all">
type ResultCardType = "posts" | "activities" | "users" | "tags"

const RESULT_BUCKET_KEYS: readonly ResultBucketKey[] = [
  "posts",
  "activities",
  "users",
  "tags",
] as const

const BUCKET_CONFIG: Record<
  ResultBucketKey,
  { label: string; icon: LucideIcon; cardType: ResultCardType }
> = {
  posts: { label: "文章", icon: FileText, cardType: "posts" },
  activities: { label: "动态", icon: Activity, cardType: "activities" },
  users: { label: "用户", icon: User, cardType: "users" },
  tags: { label: "标签", icon: Hash, cardType: "tags" },
}

interface SearchResultsProps {
  searchParams: ParsedSearchParams
  rawParams: { [key: string]: string | string[] | undefined }
}

export async function SearchResults({ searchParams, rawParams }: SearchResultsProps) {
  const { query, type, page, authorId, tagIds, publishedFrom, publishedTo, onlyPublished, sort } =
    searchParams

  // 获取搜索结果
  const result = await searchContent({
    query,
    type,
    page,
    limit: 20,
    authorId,
    tagIds,
    publishedFrom,
    publishedTo,
    onlyPublished,
    sort,
  })

  if (!result.success) {
    return <SearchErrorState error={result.error} query={query} />
  }

  const searchResults = result.data

  const selectedBucketKey: ResultBucketKey | null =
    type === "all" ? null : (type as ResultBucketKey)

  const totalResults =
    selectedBucketKey === null
      ? (searchResults?.overallTotal ?? 0)
      : (searchResults?.[selectedBucketKey]?.total ?? 0)

  const hasMore =
    selectedBucketKey === null
      ? RESULT_BUCKET_KEYS.some((key) => searchResults?.[key]?.hasMore)
      : (searchResults?.[selectedBucketKey]?.hasMore ?? false)

  const activeBuckets: ResultBucketKey[] =
    selectedBucketKey === null ? [...RESULT_BUCKET_KEYS] : [selectedBucketKey]

  const buildSearchHref = (nextType: SearchContentType) => {
    const urlParams = buildUrlSearchParams(rawParams)
    urlParams.set("type", nextType)
    urlParams.delete("page")
    return `/search?${urlParams.toString()}`
  }

  const buildPageHref = (nextPage: number) => {
    const nextPageNumber = Math.max(1, nextPage)
    const urlParams = buildUrlSearchParams(rawParams)
    if (nextPageNumber === 1) {
      urlParams.delete("page")
    } else {
      urlParams.set("page", nextPageNumber.toString())
    }
    return `/search?${urlParams.toString()}`
  }

  const visibleCards = createVisibleCards(searchResults ?? null, activeBuckets, query)
  const hasVisibleCards = visibleCards.length > 0
  const selectedBucketLimit =
    selectedBucketKey === null ? undefined : searchResults?.[selectedBucketKey]?.limit
  const paginationState = resolvePaginationState({
    searchResults: searchResults ?? null,
    selectedBucketKey,
    page,
    hasMore,
    bucketLimit: selectedBucketLimit,
  })
  const sortLabel = SEARCH_SORT_OPTION_LABELS[searchParams.sort]

  const tabOptions = [
    {
      value: "all",
      label: "全部",
      count: searchResults?.overallTotal ?? 0,
      icon: Search,
    },
    ...RESULT_BUCKET_KEYS.map((bucketKey) => {
      const config = BUCKET_CONFIG[bucketKey]
      return {
        value: bucketKey,
        label: config.label,
        count: searchResults?.[bucketKey]?.total ?? 0,
        icon: config.icon,
      }
    }),
  ]

  return (
    <div className="space-y-6">
      {/* 搜索结果统计 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            找到 <span className="font-semibold">{totalResults}</span> 个结果
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            当前排序：<span className="font-medium">{sortLabel}</span>
          </p>
        </div>
      </div>

      {/* 类型切换标签 */}
      <Tabs value={type} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {tabOptions.map((option) => {
            const Icon = option.icon
            return (
              <TabsTrigger key={option.value} value={option.value} asChild>
                <Link href={buildSearchHref(option.value as SearchContentType)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {option.label}
                  {option.count > 0 && (
                    <span className="bg-muted ml-2 rounded-full px-2 py-0.5 text-xs">
                      {option.count}
                    </span>
                  )}
                </Link>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={type} className="mt-6">
          {hasVisibleCards ? (
            <div className="space-y-4">{visibleCards}</div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p className="text-muted-foreground">未找到相关结果</p>
              </CardContent>
            </Card>
          )}

          {/* 分页 */}
          {paginationState.shouldRender && (
            <div className="mt-8">
              <SearchPagination
                currentPage={page}
                totalPages={paginationState.totalPages}
                hasPrevious={paginationState.hasPrevious}
                hasNext={paginationState.hasNext}
                buildHref={buildPageHref}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// 辅助函数
function createVisibleCards(
  searchResults: SearchResultsType | null,
  bucketKeys: ResultBucketKey[],
  query: string
): ReactElement[] {
  if (!searchResults) return []

  // 判断是否为"全部"模式（多个 bucket 混合展示）
  const isAllMode = bucketKeys.length > 1

  return bucketKeys.flatMap((bucketKey) => {
    const bucket = searchResults[bucketKey]
    if (!bucket || bucket.items.length === 0) {
      return []
    }

    const cards: ReactElement[] = []

    // 在"全部"模式下，为每个非空 bucket 添加段落标题
    if (isAllMode) {
      const config = BUCKET_CONFIG[bucketKey]
      cards.push(
        <h3
          key={`section-${bucketKey}`}
          className="text-muted-foreground mb-3 mt-6 text-sm font-semibold first:mt-0"
        >
          {config.label}
        </h3>
      )
    }

    // 使用显式的类型映射，避免不安全的 as any
    // 这里的类型断言是安全的，因为我们基于 bucketKey 的值进行了类型收窄
    // TypeScript 无法自动推断 searchResults[bucketKey] 的具体类型
    // 但我们知道 bucketKey 的值决定了 bucket.items 的类型
    switch (bucketKey) {
      case "posts": {
        const postBucket = searchResults.posts
        cards.push(
          ...postBucket.items.map((item): ReactElement => {
            const cardData: SearchPostHit = {
              id: item.id,
              slug: item.slug,
              title: item.title,
              excerpt: item.excerpt,
              coverImage: item.coverImage,
              publishedAt: item.publishedAt ?? item.createdAt,
              createdAt: item.createdAt,
              authorId: item.author.id,
              authorName: item.author.name,
              rank: item.rank,
            }
            return (
              <SearchResultCard
                key={`posts-${item.id}`}
                type="posts"
                data={cardData}
                query={query}
              />
            )
          })
        )
        break
      }
      case "activities": {
        const activityBucket = searchResults.activities
        cards.push(
          ...activityBucket.items.map((item): ReactElement => {
            const cardData: SearchActivityHit = {
              id: item.id,
              content: item.content,
              imageUrls: item.imageUrls,
              createdAt: item.createdAt,
              authorId: item.author.id,
              authorName: item.author.name,
              rank: item.rank,
            }
            return (
              <SearchResultCard
                key={`activities-${item.id}`}
                type="activities"
                data={cardData}
                query={query}
              />
            )
          })
        )
        break
      }
      case "users": {
        const userBucket = searchResults.users
        cards.push(
          ...userBucket.items.map((item): ReactElement => {
            const cardData: SearchUserHit = {
              id: item.id,
              name: item.name,
              avatarUrl: item.avatarUrl,
              bio: item.bio,
              rank: item.rank,
            }
            return (
              <SearchResultCard
                key={`users-${item.id}`}
                type="users"
                data={cardData}
                query={query}
              />
            )
          })
        )
        break
      }
      case "tags": {
        const tagBucket = searchResults.tags
        cards.push(
          ...tagBucket.items.map((item): ReactElement => {
            const cardData: SearchTagHit = {
              id: item.id,
              name: item.name,
              slug: item.slug,
              description: item.description,
              color: item.color,
              postsCount: item.postsCount,
              rank: item.rank,
            }
            return (
              <SearchResultCard key={`tags-${item.id}`} type="tags" data={cardData} query={query} />
            )
          })
        )
        break
      }
    }

    return cards
  })
}

function resolvePaginationState({
  searchResults,
  selectedBucketKey,
  page,
  hasMore,
  bucketLimit,
}: {
  searchResults: SearchResultsType | null
  selectedBucketKey: ResultBucketKey | null
  page: number
  hasMore: boolean
  bucketLimit?: number
}) {
  const hasPrevious = page > 1
  const hasNext = hasMore

  // type="all" 时的分页逻辑
  // 虽然无法准确计算总页数（四个桶混合展示），但仍然允许用户返回上一页
  // 这符合"Never break userspace"原则：不能因为技术限制破坏用户的基本预期
  if (selectedBucketKey === null) {
    return {
      shouldRender: hasPrevious || hasNext, // 有上一页或下一页时显示
      hasPrevious, // ✅ 恢复"上一页"功能
      hasNext,
      totalPages: undefined, // 仍然隐藏总页数（因为无法准确计算）
    }
  }

  // 单一类型时正常分页
  const totalResults = searchResults?.[selectedBucketKey]?.total ?? 0
  const effectiveLimit = bucketLimit && bucketLimit > 0 ? bucketLimit : 20
  const totalPages = totalResults > 0 ? Math.ceil(totalResults / effectiveLimit) : undefined
  const shouldRender = hasPrevious || hasNext || (totalPages !== undefined && totalPages > 1)

  return {
    shouldRender,
    hasPrevious,
    hasNext,
    totalPages,
  }
}

function SearchErrorState({ error, query }: { error?: ApiError; query: string }) {
  const retryAfterSeconds = extractRetryAfterSeconds(error)
  const baseDescription = "抱歉，搜索功能遇到了问题。请稍后重试。"
  let title = "搜索出错"
  let description = baseDescription

  switch (error?.code) {
    case "RATE_LIMIT_EXCEEDED":
      title = "搜索请求过于频繁"
      description = retryAfterSeconds
        ? `请等待 ${retryAfterSeconds} 秒后再试。搜索结果、建议与作者筛选共用同一个限流桶。`
        : "请稍后再试。搜索结果、建议与作者筛选共用同一个限流桶。"
      break
    case "VALIDATION_ERROR":
      title = "请求参数无效"
      description =
        extractValidationMessage(error) ??
        error?.message ??
        "搜索参数存在问题，请检查过滤器设置后重试。"
      break
    default:
      if (error?.message) {
        description = error.message
      }
      break
  }

  return (
    <div className="py-16 text-center">
      <Search className="text-muted-foreground mx-auto mb-6 h-16 w-16" />
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground mx-auto mb-8 max-w-2xl">{description}</p>
      <div className="flex items-center justify-center gap-3">
        <Button asChild>
          <Link href="/search">重新搜索</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
      <p className="text-muted-foreground mx-auto mt-4 max-w-xl break-all text-xs">
        当前关键词：<span className="font-semibold">{query || "（空）"}</span>
      </p>
    </div>
  )
}

function extractRetryAfterSeconds(error?: ApiError): number | null {
  if (!error?.details || typeof error.details !== "object") {
    return null
  }
  const raw = (error.details as Record<string, unknown>).retryAfter
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw
  }
  const parsed = raw !== undefined ? Number.parseInt(String(raw), 10) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function extractValidationMessage(error?: ApiError): string | null {
  if (!error?.details || typeof error.details !== "object") {
    return null
  }
  const errors = (error.details as Record<string, unknown>).errors
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as { message?: string }
    if (typeof first?.message === "string" && first.message.trim().length > 0) {
      return first.message
    }
  }
  return null
}
