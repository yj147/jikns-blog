import { Suspense } from "react"

import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton"

import { SearchPageClient } from "./search-page-client"

function SearchPageFallback() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-0 py-6 lg:grid-cols-12 lg:px-4">
        <main className="col-span-1 lg:col-span-8">
          <div className="sticky top-16 z-30 mb-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="px-4 py-3">
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex w-full gap-2 overflow-x-auto px-2 py-2 no-scrollbar">
              {[1, 2, 3, 4, 5].map((key) => (
                <div key={key} className="h-9 w-20 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-border px-4">
            <SearchResultsSkeleton />
          </div>
        </main>
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6 px-4">
            <div className="h-32 rounded-xl bg-muted/40" />
            <div className="h-20 rounded-xl bg-muted/30" />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageClient />
    </Suspense>
  )
}
