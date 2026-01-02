import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto flex max-w-[1000px] justify-center gap-0 lg:gap-8">
        <div className="lg:border-border w-full max-w-[600px] lg:border-x">
          <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-30 mb-0 border-b backdrop-blur">
            <div className="flex h-12 items-center gap-3 px-4">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-12" />
              <div className="ml-auto flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </div>

          <div className="divide-border min-h-[50vh] divide-y">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex gap-4 p-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden w-[350px] shrink-0 lg:block">
          <div className="sticky top-20 space-y-4 py-4">
            <div className="bg-muted/30 overflow-hidden rounded-xl">
              <div className="px-4 pb-2 pt-4">
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>

            <div className="bg-muted/30 overflow-hidden rounded-xl">
              <div className="px-4 pb-2 pt-4">
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
