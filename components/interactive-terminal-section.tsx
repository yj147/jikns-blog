"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const InteractiveTerminal = dynamic(
  () => import("./interactive-terminal").then((mod) => ({ default: mod.InteractiveTerminal })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-4xl animate-pulse rounded-lg border border-border/40 bg-card/40 p-12 text-center text-muted-foreground">
        正在加载交互式终端...
      </div>
    ),
  }
)

export function InteractiveTerminalSection() {
  const [shouldRender, setShouldRender] = useState(false)

  if (!shouldRender) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-6 rounded-lg border border-border/40 bg-card/40 p-12 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold">交互式终端已按需加载</p>
          <p className="text-muted-foreground text-sm">首次点击时再加载动画，可降低首屏阻塞并提升 TTI</p>
        </div>
        <Button size="lg" onClick={() => setShouldRender(true)}>
          启用终端演示
        </Button>
      </div>
    )
  }

  return <InteractiveTerminal />
}
