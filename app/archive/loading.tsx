import { Skeleton } from "@/components/ui/skeleton"

export default function ArchiveLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* 页面标题骨架 */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-9 w-32" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* 统计信息骨架 */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>

      {/* 导航栏骨架 */}
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>

      {/* 时间线骨架 */}
      <div className="space-y-8">
        {[1, 2, 3].map((year) => (
          <div key={year}>
            <Skeleton className="mb-4 h-7 w-48" />
            <div className="ml-8 space-y-4">
              {[1, 2, 3].map((month) => (
                <div key={month}>
                  <Skeleton className="mb-2 h-5 w-32" />
                  <div className="ml-4 space-y-2">
                    {[1, 2, 3].map((post) => (
                      <Skeleton key={post} className="h-16" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
