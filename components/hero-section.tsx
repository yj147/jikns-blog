import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpen, Users, Sparkles } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20">
      <div className="absolute inset-0 -z-10">
        <div
          className="bg-primary/10 absolute left-1/4 top-1/4 h-64 w-64 rounded-full blur-3xl opacity-70"
          aria-hidden
        />
        <div
          className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl opacity-60"
          aria-hidden
        />
      </div>

      <div className="container mx-auto text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            现代化博客与
            <span className="relative mx-2 inline-block text-primary">
              <span className="absolute inset-x-0 bottom-0 h-3 rounded-full bg-primary/15" aria-hidden />
              <span className="relative">社交平台</span>
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
            探索精彩内容，分享生活动态，与志同道合的朋友建立连接
          </p>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <div className="group">
            <Button
              size="lg"
              asChild
              className="relative overflow-hidden transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg"
            >
              <Link href="/blog">
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 to-emerald-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  浏览博客
                </span>
              </Link>
            </Button>
          </div>

          <div className="group">
            <Button
              size="lg"
              variant="outline"
              asChild
              className="relative overflow-hidden bg-transparent transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg"
            >
              <Link href="/feed">
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 to-emerald-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  查看动态
                </span>
              </Link>
            </Button>
          </div>
        </div>

        <div className="pointer-events-none" aria-hidden>
          <Sparkles className="text-primary/20 absolute left-20 top-16 h-8 w-8" />
          <BookOpen className="absolute right-24 top-28 h-6 w-6 text-emerald-500/30" />
        </div>
      </div>
    </section>
  )
}
