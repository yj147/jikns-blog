import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-12">
        <main className="col-span-1 lg:col-span-8">
          <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-30 mb-0 border-b px-4 py-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="mt-4">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="h-6 w-5/6" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </main>

        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-60 w-full rounded-xl" />
            <div className="px-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
