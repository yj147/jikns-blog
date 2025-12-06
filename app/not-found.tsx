import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <FileQuestion className="mb-6 h-16 w-16 text-muted-foreground" />
      <h1 className="mb-2 text-2xl font-bold">页面不存在</h1>
      <p className="mb-6 text-muted-foreground">抱歉，您访问的页面不存在或已被移除。</p>
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/">返回首页</Link>
        </Button>
        <Button asChild>
          <Link href="/blog">浏览文章</Link>
        </Button>
      </div>
    </main>
  )
}
