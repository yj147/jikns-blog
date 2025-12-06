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
    <div className="sticky top-16 z-30 mb-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center">
        <div className="flex flex-1">
          {featureFlags.feedFollowingStrict && (
            <button
              onClick={() => onTabChange("following")}
              disabled={!user}
              className={cn(
                "flex-1 h-12 text-sm font-medium transition-colors relative hover:bg-muted/50",
                activeTab === "following" ? "text-foreground font-bold" : "text-muted-foreground"
              )}
            >
              关注
              {activeTab === "following" && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 bg-primary rounded-full" />
              )}
            </button>
          )}
          <button
            onClick={() => onTabChange("latest")}
            className={cn(
              "flex-1 h-12 text-sm font-medium transition-colors relative hover:bg-muted/50",
              activeTab === "latest" ? "text-foreground font-bold" : "text-muted-foreground"
            )}
          >
            最新
            {activeTab === "latest" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => onTabChange("trending")}
            className={cn(
              "flex-1 h-12 text-sm font-medium transition-colors relative hover:bg-muted/50",
              activeTab === "trending" ? "text-foreground font-bold" : "text-muted-foreground"
            )}
          >
            热门
            {activeTab === "trending" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 bg-primary rounded-full" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-1 px-2">
          {isRealtimeSubscribed && (
            <span className="flex h-2 w-2 rounded-full bg-status-success" title="实时连接正常" />
          )}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>
    </div>
  )
}
