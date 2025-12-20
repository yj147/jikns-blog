"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  ApiResponse,
  TagCandidateData,
  TagCandidateListPagination,
  GetTagCandidatesOptions,
  TagData,
} from "@/lib/actions/tags"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { RefreshCcw, ArrowUpDown, ShieldCheck } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { sanitizeTagName } from "@/lib/validation/tag"

interface TagCandidateReviewProps {
  initialCandidates: TagCandidateData[]
  initialPagination: TagCandidateListPagination
  initialError?: { code: string; message: string } | null
  getCandidatesAction: (
    options: Partial<GetTagCandidatesOptions>
  ) => Promise<
    ApiResponse<{ candidates: TagCandidateData[]; pagination: TagCandidateListPagination }>
  >
  promoteCandidateAction: (candidateId: string) => Promise<ApiResponse<{ tag: TagData }>>
  onPromoteSuccess: () => void
}

const ORDER_OPTIONS = [
  { label: "出现次数（多→少）", value: "occurrences-desc" },
  { label: "出现次数（少→多）", value: "occurrences-asc" },
  { label: "最近出现（新→旧）", value: "lastSeenAt-desc" },
  { label: "最近出现（旧→新）", value: "lastSeenAt-asc" },
  { label: "创建时间（新→旧）", value: "createdAt-desc" },
  { label: "创建时间（旧→新）", value: "createdAt-asc" },
]

