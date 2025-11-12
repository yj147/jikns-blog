/**
 * 搜索过滤器组件 - Phase 11 / M3 / T3.5
 * 重构后：使用自定义 hooks 拆分状态管理，消除巨型组件
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CalendarIcon, Hash, Loader2, User, X } from "lucide-react"
import { format, endOfDay, startOfDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import {
  MAX_SEARCH_TAG_IDS,
  SEARCH_SORT_OPTION_LABELS,
  SEARCH_SORT_OPTIONS,
  type ParsedSearchParams,
  type SearchSortOption,
} from "@/lib/search/search-params"
import { useTagFilter, TagOption, TagSuggestionStatus } from "./filters/hooks/use-tag-filter"
import {
  useAuthorFilter,
  AuthorOption,
  AuthorSuggestionStatus,
} from "./filters/hooks/use-author-filter"

const MIN_QUERY_LENGTH = 2
const SORT_OPTION_DESCRIPTIONS: Record<SearchSortOption, string> = {
  relevance: "综合 ts_rank + 时间衰减，兼顾热度和新鲜度",
  latest: "按发布时间倒序，最新内容优先",
}

const CONTENT_TYPE_OPTIONS = ["posts", "activities", "users", "tags"] as const
type ContentTypeOption = (typeof CONTENT_TYPE_OPTIONS)[number]
type FilterContentType = ContentTypeOption | "all"

interface SearchFiltersProps {
  allowDraftToggle?: boolean
  initialParams: ParsedSearchParams
}

export function SearchFilters({ allowDraftToggle = false, initialParams }: SearchFiltersProps) {
  const router = useRouter()
  const [contentType, setContentType] = useState<FilterContentType>(() =>
    initialParams.type === "all" ? "all" : initialParams.type
  )
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    initialParams.publishedFrom ?? undefined
  )
  const [dateTo, setDateTo] = useState<Date | undefined>(initialParams.publishedTo ?? undefined)
  const [onlyPublished, setOnlyPublished] = useState<boolean>(() =>
    allowDraftToggle ? initialParams.onlyPublished : true
  )
  const [sortOption, setSortOption] = useState<SearchSortOption>(initialParams.sort)

  const tagIdsKey = (initialParams.tagIds ?? []).join(",")
  const normalizedInitialTagIds = useMemo(
    () => (initialParams.tagIds ? [...initialParams.tagIds] : []),
    [tagIdsKey]
  )

  const tagFilter = useTagFilter({
    initialTagIds: normalizedInitialTagIds,
    maxTags: MAX_SEARCH_TAG_IDS,
    minQueryLength: MIN_QUERY_LENGTH,
  })

  const authorFilter = useAuthorFilter({
    initialAuthorId: initialParams.authorId ?? null,
    minQueryLength: MIN_QUERY_LENGTH,
  })

  const publishedFromKey = initialParams.publishedFrom?.toISOString() ?? ""
  const publishedToKey = initialParams.publishedTo?.toISOString() ?? ""

  useEffect(() => {
    setContentType(initialParams.type === "all" ? "all" : initialParams.type)
    setDateFrom(initialParams.publishedFrom ?? undefined)
    setDateTo(initialParams.publishedTo ?? undefined)
    setOnlyPublished(allowDraftToggle ? initialParams.onlyPublished : true)
    setSortOption(initialParams.sort)
  }, [
    initialParams.type,
    publishedFromKey,
    publishedToKey,
    initialParams.onlyPublished,
    initialParams.sort,
    allowDraftToggle,
  ])

  const hasActiveFilters =
    contentType !== "all" ||
    dateFrom !== undefined ||
    dateTo !== undefined ||
    (allowDraftToggle && onlyPublished === false) ||
    tagFilter.selectedTags.length > 0 ||
    Boolean(authorFilter.selectedAuthor) ||
    sortOption !== "relevance"

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()

    if (initialParams.query) {
      params.set("q", initialParams.query)
    }

    if (contentType !== "all") {
      params.set("type", contentType)
    }

    if (dateFrom) {
      params.set("publishedFrom", startOfDay(dateFrom).toISOString())
    }

    if (dateTo) {
      params.set("publishedTo", endOfDay(dateTo).toISOString())
    }

    if (tagFilter.selectedTags.length > 0) {
      tagFilter.selectedTags.forEach((tag) => params.append("tagIds", tag.id))
    }

    if (authorFilter.selectedAuthor) {
      params.set("authorId", authorFilter.selectedAuthor.id)
    }

    if (allowDraftToggle && !onlyPublished) {
      params.set("onlyPublished", "false")
    }

    if (sortOption !== "relevance") {
      params.set("sort", sortOption)
    }

    const nextUrl = params.toString() ? `/search?${params.toString()}` : "/search"
    router.push(nextUrl)
  }, [
    allowDraftToggle,
    authorFilter.selectedAuthor,
    contentType,
    dateFrom,
    dateTo,
    initialParams.query,
    onlyPublished,
    router,
    sortOption,
    tagFilter.selectedTags,
  ])

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (initialParams.query) {
      params.set("q", initialParams.query)
      router.push(`/search?${params.toString()}`)
    } else {
      router.push("/search")
    }

    setContentType("all")
    setDateFrom(undefined)
    setDateTo(undefined)
    setOnlyPublished(true)
    setSortOption("relevance")
    tagFilter.resetTags()
    authorFilter.clearAuthor()
  }, [authorFilter, initialParams.query, router, tagFilter])

  const handleContentTypeChange = (nextType: FilterContentType) => {
    if (nextType === "all") {
      setContentType("all")
      return
    }

    if (CONTENT_TYPE_OPTIONS.includes(nextType as ContentTypeOption)) {
      setContentType(nextType as ContentTypeOption)
    }
  }

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">过滤器</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              清除
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ContentTypeSection value={contentType} onChange={handleContentTypeChange} />

        <Separator />

        <SortSection value={sortOption} onChange={setSortOption} />

        <Separator />

        <DateRangeSection
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChangeFrom={setDateFrom}
          onChangeTo={setDateTo}
        />

        <Separator />

        <TagFilterSection
          tagQuery={tagFilter.tagQuery}
          setTagQuery={tagFilter.setTagQuery}
          selectedTags={tagFilter.selectedTags}
          tagSuggestions={tagFilter.tagSuggestions}
          tagStatus={tagFilter.tagStatus}
          hasSufficientQuery={tagFilter.hasSufficientQuery}
          isLoadingSelectedTags={tagFilter.isLoadingSelectedTags}
          remainingTagSlots={tagFilter.remainingTagSlots}
          onAddTag={tagFilter.addTag}
          onRemoveTag={tagFilter.removeTag}
        />

        <Separator />

        <AuthorFilterSection
          authorQuery={authorFilter.authorQuery}
          setAuthorQuery={authorFilter.setAuthorQuery}
          selectedAuthor={authorFilter.selectedAuthor}
          authorSuggestions={authorFilter.authorSuggestions}
          authorStatus={authorFilter.authorStatus}
          hasSufficientQuery={authorFilter.hasSufficientQuery}
          isLoadingInitialAuthor={authorFilter.isLoadingInitialAuthor}
          onSelectAuthor={authorFilter.selectAuthor}
          onClearAuthor={authorFilter.clearAuthor}
        />

        <Separator />

        {allowDraftToggle && (
          <DraftToggleSection checked={onlyPublished} onChange={setOnlyPublished} />
        )}

        <Button onClick={applyFilters} className="w-full">
          应用过滤器
        </Button>
      </CardContent>
    </Card>
  )
}

interface ContentTypeSectionProps {
  value: FilterContentType
  onChange: (value: FilterContentType) => void
}

function ContentTypeSection({ value, onChange }: ContentTypeSectionProps) {
  const options = [
    { value: "all" as FilterContentType, label: "全部" },
    { value: "posts" as FilterContentType, label: "文章" },
    { value: "activities" as FilterContentType, label: "动态" },
    { value: "users" as FilterContentType, label: "用户" },
    { value: "tags" as FilterContentType, label: "标签" },
  ]

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">内容类型</Label>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as FilterContentType)}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem id={`type-${option.value}`} value={option.value} />
            <Label htmlFor={`type-${option.value}`} className="cursor-pointer text-sm font-normal">
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

interface SortSectionProps {
  value: SearchSortOption
  onChange: (value: SearchSortOption) => void
}

function SortSection({ value, onChange }: SortSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">排序</Label>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange((next as SearchSortOption) ?? "relevance")}
        className="space-y-2"
      >
        {SEARCH_SORT_OPTIONS.map((option) => (
          <div
            key={option}
            className={cn(
              "flex items-start justify-between rounded-md border px-3 py-2 text-sm transition-colors",
              value === option ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <div className="pr-4">
              <p className="font-medium">{SEARCH_SORT_OPTION_LABELS[option]}</p>
              <p className="text-muted-foreground text-xs">{SORT_OPTION_DESCRIPTIONS[option]}</p>
            </div>
            <RadioGroupItem value={option} aria-label={SEARCH_SORT_OPTION_LABELS[option]} />
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

interface DateRangeSectionProps {
  dateFrom?: Date
  dateTo?: Date
  onChangeFrom: (value?: Date) => void
  onChangeTo: (value?: Date) => void
}

function DateRangeSection({ dateFrom, dateTo, onChangeFrom, onChangeTo }: DateRangeSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">发布日期</Label>
      <div className="space-y-2">
        <div>
          <Label className="text-muted-foreground text-xs">从</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PPP", { locale: zhCN }) : "选择日期"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={onChangeFrom}
                initialFocus
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">到</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PPP", { locale: zhCN }) : "选择日期"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={onChangeTo}
                initialFocus
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

interface TagFilterSectionProps {
  tagQuery: string
  setTagQuery: (value: string) => void
  selectedTags: TagOption[]
  tagSuggestions: TagOption[]
  tagStatus: TagSuggestionStatus
  hasSufficientQuery: boolean
  isLoadingSelectedTags: boolean
  remainingTagSlots: number
  onAddTag: (tag: TagOption) => void
  onRemoveTag: (tagId: string) => void
}

function TagFilterSection(props: TagFilterSectionProps) {
  const {
    tagQuery,
    setTagQuery,
    selectedTags,
    tagSuggestions,
    tagStatus,
    hasSufficientQuery,
    isLoadingSelectedTags,
    remainingTagSlots,
    onAddTag,
    onRemoveTag,
  } = props

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Hash className="h-4 w-4" />
          标签
        </Label>
        <span className="text-muted-foreground text-xs">
          {selectedTags.length}/{MAX_SEARCH_TAG_IDS}
        </span>
      </div>
      <Input
        placeholder="搜索标签..."
        value={tagQuery}
        onChange={(event) => setTagQuery(event.target.value)}
      />

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
              <span>{tag.name}</span>
              <button
                type="button"
                aria-label={`移除标签 ${tag.name}`}
                className="hover:bg-muted rounded-full p-0.5"
                onClick={() => onRemoveTag(tag.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="bg-muted/30 rounded-md border border-dashed p-3 text-sm">
        {!hasSufficientQuery && tagStatus === "idle" ? (
          <p className="text-muted-foreground">输入至少 {MIN_QUERY_LENGTH} 个字符以搜索标签</p>
        ) : tagStatus === "loading" ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在搜索标签...
          </div>
        ) : tagStatus === "error" ? (
          <p className="text-destructive">搜索标签失败，请稍后重试</p>
        ) : tagStatus === "empty" ? (
          <p className="text-muted-foreground">没有匹配的标签</p>
        ) : tagSuggestions.length > 0 ? (
          <div className="space-y-2">
            {tagSuggestions.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className="bg-background hover:border-primary flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm"
                onClick={() => onAddTag(tag)}
              >
                <span>{tag.name}</span>
                <span className="text-muted-foreground text-xs">添加</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">搜索结果将在这里显示</p>
        )}
      </div>

      {remainingTagSlots === 0 && (
        <p className="text-muted-foreground text-xs">已达到标签选择上限</p>
      )}
      {isLoadingSelectedTags && (
        <p className="text-muted-foreground text-xs">正在同步已选择的标签…</p>
      )}
    </div>
  )
}

interface AuthorFilterSectionProps {
  authorQuery: string
  setAuthorQuery: (value: string) => void
  selectedAuthor: AuthorOption | null
  authorSuggestions: AuthorOption[]
  authorStatus: AuthorSuggestionStatus
  hasSufficientQuery: boolean
  isLoadingInitialAuthor: boolean
  onSelectAuthor: (author: AuthorOption) => void
  onClearAuthor: () => void
}

function AuthorFilterSection(props: AuthorFilterSectionProps) {
  const {
    authorQuery,
    setAuthorQuery,
    selectedAuthor,
    authorSuggestions,
    authorStatus,
    hasSufficientQuery,
    isLoadingInitialAuthor,
    onSelectAuthor,
    onClearAuthor,
  } = props

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <User className="h-4 w-4" />
        作者
      </Label>
      <Input
        placeholder="搜索作者..."
        value={authorQuery}
        onChange={(event) => setAuthorQuery(event.target.value)}
      />

      {selectedAuthor && (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <div>
            <p className="font-medium">{selectedAuthor.name ?? "未命名作者"}</p>
            {selectedAuthor.bio && (
              <p className="text-muted-foreground text-xs">{selectedAuthor.bio}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClearAuthor}>
            <X className="mr-1 h-3 w-3" />
            移除
          </Button>
        </div>
      )}

      {isLoadingInitialAuthor && <p className="text-muted-foreground text-xs">正在加载作者信息…</p>}

      <div className="bg-muted/30 rounded-md border border-dashed p-3 text-sm">
        {!hasSufficientQuery && authorStatus === "idle" ? (
          <p className="text-muted-foreground">输入至少 {MIN_QUERY_LENGTH} 个字符以搜索作者</p>
        ) : authorStatus === "loading" ? (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在搜索作者...
          </div>
        ) : authorStatus === "error" ? (
          <p className="text-destructive">搜索作者失败，请稍后重试</p>
        ) : authorStatus === "empty" ? (
          <p className="text-muted-foreground">没有匹配的作者</p>
        ) : authorSuggestions.length > 0 ? (
          <div className="space-y-2">
            {authorSuggestions.map((author) => (
              <button
                type="button"
                key={author.id}
                className="bg-background hover:border-primary flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm"
                onClick={() => onSelectAuthor(author)}
              >
                <div>
                  <p className="font-medium">{author.name ?? "未命名作者"}</p>
                  {author.bio && (
                    <p className="text-muted-foreground line-clamp-1 text-xs">{author.bio}</p>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">选择</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">搜索结果将在这里显示</p>
        )}
      </div>
    </div>
  )
}

interface DraftToggleSectionProps {
  checked: boolean
  onChange: (value: boolean) => void
}

function DraftToggleSection({ checked, onChange }: DraftToggleSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">其他选项</Label>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="only-published"
          checked={checked}
          onCheckedChange={(state) => onChange(Boolean(state))}
        />
        <Label htmlFor="only-published" className="cursor-pointer text-sm font-normal">
          仅显示已发布内容
        </Label>
      </div>
    </div>
  )
}
