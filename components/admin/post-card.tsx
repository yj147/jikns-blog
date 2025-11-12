"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Calendar,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Pin,
  PinOff,
  Globe,
  FileText,
  Hash,
  MessageSquare,
  ThumbsUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"

// Post 数据类型定义
export interface Post {
  id: string
  title: string
  slug: string
  summary?: string
  content: string
  coverImage?: string
  tags: string[]
  isPublished: boolean
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
  // 统计数据
  views?: number
  likes?: number
  comments?: number
  // SEO 数据
  metaTitle?: string
  metaDescription?: string
  // 作者信息
  author?: {
    id: string
    name: string
    avatar?: string
  }
}

export interface PostCardProps {
  post: Post
  onEdit?: (post: Post) => void
  onDelete?: (post: Post) => Promise<void>
  onTogglePin?: (post: Post) => Promise<void>
  onTogglePublish?: (post: Post) => Promise<void>
  variant?: "admin" | "public" | "compact"
  index?: number
  className?: string
}

export function PostCard({
  post,
  onEdit,
  onDelete,
  onTogglePin,
  onTogglePublish,
  variant = "admin",
  index = 0,
  className,
}: PostCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 处理删除操作
  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await onDelete?.(post)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error("删除文章失败:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理置顶切换
  const handleTogglePin = async () => {
    setIsLoading(true)
    try {
      await onTogglePin?.(post)
    } catch (error) {
      console.error("切换置顶状态失败:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理发布状态切换
  const handleTogglePublish = async () => {
    setIsLoading(true)
    try {
      await onTogglePublish?.(post)
    } catch (error) {
      console.error("切换发布状态失败:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // 格式化发布时间
  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
  }

  // 截取摘要
  const truncateSummary = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  const coverImageUrl = useMemo(
    () =>
      post.coverImage
        ? getOptimizedImageUrl(post.coverImage, { width: 1280, height: 720, quality: 80 })
        : undefined,
    [post.coverImage]
  )

  // 公共展示模式
  if (variant === "public") {
    return (
      <Card className={cn("transition-shadow hover:shadow-lg", className)}>
        {post.coverImage && (
          <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
            <Image
              src={coverImageUrl ?? post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              loading={index === 0 ? "eager" : "lazy"}
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : undefined}
            />
            {post.isPinned && (
              <Badge className="absolute left-2 top-2 bg-red-500 hover:bg-red-600">
                <Pin className="mr-1 h-3 w-3" />
                置顶
              </Badge>
            )}
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Link
              href={`/blog/${post.slug}`}
              className="hover:text-primary line-clamp-2 text-xl font-semibold transition-colors"
            >
              {post.title}
            </Link>
            {!post.coverImage && post.isPinned && (
              <Badge variant="destructive" className="ml-2">
                <Pin className="mr-1 h-3 w-3" />
                置顶
              </Badge>
            )}
          </div>

          {post.summary && (
            <p className="text-muted-foreground line-clamp-3 text-sm">
              {truncateSummary(post.summary)}
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* 标签 */}
          {post.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Hash className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{post.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* 统计信息 */}
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {post.views !== undefined && (
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {post.views}
                </span>
              )}
              {post.likes !== undefined && (
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {post.likes}
                </span>
              )}
              {post.comments !== undefined && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {post.comments}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(post.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 紧凑模式
  if (variant === "compact") {
    return (
      <div
        className={cn("hover:bg-muted/50 flex items-center gap-4 rounded-lg border p-3", className)}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Link
              href={`/blog/${post.slug}`}
              className="hover:text-primary truncate font-medium transition-colors"
            >
              {post.title}
            </Link>
            <div className="flex items-center gap-1">
              {post.isPinned && (
                <Badge variant="destructive">
                  <Pin className="h-3 w-3" />
                </Badge>
              )}
              <Badge variant={post.isPublished ? "default" : "secondary"}>
                {post.isPublished ? "已发布" : "草稿"}
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground truncate text-sm">{formatDate(post.updatedAt)}</p>
        </div>

        {(onEdit || onDelete || onTogglePin || onTogglePublish) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit?.(post)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
              )}
              {onTogglePin && (
                <DropdownMenuItem onClick={handleTogglePin}>
                  {post.isPinned ? (
                    <>
                      <PinOff className="mr-2 h-4 w-4" />
                      取消置顶
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 h-4 w-4" />
                      置顶文章
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onTogglePublish && (
                <DropdownMenuItem onClick={handleTogglePublish}>
                  {post.isPublished ? (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      设为草稿
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      发布文章
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除文章
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )
  }

  // 管理员模式（默认）
  return (
    <>
      <Card className={cn("transition-shadow hover:shadow-md", className)}>
        {post.coverImage && (
          <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
            <Image
              src={coverImageUrl ?? post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              loading={index === 0 ? "eager" : "lazy"}
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : undefined}
              quality={80}
            />
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 flex-1 text-lg font-semibold">{post.title}</h3>

            <div className="flex flex-shrink-0 items-center gap-1">
              {post.isPinned && (
                <Badge variant="destructive">
                  <Pin className="h-3 w-3" />
                </Badge>
              )}
              <Badge variant={post.isPublished ? "default" : "secondary"}>
                {post.isPublished ? "已发布" : "草稿"}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isLoading}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(post)}>
                    <Edit className="mr-2 h-4 w-4" />
                    编辑文章
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/blog/${post.slug}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      查看文章
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleTogglePin}>
                    {post.isPinned ? (
                      <>
                        <PinOff className="mr-2 h-4 w-4" />
                        取消置顶
                      </>
                    ) : (
                      <>
                        <Pin className="mr-2 h-4 w-4" />
                        置顶文章
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleTogglePublish}>
                    {post.isPublished ? (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        设为草稿
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        发布文章
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除文章
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {post.summary && (
            <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">
              {truncateSummary(post.summary)}
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* 标签 */}
          {post.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {post.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Hash className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
              {post.tags.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{post.tags.length - 4}
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="text-muted-foreground flex items-center justify-between pt-0 text-sm">
          <div className="flex items-center gap-4">
            {post.views !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {post.views} 次查看
              </span>
            )}
            {post.likes !== undefined && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                {post.likes} 点赞
              </span>
            )}
            {post.comments !== undefined && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {post.comments} 评论
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(post.updatedAt)}
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除文章</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除文章「{post.title}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
            >
              {isLoading ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
