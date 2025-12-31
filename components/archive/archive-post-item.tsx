"use client"

import { memo } from "react"
import { ArchivePost } from "@/lib/actions/archive"
import Link from "next/link"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface ArchivePostItemProps {
  post: ArchivePost
}

function ArchivePostItemComponent({ post }: ArchivePostItemProps) {
  return (
    <article className="group relative py-1 pl-8">
      {/* 连接线 */}
      <div className="bg-border absolute left-0 top-3 h-px w-6" />

      {/* 文章内容 */}
      <div className="flex items-start gap-3">
        {/* 日期 */}
        <time className="text-muted-foreground flex items-center gap-1 whitespace-nowrap text-sm">
          <Calendar className="h-3 w-3" />
          {new Date(post.publishedAt).toLocaleDateString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
          })}
        </time>

        {/* 标题和摘要 */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/blog/${post.slug}`}
            prefetch={false}
            className={cn("hover:text-primary font-medium transition-colors", "line-clamp-1")}
          >
            {post.title}
          </Link>

          {post.summary && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{post.summary}</p>
          )}

          {/* 标签 */}
          {post.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.tags.slice(0, 3).map((postTag) => (
                <Link
                  key={postTag.tag.id}
                  href={`/tags/${postTag.tag.slug}`}
                  prefetch={false}
                  className="bg-secondary hover:bg-secondary/80 rounded px-1.5 py-0.5 text-xs transition-colors"
                >
                  {postTag.tag.name}
                </Link>
              ))}
              {post.tags.length > 3 && (
                <span className="text-muted-foreground px-1.5 py-0.5 text-xs">
                  +{post.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(ArchivePostItemComponent)
