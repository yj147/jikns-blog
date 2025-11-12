import Link from "next/link"
import { PenTool } from "lucide-react"

import { navigationItems } from "./navigation-links"
import NavigationInteractive from "./navigation-interactive"

export function NavigationServer() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur transition-shadow duration-300">
      <div className="container flex h-16 items-center gap-4 px-4">
        <Link href="/" className="group flex items-center space-x-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-3">
            <PenTool className="h-4 w-4" />
          </div>
          <span className="text-xl font-bold transition-transform duration-200 group-hover:scale-105">现代博客</span>
        </Link>

        <nav
          data-nav="main"
          className="text-muted-foreground hidden flex-1 items-center justify-center gap-6 text-sm font-medium md:flex"
          aria-label="主导航"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                data-nav-link="true"
                className="flex items-center gap-2 transition-colors hover:text-primary"
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto">
          <NavigationInteractive />
        </div>
      </div>
    </header>
  )
}

export default NavigationServer
