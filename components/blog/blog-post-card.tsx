/**
 * 博客文章卡片组件 - Immersive Style
 * 宽敞、沉浸式的卡片设计，解决拥挤感
 */

"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MessageCircle, Heart, BarChart2, Share2, MoreHorizontal } from "lucide-react"
import { PostListItem } from "@/types/blog"
import {
  formatRelativeTime,
  formatNumber,
  calculateReadTime,
} from "@/lib/utils/blog-helpers"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import { interactionStyles } from "@/lib/styles/interaction-styles"
import { cn } from "@/lib/utils"

interface BlogPostCardProps {
  post: PostListItem
  index?: number
}

export function BlogPostCard({ post, index = 0 }: BlogPostCardProps) {
  const coverSource = post.signedCoverImage ?? post.coverImage ?? undefined
  const coverImageUrl =
    coverSource &&
    (getOptimizedImageUrl(coverSource, { width: 800, height: 400, quality: 80 }) ?? coverSource)

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border-b border-border bg-background px-4 py-6 transition-colors hover:bg-muted/5 sm:px-6 sm:py-8"
    >
      {/* 1. 头部：作者信息 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.author.id ?? "#"}`}>
            <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-background transition-opacity hover:opacity-90">
              <AvatarImage
                src={post.author.avatarUrl || ""}
                alt={post.author.name || "用户"}
              />
              <AvatarFallback className="bg-primary/10 text-primary">
                {post.author.name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex flex-col leading-none">
            <Link href={`/profile/${post.author.id ?? "#"}`} className="font-bold text-base text-foreground hover:underline">
              {post.author.name || "匿名用户"}
            </Link>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>{formatRelativeTime(post.publishedAt)}</span>
              <span>·</span>
              <span>{calculateReadTime(post.contentLength)}</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">更多操作</span>
        </Button>
      </div>

      {/* 2. 内容区：标题 + 摘要 */}
      <div className="mb-4">
        <Link href={`/blog/${post.slug}`} className="group block space-y-2">
          <h3 className="text-lg font-bold leading-snug text-foreground group-hover:text-primary transition-colors sm:text-xl">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="text-base text-muted-foreground leading-relaxed line-clamp-3">
              {post.excerpt}
            </p>
          )}
        </Link>
      </div>

      {/* 3. 媒体区：大图 */}
      {coverImageUrl && (
        <div className="mb-4 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
          <Link href={`/blog/${post.slug}`}>
            <div className="relative w-full aspect-[2/1]">
              <Image
                src={coverImageUrl}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 800px"
              />
            </div>
          </Link>
        </div>
      )}

      {/* 4. 标签行 */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <Link key={tag.slug} href={`/blog?tag=${tag.slug}`} onClick={(e) => e.stopPropagation()}>
              <span className="text-sm text-primary hover:underline hover:text-primary/80">#{tag.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 5. 底部：操作栏 */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-6 text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className={cn("group h-9 px-2 -ml-2 gap-2 rounded-full", interactionStyles.comment)}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm">{post.stats.commentsCount > 0 ? formatNumber(post.stats.commentsCount) : "评论"}</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn("group h-9 px-2 gap-2 rounded-full", interactionStyles.like)}
          >
            <Heart className="h-5 w-5" />
            <span className="text-sm">{post.stats.likesCount > 0 ? formatNumber(post.stats.likesCount) : "点赞"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="group h-9 px-2 gap-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <BarChart2 className="h-5 w-5" />
            <span className="text-sm">{post.viewCount > 0 ? formatNumber(post.viewCount) : "浏览"}</span>
          </Button>
        </div>

        <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9 rounded-full text-muted-foreground", interactionStyles.share)}
        >
            <Share2 className="h-5 w-5" />
        </Button>
      </div>
    </motion.article>
  )
}
