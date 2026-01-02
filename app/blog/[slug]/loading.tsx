import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-12">
        <main className="border-border col-span-1 lg:col-span-8 lg:border-r lg:pr-8">
          <div className="mb-6">
            <Skeleton className="h-4 w-20" />
          </div>

          <Skeleton className="mb-4 h-10 w-3/4" />

          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>

          <Skeleton className="h-12 w-full" />

          <div className="mt-6 space-y-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </main>

        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </aside>
      </div>
    </div>
  )
}
