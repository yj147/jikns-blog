"use client"

import type { ReactNode } from "react"
import { SWRConfig } from "swr"

import { swrConfig } from "@/lib/swr-config"

type SwrProviderProps = {
  children: ReactNode
}

export function SwrProvider({ children }: SwrProviderProps) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>
}
