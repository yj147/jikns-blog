import { Suspense } from "react"
import { Search as SearchIcon } from "lucide-react"
import { SearchBar } from "@/components/search/search-bar"
import { SearchFilters } from "@/components/search/search-filters"
import { SearchResults } from "@/components/search/search-results"
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton"
import { getCurrentUser } from "@/lib/auth"
import {
  parseSearchParams,
  type ParsedSearchParams,
  type RawSearchParams,
} from "@/lib/search/search-params"

type SearchPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await resolveSearchParams(searchParams)
  const parsedParams = parseSearchParams(resolvedParams)
  const currentUser = await getCurrentUser()
  const canViewDrafts = currentUser?.role === "ADMIN"

  const effectiveSearchParams: ParsedSearchParams = {
    ...parsedParams,
    onlyPublished: canViewDrafts ? parsedParams.onlyPublished : true,
  }

  const normalizedRawParams = normalizeRawParams(resolvedParams, effectiveSearchParams)
  const hasQuery = effectiveSearchParams.query.length > 0

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-10">
        <div className="mb-10 space-y-4 text-center">
          <p className="text-primary/80 text-sm font-semibold uppercase tracking-[0.2em]">
            Search Everything
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">快速定位文章与创作者</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base">
            统一搜索支持文章、动态、用户与标签。输入关键词或组合过滤条件，即可查找过去所有创作内容。
          </p>
          <div className="mx-auto max-w-2xl">
            <SearchBar placeholder='输入关键词，例如 "Next.js"、"数据库"...' />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
          <div className="order-2 space-y-6 lg:order-1">
            <SearchFilters allowDraftToggle={canViewDrafts} initialParams={effectiveSearchParams} />
          </div>

          <div className="order-1 lg:order-2">
            {hasQuery ? (
              <Suspense fallback={<SearchResultsSkeleton />}>
                <SearchResults
                  searchParams={effectiveSearchParams}
                  rawParams={normalizedRawParams}
                />
              </Suspense>
            ) : (
              <SearchPageEmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

async function resolveSearchParams(
  input?: SearchPageProps["searchParams"]
): Promise<RawSearchParams> {
  if (!input) {
    return {}
  }

  if (typeof (input as Promise<RawSearchParams>).then === "function") {
    const resolved = await (input as Promise<Record<string, string | string[] | undefined>>)
    return (resolved ?? {}) as RawSearchParams
  }

  return input as RawSearchParams
}

function normalizeRawParams(
  resolved: RawSearchParams,
  parsed: ParsedSearchParams
): RawSearchParams {
  const normalized: RawSearchParams = { ...resolved }

  if (parsed.query) {
    normalized.q = parsed.query
  } else {
    delete normalized.q
  }

  if (parsed.type && parsed.type !== "all") {
    normalized.type = parsed.type
  } else {
    delete normalized.type
  }

  if (parsed.page > 1) {
    normalized.page = parsed.page.toString()
  } else {
    delete normalized.page
  }

  if (parsed.authorId) {
    normalized.authorId = parsed.authorId
  } else {
    delete normalized.authorId
  }

  if (parsed.tagIds && parsed.tagIds.length > 0) {
    normalized.tagIds = parsed.tagIds
  } else {
    delete normalized.tagIds
  }

  if (parsed.publishedFrom) {
    normalized.publishedFrom = parsed.publishedFrom.toISOString()
  } else {
    delete normalized.publishedFrom
  }

  if (parsed.publishedTo) {
    normalized.publishedTo = parsed.publishedTo.toISOString()
  } else {
    delete normalized.publishedTo
  }

  if (parsed.onlyPublished) {
    delete normalized.onlyPublished
  } else {
    normalized.onlyPublished = "false"
  }

  if (parsed.sort && parsed.sort !== "relevance") {
    normalized.sort = parsed.sort
  } else {
    delete normalized.sort
  }

  return normalized
}

function SearchPageEmptyState() {
  return (
    <section className="border-border/60 bg-muted/30 rounded-2xl border px-8 py-16 text-center">
      <div className="bg-primary/10 text-primary mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
        <SearchIcon className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-semibold">输入关键词开始搜索</h2>
      <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-base leading-relaxed">
        搜索支持标题、正文、标签与作者。也可以先选定过滤条件，再在顶部搜索框中输入关键字。
      </p>
      <TipsList
        tips={[
          "使用多个标签可以缩小范围，例如 tag:nextjs + tag:database",
          "管理员可在过滤器中关闭“仅显示已发布内容”以检索草稿",
          "输入 @用户名 可以快速定位创作者",
        ]}
      />
    </section>
  )
}

function TipsList({ tips }: { tips: string[] }) {
  return (
    <ul className="text-muted-foreground mx-auto mt-8 max-w-2xl space-y-2 text-sm">
      {tips.map((tip) => (
        <li
          key={tip}
          className="bg-background/80 border-border/50 rounded-md border border-dashed px-4 py-2 text-left"
        >
          {tip}
        </li>
      ))}
    </ul>
  )
}
