/**
 * 搜索结果卡片组件 - Phase 11 / M3 / T3.4
 * 展示不同类型的搜索结果（文章、动态、用户、标签）
 */

"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, Eye, Hash, TrendingUp, User } from "lucide-react"
import { formatDate, formatNumber, formatRelativeTime } from "@/lib/utils/blog-helpers"
import type {
  SearchActivityResult,
  SearchPostResult,
  SearchTagResult,
  SearchUserResult,
} from "@/lib/repos/search"

type SearchResultDataMap = {
  post: SearchPostResult
  activity: SearchActivityResult
  user: SearchUserResult
  tag: SearchTagResult
}

type SearchResultType = keyof SearchResultDataMap

// 使用判别联合类型（Discriminated Union）替代复杂的映射类型
// 这样可以避免使用 as any，TypeScript 会自动进行类型收窄
type SearchResultCardProps =
  | { type: "post"; data: SearchPostResult; query: string }
  | { type: "activity"; data: SearchActivityResult; query: string }
  | { type: "user"; data: SearchUserResult; query: string }
  | { type: "tag"; data: SearchTagResult; query: string }

interface RenderContext<T> {
  data: T
  query: string
}

const CARD_TRANSITION = { duration: 0.3 }

function ResultCardShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={CARD_TRANSITION}
    >
      {children}
    </motion.div>
  )
}

const CARD_RENDERERS: {
  [K in SearchResultType]: (context: RenderContext<SearchResultDataMap[K]>) => ReactNode
} = {
  post: ({ data, query }) => (
    <ResultCardShell>
      <Card className="group transition-shadow hover:shadow-lg">
        <CardHeader>
          <div className="mb-3 flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={data.author?.avatarUrl || ""}
                alt={data.author?.name || "匿名用户"}
              />
              <AvatarFallback>{data.author?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">{data.author?.name || "匿名用户"}</p>
              <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                <Calendar className="h-3 w-3" />
                <span title={formatDate((data.publishedAt || data.createdAt).toISOString())}>
                  {formatRelativeTime((data.publishedAt || data.createdAt).toISOString())}
                </span>
              </div>
            </div>
          </div>

          <Link href={`/blog/${data.slug}`}>
            <CardTitle className="group-hover:text-primary line-clamp-2 cursor-pointer text-lg transition-colors">
              {highlightText(data.title, query)}
            </CardTitle>
          </Link>

          {data.excerpt && (
            <CardDescription className="line-clamp-3 text-sm">
              {highlightText(data.excerpt, query)}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {data.tags && data.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {data.tags.slice(0, 5).map((tag) => (
                <Link key={tag.id} href={`/blog?tag=${tag.slug}`}>
                  <Badge
                    variant="secondary"
                    className="hover:bg-primary hover:text-primary-foreground cursor-pointer text-xs transition-colors"
                  >
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="text-muted-foreground flex items-center space-x-4 text-sm">
            <span className="flex items-center">
              <Eye className="mr-1 h-3 w-3" />
              {formatNumber(data.viewCount || 0)}
            </span>
            <span className="flex items-center">
              <TrendingUp className="mr-1 h-3 w-3" />
              {formatRelevance(data.rank)}
            </span>
          </div>
        </CardContent>
      </Card>
    </ResultCardShell>
  ),
  activity: ({ data, query }) => (
    <ResultCardShell>
      <Card className="group transition-shadow hover:shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={data.author?.avatarUrl || ""}
                alt={data.author?.name || "匿名用户"}
              />
              <AvatarFallback>{data.author?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center space-x-2">
                <p className="text-sm font-semibold">{data.author?.name || "匿名用户"}</p>
                <span className="text-muted-foreground text-sm">·</span>
                <p className="text-muted-foreground text-sm">
                  {formatRelativeTime(data.createdAt.toISOString())}
                </p>
              </div>
              <p className="text-foreground mb-3 line-clamp-4">
                {highlightText(data.content, query)}
              </p>
              <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                <span className="flex items-center">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {formatRelevance(data.rank)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ResultCardShell>
  ),
  user: ({ data, query }) => (
    <ResultCardShell>
      <Card className="group transition-shadow hover:shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-4">
            <Link href={`/profile/${data.id}`}>
              <Avatar className="h-12 w-12 cursor-pointer">
                <AvatarImage src={data.avatarUrl || ""} alt={data.name || "匿名用户"} />
                <AvatarFallback>{data.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/profile/${data.id}`}>
                <h3 className="group-hover:text-primary mb-1 cursor-pointer font-semibold transition-colors">
                  {highlightText(data.name || "匿名用户", query)}
                </h3>
              </Link>
              {data.bio && (
                <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                  {highlightText(data.bio, query)}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <User className="mr-1 h-3 w-3" />
                  相似度: {Math.round((data.similarity || 0) * 100)}%
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/profile/${data.id}`}>查看</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </ResultCardShell>
  ),
  tag: ({ data, query }) => (
    <ResultCardShell>
      <Link href={`/blog?tag=${data.slug}`}>
        <Card className="group cursor-pointer transition-shadow hover:shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                  <Hash className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="group-hover:text-primary mb-1 font-semibold transition-colors">
                    {highlightText(data.name, query)}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {formatNumber(data.postsCount || 0)} 篇文章
                  </p>
                </div>
              </div>
              <span className="text-primary text-sm font-medium">查看</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </ResultCardShell>
  ),
}

export function SearchResultCard(props: SearchResultCardProps) {
  // 使用 switch 语句替代动态查找，TypeScript 会自动进行类型收窄
  // 无需使用 as any，每个 case 分支中 props.data 的类型都是正确的
  switch (props.type) {
    case "post":
      return CARD_RENDERERS.post({ data: props.data, query: props.query })
    case "activity":
      return CARD_RENDERERS.activity({ data: props.data, query: props.query })
    case "user":
      return CARD_RENDERERS.user({ data: props.data, query: props.query })
    case "tag":
      return CARD_RENDERERS.tag({ data: props.data, query: props.query })
  }
}

function highlightText(text: string | null | undefined, query: string): ReactNode {
  if (!query || !text) return text ?? ""

  // 拆分查询串为多个关键词（按空格分割）
  // 这与后端 plainto_tsquery 的拆词行为保持一致
  const keywords = query
    .trim()
    .split(/\s+/)
    .filter((k) => k.length > 0)

  if (keywords.length === 0) return text

  // 构建正则表达式，匹配任意关键词
  // 使用 | 操作符实现"或"逻辑
  const pattern = keywords.map(escapeRegExp).join("|")
  const parts = text.split(new RegExp(`(${pattern})`, "gi"))

  return parts.map((part, index) => {
    // 检查当前片段是否匹配任意关键词（大小写不敏感）
    const isMatch = keywords.some((k) => part.toLowerCase() === k.toLowerCase())
    return isMatch ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
        {part}
      </mark>
    ) : (
      part
    )
  })
}

function formatRelevance(rank: number | null | undefined): string {
  if (rank === undefined || rank === null || Number.isNaN(rank)) {
    return "0%"
  }

  const normalized = Math.min(Math.max(rank, 0), 1)
  const percentage = Math.round(normalized * 100)
  return `${percentage}%`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
