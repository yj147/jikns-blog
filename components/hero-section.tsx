import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <div className="border-border from-primary/5 to-primary/10 relative overflow-hidden rounded-xl border bg-gradient-to-br px-6 py-8 sm:px-10 sm:py-12">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Sparkles className="text-primary h-6 w-6" />
            欢迎来到现代博客
          </h1>
          <p className="text-muted-foreground max-w-[600px] text-base">
            这里是极客与创造者的聚集地。分享代码、探讨技术、记录生活。
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild className="font-semibold shadow-md">
            <Link href="/login" prefetch={false}>
              加入社区
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="bg-background/50">
            <Link href="/about" prefetch={false}>
              了解更多
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
