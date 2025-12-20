"use client"

import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { User as DatabaseUser } from "@/lib/generated/prisma"
import type { ClientFeatureFlags } from "@/lib/config/client-feature-flags"
import { cn } from "@/lib/utils"
import type { FeedTab } from "@/components/feed/hooks/use-feed-state"

interface FeedHeaderProps {
  activeTab: FeedTab
  featureFlags: ClientFeatureFlags
  isRealtimeSubscribed: boolean
  isLoading: boolean
  onRefresh: () => void
  onTabChange: (tab: FeedTab) => void
  user: DatabaseUser | null
}

export function FeedHeader({
  activeTab,
  featureFlags,
  isRealtimeSubscribed,
  isLoading,
  onRefresh,
  onTabChange,
  user,
}: FeedHeaderProps) {
  return (
    <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-30 mb-0 border-b backdrop-blur">
      <div className="flex w-full items-center">
        <div className="flex flex-1">
          {featureFlags.feedFollowingStrict && (
            <button
              onClick={() => onTabChange("following")}
              disabled={!user}
              className={cn(
                "hover:bg-muted/50 relative h-12 flex-1 text-sm font-medium transition-colors",
                activeTab === "following" ? "text-foreground font-bold" : "text-muted-foreground"
              )}
            >
              关注
              {activeTab === "following" && (
                <div className="bg-primary absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full" />
              )}
            </button>
          )}
          <button
            onClick={() => onTabChange("latest")}
            className={cn(
              "hover:bg-muted/50 relative h-12 flex-1 text-sm font-medium transition-colors",
              activeTab === "latest" ? "text-foreground font-bold" : "text-muted-foreground"
            )}
          >
            最新
            {activeTab === "latest" && (
              <div className="bg-primary absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full" />
            )}
          </button>
          <button
            onClick={() => onTabChange("trending")}
            className={cn(
              "hover:bg-muted/50 relative h-12 flex-1 text-sm font-medium transition-colors",
              activeTab === "trending" ? "text-foreground font-bold" : "text-muted-foreground"
            )}
          >
            热门
            {activeTab === "trending" && (
              <div className="bg-primary absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-1 px-2">
          {isRealtimeSubscribed && (
            <span className="bg-status-success flex h-2 w-2 rounded-full" title="实时连接正常" />
          )}
          {isLoading && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>
    </div>
  )
}
