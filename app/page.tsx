import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { LatestContentSection } from "@/components/latest-content-section"
import { InteractiveTerminalSection } from "@/components/interactive-terminal-section"

export default function HomePage() {
  return (
    <div className="bg-background min-h-screen">

      <HeroSection />
      <FeaturesSection />

      <section className="from-background to-muted/20 bg-gradient-to-b px-4 py-20">
        <div className="container mx-auto text-center">
          <h2 className="mb-4 text-3xl font-bold">体验开发流程</h2>
          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl">
            观看现代化开发工作流程的实时演示，或切换到交互模式亲自体验命令行操作
          </p>
          <InteractiveTerminalSection />
        </div>
      </section>

      <LatestContentSection />

      {/* Footer */}
      <footer className="border-t px-4 py-12">
        <div className="text-muted-foreground container mx-auto text-center">
          <p>&copy; 2024 现代博客平台. 保留所有权利.</p>
        </div>
      </footer>
    </div>
  )
}
