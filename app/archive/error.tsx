"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { createLogger } from "@/lib/utils/logger"

const archiveErrorLogger = createLogger("archive-page-error")

export default function ArchiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 记录错误到控制台或错误追踪服务
    archiveErrorLogger.error("Archive page error", { digest: error.digest }, error)
  }, [error])

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <AlertCircle className="text-destructive mx-auto mb-4 h-12 w-12" />
        <h1 className="mb-2 text-2xl font-bold">加载归档页面时出错</h1>
        <p className="text-muted-foreground mb-6">
          抱歉，我们在加载文章归档时遇到了问题。请稍后重试。
        </p>

        <div className="flex justify-center gap-4">
          <Button onClick={reset}>重试</Button>
          <Button variant="outline" asChild>
            <Link href="/">返回首页</Link>
          </Button>
        </div>

        {/* 开发环境显示错误详情 */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-8 text-left">
            <summary className="text-muted-foreground cursor-pointer text-sm">
              错误详情（仅开发环境可见）
            </summary>
            <pre className="bg-secondary mt-2 overflow-auto rounded-md p-4 text-xs">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
