import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <section className="space-y-6">
      <div>
        <Skeleton className="h-10 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </section>
  )
}
