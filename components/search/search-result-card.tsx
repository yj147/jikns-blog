/**
 * 统一搜索结果卡片
 */

"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Calendar, Clock, Hash, User as UserIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatRelativeTime } from "@/lib/utils/blog-helpers"
import type {
  SearchActivityHit,
  SearchPostHit,
  SearchTagHit,
  SearchUserHit,
} from "@/types/search"

type SearchResultCardProps =
  | { type: "posts"; data: SearchPostHit; query: string }
  | { type: "activities"; data: SearchActivityHit; query: string }
  | { type: "users"; data: SearchUserHit; query: string }
  | { type: "tags"; data: SearchTagHit; query: string }

const CARD_TRANSITION = { duration: 0.2 }

export function SearchResultCard(props: SearchResultCardProps) {
  switch (props.type) {
    case "posts":
      return <PostCard data={props.data} query={props.query} />
    case "activities":
      return <ActivityCard data={props.data} query={props.query} />
    case "users":
      return <UserCard data={props.data} query={props.query} />
    case "tags":
      return <TagCard data={props.data} query={props.query} />
    default:
      return null
  }
}

function PostCard({ data, query }: { data: SearchPostHit; query: string }) {
  const published = normalizeDate(data.publishedAt ?? data.createdAt)

  return (
    <ResultCardShell>
      <Card className="group transition-shadow hover:shadow-lg">
        <CardHeader className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <Calendar className="h-4 w-4" />
            <span>{published ? formatDate(published) : "未知时间"}</span>
            {published && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatRelativeTime(published)}</span>
              </span>
            )}
          </div>

          <Link href={`/blog/${data.slug}`}>
            <CardTitle className="group-hover:text-primary line-clamp-2 cursor-pointer text-lg transition-colors">
              {highlightText(data.title, query)}
            </CardTitle>
          </Link>

          {data.excerpt && (
            <CardDescription className="line-clamp-3 text-sm text-muted-foreground">
              {highlightText(data.excerpt, query)}
            </CardDescription>
          )}

          {data.authorName && (
            <p className="text-muted-foreground text-sm">作者：{data.authorName}</p>
          )}
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Badge variant="secondary">文章</Badge>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/blog/${data.slug}`}>阅读正文</Link>
          </Button>
        </CardContent>
      </Card>
    </ResultCardShell>
  )
}

function ActivityCard({ data, query }: { data: SearchActivityHit; query: string }) {
  const created = normalizeDate(data.createdAt)

  return (
    <ResultCardShell>
      <Card className="transition-shadow hover:shadow-lg">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span>{data.authorName || "匿名用户"}</span>
            </div>
            {created && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatRelativeTime(created)}</span>
              </div>
            )}
          </div>
          <p className="text-sm leading-relaxed">{highlightText(data.content, query)}</p>
          <Badge variant="outline">动态</Badge>
        </CardContent>
      </Card>
    </ResultCardShell>
  )
}

function UserCard({ data, query }: { data: SearchUserHit; query: string }) {
  const bio = data.bio || "这个人很神秘，还没有填写简介"

  return (
    <ResultCardShell>
      <Card className="transition-shadow hover:shadow-lg">
        <CardContent className="flex items-start gap-4 pt-6">
          <Avatar className="h-12 w-12">
            <AvatarImage src={data.avatarUrl || ""} alt={data.name || data.email} />
            <AvatarFallback>{(data.name || data.email)?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Link href={`/profile/${data.id}`}>
                <h3 className="hover:text-primary line-clamp-1 cursor-pointer text-base font-semibold transition-colors">
                  {highlightText(data.name || data.email, query)}
                </h3>
              </Link>
              <Badge variant="secondary">用户</Badge>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-sm">{highlightText(bio, query)}</p>
            <p className="text-xs text-muted-foreground break-all">{data.email}</p>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/profile/${data.id}`}>查看</Link>
          </Button>
        </CardContent>
      </Card>
    </ResultCardShell>
  )
}

function TagCard({ data, query }: { data: SearchTagHit; query: string }) {
  return (
    <ResultCardShell>
      <Link href={`/blog?tag=${data.slug}`}>
        <Card className="group cursor-pointer transition-shadow hover:shadow-lg">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                <Hash className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="group-hover:text-primary line-clamp-1 text-base font-semibold transition-colors">
                  {highlightText(data.name, query)}
                </h3>
                {data.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {highlightText(data.description, query)}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">被使用 {data.postsCount} 次</p>
              </div>
            </div>
            <Badge variant="outline">标签</Badge>
          </CardContent>
        </Card>
      </Link>
    </ResultCardShell>
  )
}

function ResultCardShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={CARD_TRANSITION}
    >
      {children}
    </motion.div>
  )
}

function highlightText(text: string | null | undefined, query: string): ReactNode {
  if (!text) return ""
  const normalized = query.trim()
  if (!normalized) return text

  const keywords = normalized.split(/\s+/).filter(Boolean)
  if (keywords.length === 0) return text

  const pattern = keywords.map(escapeRegExp).join("|")
  const segments = text.split(new RegExp(`(${pattern})`, "gi"))

  return segments.map((segment, index) => {
    const isHit = keywords.some((keyword) => segment.toLowerCase() === keyword.toLowerCase())
    return isHit ? (
      <mark key={index} className="bg-yellow-100 px-0.5 text-foreground">
        {segment}
      </mark>
    ) : (
      <span key={index}>{segment}</span>
    )
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  if (typeof value === "string") return value
  try {
    return value.toISOString()
  } catch {
    return undefined
  }
}
