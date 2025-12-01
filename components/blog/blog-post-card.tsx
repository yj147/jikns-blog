/**
 * 博客文章卡片组件 - Phase 5.2
 * 用于博客列表页面的文章展示卡片
 */

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Eye, Heart, MessageCircle, Pin } from "lucide-react"
import { PostListItem } from "@/types/blog"
import {
  formatDate,
  formatRelativeTime,
  calculateReadTime,
  formatNumber,
  generateTagColor,
} from "@/lib/utils/blog-helpers"

interface BlogPostCardProps {
  post: PostListItem
  index?: number
}

export function BlogPostCard({ post, index = 0 }: BlogPostCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5, scale: 1.01 }}
      layout
    >
      <Card className="from-background to-muted/10 group relative overflow-hidden border-0 bg-gradient-to-br transition-all duration-300 hover:shadow-xl">
        {/* 置顶标识 */}
        {post.isPinned && (
          <div className="absolute right-4 top-4 z-10">
            <motion.div
              className="bg-primary text-primary-foreground flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              whileHover={{ scale: 1.1 }}
            >
              <Pin className="h-3 w-3" />
              置顶
            </motion.div>
          </div>
        )}

        <CardHeader>
          {/* 作者信息 */}
          <div className="mb-3 flex items-center space-x-3">
            <motion.div whileHover={{ scale: 1.1, rotate: 5 }}>
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={post.author.avatarUrl || ""}
                  alt={post.author.name || "匿名用户"}
                />
                <AvatarFallback>{post.author.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium">{post.author.name || "匿名用户"}</p>
              <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                <Calendar className="h-3 w-3" />
                <span title={formatDate(post.publishedAt)}>
                  {formatRelativeTime(post.publishedAt)}
                </span>
                <Clock className="ml-2 h-3 w-3" />
                <span>{calculateReadTime(post.contentLength)}</span>
              </div>
            </div>
          </div>

          {/* 文章标题 */}
          <Link href={`/blog/${post.slug}`}>
            <CardTitle className="group-hover:text-primary line-clamp-2 cursor-pointer text-xl leading-snug transition-colors">
              {post.title}
            </CardTitle>
          </Link>

          {/* 文章摘要 */}
          {post.excerpt && (
            <CardDescription className="mt-2 line-clamp-3 text-base leading-relaxed">
              {post.excerpt}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {/* 标签 */}
          {post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag, tagIndex) => (
                <motion.div
                  key={`${post.id}-tag-${tag.slug || tagIndex}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: tagIndex * 0.1 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <Link href={`/blog?tag=${tag.slug}`}>
                    <Badge
                      variant="secondary"
                      className={`hover:bg-primary hover:text-primary-foreground cursor-pointer text-xs transition-colors ${
                        !tag.color ? generateTagColor(tag.name) : ""
                      }`}
                      style={tag.color ? { backgroundColor: tag.color, color: "#ffffff" } : undefined}
                    >
                      {tag.name}
                    </Badge>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {/* 统计数据和操作 */}
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <motion.span
                className="flex cursor-pointer items-center"
                whileHover={{ scale: 1.1, color: "#10b981" }}
                title={`${post.viewCount} 次浏览`}
              >
                <Eye className="mr-1 h-4 w-4" />
                {formatNumber(post.viewCount)}
              </motion.span>

              <motion.span
                className="flex cursor-pointer items-center"
                whileHover={{ scale: 1.1, color: "#ef4444" }}
                title={`${post.stats.likesCount} 个赞`}
              >
                <Heart className="mr-1 h-4 w-4" />
                {formatNumber(post.stats.likesCount)}
              </motion.span>

              <motion.span
                className="flex cursor-pointer items-center"
                whileHover={{ scale: 1.1, color: "#3b82f6" }}
                title={`${post.stats.commentsCount} 条评论`}
              >
                <MessageCircle className="mr-1 h-4 w-4" />
                {formatNumber(post.stats.commentsCount)}
              </motion.span>
            </div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
              >
                <Link href={`/blog/${post.slug}`}>阅读全文</Link>
              </Button>
            </motion.div>
          </div>
        </CardContent>

        {/* 悬停效果渐变 */}
        <div className="from-primary to-primary/80 pointer-events-none absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
      </Card>
    </motion.div>
  )
}
