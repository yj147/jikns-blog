import { Suspense } from "react"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import {
  LatestContentSection,
  LatestContentSectionSkeleton,
} from "@/components/latest-content-section"
import { InteractiveTerminalSection } from "@/components/interactive-terminal-section"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Github, Twitter } from "lucide-react"

export const revalidate = 120

export default function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 pb-12 pt-6 lg:grid-cols-12">
        {/* Left Sidebar (Desktop Navigation placeholder - optional, currently hidden or using main nav) 
            For this layout, we'll treat col-span-8 as the Main Feed and col-span-4 as the Right Widgets.
        */}

        {/* Main Feed Area */}
        <main className="col-span-1 space-y-6 lg:col-span-8">
          <HeroSection />

          <section aria-label="Developer Console">
            <InteractiveTerminalSection />
          </section>

          <Suspense fallback={<LatestContentSectionSkeleton />}>
            <LatestContentSection />
          </Suspense>
        </main>

        {/* Right Sidebar Widgets */}
        <aside className="hidden space-y-6 lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6">
            {/* Trending / Features Widget */}
            <FeaturesSection />

            {/* Social / Footer Widget */}
            <div className="border-border bg-muted/20 rounded-xl border p-6">
              <h3 className="mb-4 font-semibold">关注开发者</h3>
              <div className="flex gap-4">
                <Button variant="outline" size="icon" asChild>
                  <Link href="https://github.com" target="_blank">
                    <Github className="h-4 w-4" />
                    <span className="sr-only">GitHub</span>
                  </Link>
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <Link href="https://twitter.com" target="_blank">
                    <Twitter className="h-4 w-4" />
                    <span className="sr-only">Twitter</span>
                  </Link>
                </Button>
              </div>
              <div className="text-muted-foreground mt-6 text-xs">
                <p>&copy; 2025 现代博客平台. All rights reserved.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href="/privacy" prefetch={false} className="hover:underline">
                    隐私政策
                  </Link>
                  <span>·</span>
                  <Link href="/terms" prefetch={false} className="hover:underline">
                    服务条款
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
