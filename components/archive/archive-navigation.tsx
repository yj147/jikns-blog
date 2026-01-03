"use client"

import { useState, useEffect } from "react"
import Link from "@/components/app-link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface ArchiveNavigationProps {
  years: { year: number; count: number }[]
  currentYear?: number
}

export default function ArchiveNavigation({ years, currentYear }: ArchiveNavigationProps) {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const router = useRouter()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isMobile) {
      setShowBackToTop(false)
      return
    }

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isMobile])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const scrollOrNavigate = (year: number) => {
    const element = document.getElementById(`year-${year}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    router.push(`/archive/${year}`)
  }

  return (
    <>
      {/* 年份导航栏 */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-10 -mx-4 border-b px-4 py-4 backdrop-blur">
        <ScrollArea className="w-full">
          <nav aria-label="年份导航" className="flex items-center gap-2">
            <span className="text-muted-foreground mr-2 whitespace-nowrap text-sm">快速跳转:</span>
            <div className="flex gap-2">
              {years.map((yearItem) => (
                <Button
                  key={yearItem.year}
                  type="button"
                  variant={currentYear === yearItem.year ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "whitespace-nowrap",
                    currentYear === yearItem.year && "pointer-events-none"
                  )}
                  onClick={() => {
                    if (currentYear === undefined) {
                      scrollOrNavigate(yearItem.year)
                    }
                  }}
                  asChild={currentYear !== yearItem.year && currentYear !== undefined}
                >
                  {currentYear !== yearItem.year && currentYear !== undefined ? (
                    <Link href={`/archive/${yearItem.year}`}>
                      {yearItem.year} ({yearItem.count})
                    </Link>
                  ) : (
                    <span>
                      {yearItem.year} ({yearItem.count})
                    </span>
                  )}
                </Button>
              ))}
              {!currentYear && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => scrollOrNavigate(years[0]?.year || new Date().getFullYear())}
                >
                  全部
                </Button>
              )}
            </div>
          </nav>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* 返回顶部按钮 */}
      {!isMobile && showBackToTop && (
        <div className="fixed bottom-8 right-8 z-50">
          <Button
            type="button"
            size="icon"
            variant="default"
            className="rounded-full shadow-lg"
            onClick={scrollToTop}
            aria-label="返回顶部"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )
}
