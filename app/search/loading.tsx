import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton"

export default function Loading() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-10">
        <SearchResultsSkeleton />
      </div>
    </div>
  )
}
