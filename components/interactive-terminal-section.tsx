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
      <div className="border-border mx-auto w-full max-w-4xl overflow-hidden rounded-xl border shadow-2xl">
        <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1.5">
            <div className="bg-status-error/20 h-3 w-3 rounded-full" />
            <div className="bg-status-warning/20 h-3 w-3 rounded-full" />
            <div className="bg-status-success/20 h-3 w-3 rounded-full" />
          </div>
          <div className="text-muted-foreground ml-2 font-mono text-xs">terminal — loading...</div>
        </div>
        <div className="text-muted-foreground flex min-h-[400px] flex-col items-center justify-center bg-black/90 p-12">
          <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
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
      <div className="border-border hover:border-primary/50 group relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border bg-black/95 shadow-2xl transition-all">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div className="flex gap-1.5">
            <div className="bg-status-error h-3 w-3 rounded-full" />
            <div className="bg-status-warning h-3 w-3 rounded-full" />
            <div className="bg-status-success h-3 w-3 rounded-full" />
          </div>
          <div className="text-muted-foreground ml-2 flex items-center gap-2 font-mono text-xs">
            <Terminal className="h-3 w-3" />
            <span>bash — interactive-demo</span>
          </div>
        </div>

        {/* Terminal Body Mockup */}
        <div className="text-status-success/80 relative min-h-[400px] p-6 font-mono text-sm">
          <div className="space-y-2 opacity-50 blur-[1px]">
            <p>
              <span className="text-status-info">➜</span>{" "}
              <span className="text-status-info/80">~</span> git clone
              https://github.com/example/project.git
            </p>
            <p>Cloning into &apos;project&apos;...</p>
            <p>remote: Enumerating objects: 142, done.</p>
            <p>remote: Counting objects: 100% (142/142), done.</p>
            <p>Receiving objects: 100% (142/142), 42.01 KiB | 2.10 MiB/s, done.</p>
            <p>
              <span className="text-status-info">➜</span>{" "}
              <span className="text-status-info/80">~</span> cd project
            </p>
            <p>
              <span className="text-status-info">➜</span>{" "}
              <span className="text-status-info/80">~/project</span> npm install
            </p>
            <div className="bg-status-success/50 h-4 w-2 animate-pulse" />
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] transition-all group-hover:bg-black/50">
            <Button
              size="lg"
              onClick={() => setShouldRender(true)}
              className="gap-2 text-base font-semibold shadow-lg transition-all hover:scale-105"
            >
              <Play className="h-4 w-4 fill-current" />
              启动交互式终端
            </Button>
            <p className="text-muted-foreground mt-4 text-sm">点击体验真实的命令行操作流程</p>
          </div>
        </div>
      </div>
    )
  }

  return <InteractiveTerminal />
}
