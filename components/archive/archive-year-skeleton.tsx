"use client"

import { memo } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function ArchiveYearSkeletonComponent() {
  return (
    <div className="relative">
      <div className="bg-primary/20 absolute -left-8 top-0 h-4 w-4 rounded-full" />
      <div className="ml-8 space-y-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  )
}

export default memo(ArchiveYearSkeletonComponent)
