/**
 * 标签卡片组件
 * Phase 10 - M3 阶段
 */

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Hash, FileText } from "lucide-react"

interface TagCardProps {
  tag: {
    id: string
    name: string
    slug: string
    description?: string | null
    color?: string | null
    postsCount: number
  }
  index?: number
}

const sizeBreakpoints: Array<{ threshold: number; className: string }> = [
  { threshold: 20, className: "text-2xl" },
  { threshold: 10, className: "text-xl" },
  { threshold: 5, className: "text-lg" },
]

function resolveSizeClass(count: number): string {
  for (const { threshold, className } of sizeBreakpoints) {
    if (count >= threshold) {
      return className
    }
  }
  return "text-base"
}

export function TagCard({ tag, index = 0 }: TagCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.05 }}
    >
      <Link href={`/tags/${tag.slug}`}>
        <Card className="group relative h-full overflow-hidden border-2 transition-all duration-300 hover:shadow-lg">
          {/* 背景装饰 */}
          <div
            className="absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10"
            style={{
              backgroundColor: tag.color || "#3B82F6",
            }}
          />

          <CardContent className="relative flex h-full flex-col items-center justify-center p-6 text-center">
            {/* 标签图标 */}
            <div
              className="mb-3 rounded-full p-3 transition-transform group-hover:scale-110"
              style={{
                backgroundColor: tag.color ? `${tag.color}20` : "#3B82F620",
              }}
            >
              <Hash
                className="h-6 w-6"
                style={{
                  color: tag.color || "#3B82F6",
                }}
              />
            </div>

            {/* 标签名称 */}
            <h3
              className={`group-hover:text-primary mb-2 font-bold transition-colors ${resolveSizeClass(tag.postsCount)}`}
            >
              {tag.name}
            </h3>

            {/* 标签描述 */}
            {tag.description && (
              <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">{tag.description}</p>
            )}

            {/* 文章数量 */}
            <div className="flex items-center gap-1 text-sm">
              <FileText className="h-4 w-4" />
              <span className="font-medium">{tag.postsCount}</span>
              <span className="text-muted-foreground">篇文章</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
