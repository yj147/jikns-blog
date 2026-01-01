"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { useIsMobile } from "@/components/ui/use-mobile"

const ThemeToggle = dynamic(() => import("./theme-toggle"), {
  ssr: false,
  loading: () => <div className="bg-muted h-10 w-10 rounded-full" />,
})

const NavigationClient = dynamic(() => import("./navigation-client"), {
  ssr: false,
  loading: () => null,
})

const MobileNavigation = dynamic(() => import("./navigation-mobile"), {
  ssr: false,
  loading: () => <div className="bg-muted h-10 w-10 rounded-full md:hidden" />,
})

const AuthActions = dynamic(() => import("./navigation-auth-actions"), {
  ssr: false,
  loading: () => <div className="bg-muted h-10 w-24 rounded-full" />,
})

export default function NavigationInteractive() {
  const isMobile = useIsMobile()
  return (
    <Suspense fallback={<div className="bg-muted h-10 w-10 rounded-full" />}>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NavigationClient />
        {isMobile ? <MobileNavigation /> : null}
        <AuthActions />
      </div>
    </Suspense>
  )
}