export function TagCandidateReview({
  initialCandidates,
  initialPagination,
  initialError = null,
  getCandidatesAction,
  promoteCandidateAction,
  onPromoteSuccess,
}: TagCandidateReviewProps) {
  const [candidates, setCandidates] = useState<TagCandidateData[]>(initialCandidates)
  const [pagination, setPagination] = useState<TagCandidateListPagination>(initialPagination)
  const [orderValue, setOrderValue] = useState<string>("occurrences-desc")
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebounce(searchInput, 400)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError?.message ?? null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const pageSizeRef = useRef(initialPagination.limit || 20)
  const pageRef = useRef(initialPagination.page || 1)
  const currentRequestRef = useRef(0)
  const shouldSkipInitialFetch = useRef(initialError ? false : true)

  const safeCurrentPage = pagination.page ?? 1
  const safeTotalPages =
    pagination.totalPages ??
    (pagination.total !== null
      ? Math.max(1, Math.ceil(pagination.total / (pagination.limit || 1)))
      : 1)

  const orderParams = useMemo(() => {
    const [orderBy, order] = orderValue.split("-") as [
      GetTagCandidatesOptions["orderBy"],
      GetTagCandidatesOptions["order"],
    ]
    return { orderBy, order }
  }, [orderValue])

  const normalizedSearch = useMemo(() => {
    if (!debouncedSearch) return { value: undefined, error: null }
    const trimmed = debouncedSearch.trim()
    if (!trimmed) return { value: undefined, error: null }

    const withoutPrefix = trimmed.replace(/^#+/, "")
    if (!withoutPrefix) {
      return { value: undefined, error: "搜索关键词不能为空" }
    }

    const sanitized = sanitizeTagName(withoutPrefix)
    if (!sanitized) {
      return {
        value: undefined,
        error: "搜索关键词仅支持字母、数字、中文以及 .-_ 字符",
      }
    }

    return { value: sanitized, error: null }
  }, [debouncedSearch])

  const { value: normalizedSearchValue, error: normalizedSearchError } = normalizedSearch

  const fetchCandidates = useCallback(
    async (overrides: Partial<GetTagCandidatesOptions> = {}) => {
      if (overrides.search === undefined && normalizedSearchError) {
        setSearchError(normalizedSearchError)
        toast.error(normalizedSearchError)
        return
      }

      const requestId = ++currentRequestRef.current
      setIsLoading(true)
      try {
        const response = await getCandidatesAction({
          page: overrides.page ?? pageRef.current,
          limit: pageSizeRef.current,
          orderBy: overrides.orderBy ?? orderParams.orderBy,
          order: overrides.order ?? orderParams.order,
          search: overrides.search ?? normalizedSearchValue,
        })

        if (!response.success || !response.data) {
          if (response.error?.code === "VALIDATION_ERROR") {
            const validationMessage = response.error?.message || "搜索关键词无效"
            setSearchError(validationMessage)
            toast.error(validationMessage)
            return
          }

          const message = response.error?.message || "加载候选标签失败"
          setErrorMessage(message)
          toast.error(message)
          return
        }

        if (requestId !== currentRequestRef.current) {
          return
        }

        setCandidates(response.data.candidates)
        setPagination(response.data.pagination)
        pageRef.current = response.data.pagination.page ?? 1
        setErrorMessage(null)
        setSearchError(null)
      } catch (error) {
        if (requestId === currentRequestRef.current) {
          toast.error("加载候选标签失败")
          setErrorMessage("加载候选标签失败")
        }
      } finally {
        if (requestId === currentRequestRef.current) {
          setIsLoading(false)
        }
      }
    },
    [
      getCandidatesAction,
      normalizedSearchError,
      normalizedSearchValue,
      orderParams.order,
      orderParams.orderBy,
    ]
  )

  useEffect(() => {
    if (shouldSkipInitialFetch.current) {
      shouldSkipInitialFetch.current = false
      return
    }
    void fetchCandidates({ page: 1 })
  }, [orderParams.order, orderParams.orderBy, debouncedSearch, fetchCandidates])

  const refreshFirstPage = useCallback(() => fetchCandidates({ page: 1 }), [fetchCandidates])

  const handlePromote = useCallback(
    async (candidate: TagCandidateData) => {
      try {
        setPromotingId(candidate.id)
        const response = await promoteCandidateAction(candidate.id)
        if (!response.success || !response.data) {
          if (response.error?.code === "NOT_FOUND") {
            toast.info("该候选已被其他管理员处理，列表已刷新")
            await refreshFirstPage()
          } else {
            toast.error(response.error?.message || "提升标签失败")
          }
          return
        }

        toast.success(`已创建正式标签「${response.data.tag.name}」`)
        onPromoteSuccess()
        await refreshFirstPage()
      } catch (error) {
        toast.error("提升标签失败")
      } finally {
        setPromotingId(null)
      }
    },
    [onPromoteSuccess, promoteCandidateAction, refreshFirstPage]
  )

  const handlePageChange = useCallback(
    (direction: "prev" | "next") => {
      const basePage = pagination.page ?? 1
      const maxPages =
        pagination.totalPages ??
        (pagination.total !== null
          ? Math.max(1, Math.ceil(pagination.total / (pagination.limit || 1)))
          : 1)
      const nextPage = direction === "prev" ? basePage - 1 : basePage + 1
      if (nextPage < 1 || nextPage > maxPages) return
      void fetchCandidates({ page: nextPage })
    },
    [fetchCandidates, pagination.limit, pagination.page, pagination.total, pagination.totalPages]
  )

  return (
    <Card className="mt-10">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5" />
            动态 hashtag 候选池
          </CardTitle>
          <CardDescription>审核普通用户使用的 hashtag，合规后可一键提升为正式标签</CardDescription>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Input
              placeholder="搜索候选标签..."
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                if (searchError) {
                  setSearchError(null)
                }
              }}
              className="w-48 md:w-64"
            />
            {searchError ? <p className="text-destructive mt-1 text-xs">{searchError}</p> : null}
          </div>
          <Select value={orderValue} onValueChange={setOrderValue}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              void refreshFirstPage()
            }}
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {errorMessage && candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">无法加载候选标签</p>
            <p className="text-muted-foreground mt-1 text-sm">{errorMessage}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                void refreshFirstPage()
              }}
              disabled={isLoading}
            >
              重试
            </Button>
          </div>
        ) : candidates.length === 0 && !isLoading ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            当前没有新的 hashtag 候选，等待用户产生新的词条
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="w-32 text-right">出现次数</TableHead>
                    <TableHead className="w-48">最近出现</TableHead>
                    <TableHead className="w-32 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && candidates.length === 0
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                          <TableCell>
                            <Skeleton className="h-5 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-28" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-5 w-12" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-40" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-9 w-20" />
                          </TableCell>
                        </TableRow>
                      ))
                    : candidates.map((candidate) => (
                        <TableRow key={candidate.id}>
                          <TableCell className="font-medium">{candidate.name}</TableCell>
                          <TableCell className="text-muted-foreground">{candidate.slug}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{candidate.occurrences}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(candidate.lastSeenAt).toLocaleString("zh-CN", {
                              hour12: false,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={promotingId === candidate.id}
                              onClick={() => handlePromote(candidate)}
                            >
                              {promotingId === candidate.id ? (
                                "创建中..."
                              ) : (
                                <>
                                  <ArrowUpDown className="mr-2 h-4 w-4" />
                                  提升标签
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-muted-foreground flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                共 {pagination.total ?? 0} 个候选 · 第 {safeCurrentPage} / {safeTotalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("prev")}
                  disabled={safeCurrentPage <= 1 || isLoading}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("next")}
                  disabled={safeCurrentPage >= safeTotalPages || isLoading}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
