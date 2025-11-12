"use client"

import { mutate } from "swr"
import { toast } from "sonner"
import { logger } from "@/lib/utils/logger"
import {
  invokeToggleFollow,
  setToggleFollowLoader,
  type FollowError,
} from "@/lib/interactions/follow-client"
import { createFollowUserHook, type UseFollowUserOptions } from "./internal/create-follow-user"

export type { FollowError }
export type { UseFollowUserOptions, FollowActionResult } from "./internal/create-follow-user"

const isTestEnv = typeof process !== "undefined" && process.env.NODE_ENV === "test"

if (typeof window !== "undefined" && !isTestEnv) {
  setToggleFollowLoader(async () => {
    const mod = await import("@/lib/actions/follow")
    return mod.toggleFollowAction
  })
}

const useFollowUserCore = createFollowUserHook({
  toggle: invokeToggleFollow,
  mutate,
  toast,
  logger,
})

export const useFollowUser = (options?: UseFollowUserOptions) => useFollowUserCore(options)
