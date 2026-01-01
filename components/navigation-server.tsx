import Link from "next/link"
import { Suspense } from "react"
import { PenTool } from "lucide-react"

import { ClientOnly } from "@/components/client-only"
import { navigationItems } from "./navigation-links"
import NavigationInteractive from "./navigation-interactive"
import NavigationSearch from "./navigation-search"

export async function NavigationServer() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur transition-shadow duration-300">
      <div className="container flex h-16 items-center gap-4 px-4">
        <Link href="/" prefetch={false} className="group flex shrink-0 items-center space-x-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-3">
            <PenTool className="h-4 w-4" />
          </div>
          <span className="hidden text-xl font-bold transition-transform duration-200 group-hover:scale-105 sm:inline">
            现代博客
          </span>
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
                prefetch={false}
                data-nav-link="true"
                className="hover:text-primary flex items-center gap-2 transition-colors"
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <div className="min-w-[200px] max-w-xl flex-1">
            <Suspense fallback={<div className="bg-muted h-10 w-full rounded-lg" />}>
              <NavigationSearch className="w-full" />
            </Suspense>
          </div>
          <ClientOnly
            fallback={
              <div className="flex items-center gap-3" aria-hidden>
                <div className="bg-muted h-10 w-10 rounded-full" />
                <div className="bg-muted h-10 w-10 rounded-full md:hidden" />
                <div className="bg-muted h-10 w-24 rounded-full" />
              </div>
            }
          >
            <NavigationInteractive />
          </ClientOnly>
        </div>
      </div>
    </header>
  )
}

export default NavigationServer
