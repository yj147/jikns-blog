"use client"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

// 动态导入 Markdown 预览组件，避免 SSR 问题
const MarkdownPreview = dynamic(() => import("@uiw/react-markdown-preview"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      <span className="ml-2">正在加载内容...</span>
    </div>
  ),
})

export interface MarkdownRendererProps {
  content: string
  className?: string
  colorMode?: "light" | "dark"
}

export function MarkdownRenderer({
  content,
  className,
  colorMode = "light",
}: MarkdownRendererProps) {
  const [mounted, setMounted] = useState(false)

  // 客户端挂载后才渲染组件
  useEffect(() => {
    setMounted(true)
  }, [])

  // 服务端渲染时显示加载占位符
  if (!mounted) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="space-y-4">
          <div className="bg-muted h-4 w-3/4 rounded"></div>
          <div className="bg-muted h-4 w-1/2 rounded"></div>
          <div className="bg-muted h-4 w-5/6 rounded"></div>
          <div className="bg-muted h-20 rounded"></div>
          <div className="bg-muted h-4 w-2/3 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)} data-color-mode={colorMode}>
      <MarkdownPreview
        source={content}
        style={{
          backgroundColor: "transparent",
          color: "inherit",
          fontFamily: "inherit",
        }}
        wrapperElement={{
          "data-color-mode": colorMode,
        }}
        // 自定义样式以适配主题
        className={cn(
          "prose prose-lg dark:prose-invert max-w-none",
          // 覆盖默认样式以确保与主题一致
          "[&_*]:text-foreground",
          "[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground",
          "[&_h4]:text-foreground [&_h5]:text-foreground [&_h6]:text-foreground",
          "[&_p]:text-foreground [&_li]:text-foreground",
          "[&_strong]:text-foreground [&_em]:text-foreground",
          "[&_code]:bg-muted [&_code]:text-foreground [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-0.5",
          "[&_pre]:bg-muted [&_pre]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4",
          "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
          "[&_blockquote]:border-l-primary [&_blockquote]:bg-muted/50 [&_blockquote]:p-4 [&_blockquote]:italic",
          "[&_table]:border-collapse [&_table]:border-spacing-0",
          "[&_th]:border-border [&_th]:bg-muted [&_th]:border [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold",
          "[&_td]:border-border [&_td]:border [&_td]:p-2",
          "[&_hr]:border-border",
          "[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
          // 图片样式
          "[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-sm",
          // 列表样式
          "[&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc",
          "[&_ul_ul]:list-circle [&_ol_ol]:list-lower-alpha",
          // 间距优化
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&_h1]:mb-4 [&_h1]:mt-8 [&_h2]:mb-3 [&_h2]:mt-6",
          "[&_h3]:mb-2 [&_h3]:mt-5 [&_h4]:mb-2 [&_h4]:mt-4",
          "[&_ol]:mb-4 [&_p]:mb-4 [&_ul]:mb-4",
          "[&_blockquote]:mb-4 [&_pre]:mb-4 [&_table]:mb-4"
        )}
      />
    </div>
  )
}
