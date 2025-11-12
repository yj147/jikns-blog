"use client"

/**
 * 搜索页面错误边界
 * Next.js 自动使用此组件处理错误
 */

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/utils/logger"

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error("搜索页面渲染失败", { component: "app/search/error", digest: error.digest }, error)
  }, [error])

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="py-16 text-center">
            <AlertCircle className="text-destructive mx-auto mb-6 h-16 w-16" />

            <h1 className="mb-4 text-2xl font-bold">搜索出错了</h1>

            <p className="text-muted-foreground mb-2">抱歉，搜索功能遇到了问题。</p>

            {error.message && (
              <p className="text-muted-foreground mb-8 text-sm">错误信息：{error.message}</p>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button onClick={reset} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>

              <Button asChild variant="outline">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  返回首页
                </Link>
              </Button>
            </div>

            {error.digest && (
              <p className="text-muted-foreground mt-8 text-xs">错误 ID: {error.digest}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
