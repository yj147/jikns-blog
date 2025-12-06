"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Terminal, Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const InteractiveTerminal = dynamic(
  () => import("./interactive-terminal").then((mod) => ({ default: mod.InteractiveTerminal })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border shadow-2xl">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-status-error/20" />
            <div className="h-3 w-3 rounded-full bg-status-warning/20" />
            <div className="h-3 w-3 rounded-full bg-status-success/20" />
          </div>
          <div className="ml-2 text-xs text-muted-foreground font-mono">terminal — loading...</div>
        </div>
        <div className="bg-black/90 p-12 flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
          <p className="font-mono text-sm">Initializing environment...</p>
        </div>
      </div>
    ),
  }
)

export function InteractiveTerminalSection() {
  const [shouldRender, setShouldRender] = useState(false)

  if (!shouldRender) {
    return (
      <div className="group relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-black/95 shadow-2xl transition-all hover:border-primary/50">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-status-error" />
            <div className="h-3 w-3 rounded-full bg-status-warning" />
            <div className="h-3 w-3 rounded-full bg-status-success" />
          </div>
          <div className="ml-2 flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Terminal className="h-3 w-3" />
            <span>bash — interactive-demo</span>
          </div>
        </div>

        {/* Terminal Body Mockup */}
        <div className="relative min-h-[400px] p-6 font-mono text-sm text-status-success/80">
          <div className="space-y-2 opacity-50 blur-[1px]">
            <p><span className="text-status-info">➜</span> <span className="text-status-info/80">~</span> git clone https://github.com/example/project.git</p>
            <p>Cloning into &apos;project&apos;...</p>
            <p>remote: Enumerating objects: 142, done.</p>
            <p>remote: Counting objects: 100% (142/142), done.</p>
            <p>Receiving objects: 100% (142/142), 42.01 KiB | 2.10 MiB/s, done.</p>
            <p><span className="text-status-info">➜</span> <span className="text-status-info/80">~</span> cd project</p>
            <p><span className="text-status-info">➜</span> <span className="text-status-info/80">~/project</span> npm install</p>
            <div className="h-4 w-2 animate-pulse bg-status-success/50" />
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] transition-all group-hover:bg-black/50">
            <Button 
              size="lg" 
              onClick={() => setShouldRender(true)}
              className="gap-2 text-base font-semibold shadow-lg hover:scale-105 transition-all"
            >
              <Play className="h-4 w-4 fill-current" />
              启动交互式终端
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">点击体验真实的命令行操作流程</p>
          </div>
        </div>
      </div>
    )
  }

  return <InteractiveTerminal />
}
