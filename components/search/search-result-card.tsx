/**
 * 统一搜索结果卡片 - Social Feed Style
 */

"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Calendar, Clock, Hash, User as UserIcon, MessageSquare, Heart } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatRelativeTime } from "@/lib/utils/blog-helpers"
import type { SearchActivityHit, SearchPostHit, SearchTagHit, SearchUserHit } from "@/types/search"

type SearchResultCardProps =
  | { type: "posts" | "post"; data: SearchPostHit; query: string }
  | { type: "activities" | "activity"; data: SearchActivityHit; query: string }
  | { type: "users" | "user"; data: SearchUserHit; query: string }
  | { type: "tags" | "tag"; data: SearchTagHit; query: string }

const CARD_TRANSITION = { duration: 0.2 }

export function SearchResultCard(props: SearchResultCardProps) {
  switch (props.type) {
    case "posts":
    case "post":
      return <PostCard data={props.data} query={props.query} />
    case "activities":
    case "activity":
      return <ActivityCard data={props.data} query={props.query} />
    case "users":
    case "user":
      return <UserCard data={props.data} query={props.query} />
    case "tags":
    case "tag":
      return <TagCard data={props.data} query={props.query} />
    default:
      return null
  }
}

function PostCard({ data, query }: { data: SearchPostHit; query: string }) {
  const published = normalizeDate(data.publishedAt ?? data.createdAt)

  return (
    <ResultCardShell>
      <div className="border-border hover:bg-muted/5 group flex flex-col gap-2 border-b px-4 py-4 sm:px-6">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium">{data.authorName || "匿名用户"}</span>
            <span>·</span>
            <span>{published ? formatDate(published) : "未知时间"}</span>
          </div>
          <RelevanceBadge rank={data.rank} />
        </div>

        <Link href={`/blog/${data.slug}`} className="block group-hover:opacity-90">
          <h3 className="text-foreground group-hover:text-primary mb-1 text-base font-bold leading-snug transition-colors">
            {highlightText(data.title, query)}
          </h3>
          {data.excerpt && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {highlightText(data.excerpt, query)}
            </p>
          )}
        </Link>

        <div className="flex items-center gap-4 pt-1">
          <Badge variant="secondary" className="h-5 text-[10px]">
            文章
          </Badge>
          {/* Placeholder stats if available in SearchHit, otherwise minimal */}
        </div>
      </div>
    </ResultCardShell>
  )
}

function ActivityCard({ data, query }: { data: SearchActivityHit; query: string }) {
  const created = normalizeDate(data.createdAt)

  return (
    <ResultCardShell>
      <div className="border-border hover:bg-muted/5 group flex gap-4 border-b px-4 py-4 sm:px-6">
        <Avatar className="h-10 w-10">
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold">{data.authorName || "匿名用户"}</span>
              <span className="text-muted-foreground" suppressHydrationWarning>
                · {created ? formatRelativeTime(created) : ""}
              </span>
            </div>
            <RelevanceBadge rank={data.rank} />
          </div>
          <p className="text-foreground whitespace-pre-wrap break-words text-sm leading-normal">
            {highlightText(data.content, query)}
          </p>
          <div className="text-muted-foreground flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>评论</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Heart className="h-3.5 w-3.5" />
              <span>点赞</span>
            </div>
          </div>
        </div>
      </div>
    </ResultCardShell>
  )
}

function UserCard({ data, query }: { data: SearchUserHit; query: string }) {
  const bio = data.bio || "这个人很神秘，还没有填写简介"
  const displayName = data.name || "匿名用户"

  return (
    <ResultCardShell>
      <div className="border-border hover:bg-muted/5 flex items-center gap-4 border-b px-4 py-4 sm:px-6">
        <Link href={`/profile/${data.id}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={data.avatarUrl || ""} alt={displayName} />
            <AvatarFallback>{displayName[0]?.toUpperCase() ?? "U"}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <Link href={`/profile/${data.id}`}>
              <h3 className="text-foreground text-sm font-bold hover:underline">
                {highlightText(displayName, query)}
              </h3>
            </Link>
            <RelevanceBadge rank={data.rank} />
          </div>
          <p className="text-muted-foreground line-clamp-1 text-sm">{highlightText(bio, query)}</p>
        </div>

        <Button variant="outline" size="sm" asChild className="h-8 rounded-full">
          <Link href={`/profile/${data.id}`}>查看</Link>
        </Button>
      </div>
    </ResultCardShell>
  )
}

function TagCard({ data, query }: { data: SearchTagHit; query: string }) {
  return (
    <ResultCardShell>
      <Link href={`/blog?tag=${data.slug}`} className="block">
        <div className="border-border hover:bg-muted/5 flex items-center justify-between border-b px-4 py-4 transition-colors sm:px-6">
          <div className="flex items-center gap-4">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
              <Hash className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <h3 className="text-foreground group-hover:text-primary text-sm font-bold transition-colors">
                {highlightText(data.name, query)}
              </h3>
              {data.description && (
                <p className="text-muted-foreground line-clamp-1 max-w-[300px] text-xs">
                  {highlightText(data.description, query)}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              {data.postsCount} 篇相关
            </span>
            <RelevanceBadge rank={data.rank} />
          </div>
        </div>
      </Link>
    </ResultCardShell>
  )
}

function ResultCardShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={CARD_TRANSITION}
    >
      {children}
    </motion.div>
  )
}

function RelevanceBadge({ rank }: { rank: number }) {
  if (!Number.isFinite(rank)) return null
  const display = formatRelevance(rank)
  return (
    <div
      className="text-muted-foreground flex items-center gap-1 text-[10px]"
      aria-label="relevance-score"
    >
      <span>相关度</span>
      <span className="text-foreground font-medium">{display}</span>
    </div>
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
      <mark key={index} className="text-foreground rounded bg-yellow-200/50 px-0 font-medium">
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

function formatRelevance(rank: number): string {
  const normalized = Math.min(1, Math.max(0, rank))
  const percentage = Math.round(normalized * 100)
  return `${percentage}%`
}
