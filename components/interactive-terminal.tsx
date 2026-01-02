"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

const commands = [
  {
    command: "npm create next-app@latest my-blog",
    output: [
      "✔ Would you like to use TypeScript? … Yes",
      "✔ Would you like to use ESLint? … Yes",
      "✔ Would you like to use Tailwind CSS? … Yes",
      "✔ Would you like to use `src/` directory? … No",
      "✔ Would you like to use App Router? … Yes",
      "Creating a new Next.js app in /my-blog...",
      "",
      "Success! Created my-blog at /my-blog",
    ],
  },
  {
    command: "cd my-blog && npm run dev",
    output: [
      "  ▲ Next.js 14.2.25",
      "  - Local:        http://localhost:3000",
      "  - Environments: .env.local",
      "",
      "✓ Ready in 2.1s",
    ],
  },
  {
    command: 'git add . && git commit -m "Initial commit"',
    output: [
      "[main (root-commit) a1b2c3d] Initial commit",
      " 23 files changed, 1847 insertions(+)",
      " create mode 100644 README.md",
      " create mode 100644 package.json",
      " create mode 100644 next.config.js",
    ],
  },
]

export function InteractiveTerminal() {
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0)
  const [displayedCommand, setDisplayedCommand] = useState("")
  const [displayedOutput, setDisplayedOutput] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [showCursor, setShowCursor] = useState(true)
  const [isInteractive, setIsInteractive] = useState(false)
  const [userInput, setUserInput] = useState("")

  // Cursor blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Auto-play terminal commands
  useEffect(() => {
    if (isInteractive) return

    const currentCommand = commands[currentCommandIndex]
    if (!currentCommand) return

    setIsTyping(true)
    setDisplayedCommand("")
    setDisplayedOutput([])

    // Type command
    let commandIndex = 0
    const typeCommand = () => {
      if (commandIndex < currentCommand.command.length) {
        setDisplayedCommand(currentCommand.command.slice(0, commandIndex + 1))
        commandIndex++
        setTimeout(typeCommand, 50 + Math.random() * 50)
      } else {
        // Show output after command is typed
        setTimeout(() => {
          let outputIndex = 0
          const showOutput = () => {
            if (outputIndex < currentCommand.output.length) {
              setDisplayedOutput((prev) => [...prev, currentCommand.output[outputIndex]])
              outputIndex++
              setTimeout(showOutput, 200 + Math.random() * 300)
            } else {
              setIsTyping(false)
              // Move to next command after delay
              setTimeout(() => {
                setCurrentCommandIndex((prev) => (prev + 1) % commands.length)
              }, 2000)
            }
          }
          showOutput()
        }, 500)
      }
    }
    typeCommand()
  }, [currentCommandIndex, isInteractive])

  const handleInteractiveMode = () => {
    setIsInteractive(true)
    setDisplayedCommand("")
    setDisplayedOutput([
      "Welcome to interactive mode! Try typing some commands:",
      "Available: help, about, skills, contact",
    ])
  }

  const handleUserCommand = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const command = userInput.toLowerCase().trim()
      setDisplayedOutput((prev) => [...prev, `$ ${userInput}`, ...getCommandResponse(command)])
      setUserInput("")
    }
  }

  const getCommandResponse = (command: string): string[] => {
    switch (command) {
      case "help":
        return [
          "Available commands:",
          "- about: Learn about this platform",
          "- skills: View tech stack",
          "- contact: Get in touch",
          "- clear: Clear terminal",
        ]
      case "about":
        return [
          "现代博客平台 - 双核驱动的内容与社交体验",
          "Built with Next.js, React, TypeScript, and modern web technologies",
        ]
      case "skills":
        return [
          "Tech Stack:",
          "- Frontend: Next.js 14, React 19, TypeScript",
          "- Styling: Tailwind CSS, shadcn/ui, Magic UI",
          "- Animation: CSS transitions",
          "- Backend: Supabase, Prisma",
        ]
      case "contact":
        return [
          "Get in touch:",
          "- Email: hello@modernblog.com",
          "- GitHub: github.com/modernblog",
          "- Twitter: @modernblog",
        ]
      case "clear":
        setDisplayedOutput([])
        return []
      default:
        return [`Command not found: ${command}`, "Type 'help' for available commands"]
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto w-full max-w-4xl duration-300">
      <div className="border-border bg-muted/80 overflow-hidden rounded-lg border shadow-2xl">
        {/* Terminal Header */}
        <div className="border-border/60 bg-background/60 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <div className="bg-status-error h-3 w-3 rounded-full"></div>
            <div className="bg-status-warning h-3 w-3 rounded-full"></div>
            <div className="bg-status-success h-3 w-3 rounded-full"></div>
          </div>
          <div className="text-muted-foreground font-mono text-sm">Terminal</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInteractiveMode}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Interactive Mode
          </Button>
        </div>

        {/* Terminal Content */}
        <div className="max-h-[500px] min-h-[400px] overflow-y-auto p-6 font-mono text-sm">
          {!isInteractive ? (
            <div key="auto-mode" className="animate-in fade-in duration-200">
              {/* Current Command */}
              <div className="text-status-success mb-2 flex items-center">
                <span className="text-status-info mr-2">$</span>
                <span>{displayedCommand}</span>
                {isTyping && showCursor && (
                  <span className="bg-status-success ml-1 inline-block h-5 w-2"></span>
                )}
              </div>

              {/* Command Output */}
              <div className="text-muted-foreground mb-4">
                {displayedOutput.map((line, index) => (
                  <div key={index} className="mb-1">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key="interactive-mode" className="animate-in fade-in duration-200">
              {/* Interactive Output */}
              <div className="text-muted-foreground mb-4">
                {displayedOutput.map((line, index) => (
                  <div key={index} className="mb-1">
                    {line}
                  </div>
                ))}
              </div>

              {/* Interactive Input */}
              <div className="text-status-success flex items-center">
                <span className="text-status-info mr-2">$</span>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleUserCommand}
                  className="text-status-success flex-1 bg-transparent outline-none"
                  placeholder="Type a command..."
                  autoFocus
                />
                {showCursor && (
                  <span className="bg-status-success ml-1 inline-block h-5 w-2"></span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
