import { Suspense } from "react"

import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton"

import { SearchPageClient } from "./search-page-client"

function SearchPageFallback() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-0 py-6 lg:grid-cols-12 lg:px-4">
        <main className="col-span-1 lg:col-span-8">
          <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-30 mb-0 border-b backdrop-blur">
            <div className="px-4 py-3">
              <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
            </div>
            <div className="no-scrollbar flex w-full gap-2 overflow-x-auto px-2 py-2">
              {[1, 2, 3, 4, 5].map((key) => (
                <div key={key} className="bg-muted h-9 w-20 animate-pulse rounded-full" />
              ))}
            </div>
          </div>
          <div className="divide-border divide-y px-4">
            <SearchResultsSkeleton />
          </div>
        </main>
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6 px-4">
            <div className="bg-muted/40 h-32 rounded-xl" />
            <div className="bg-muted/30 h-20 rounded-xl" />
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
