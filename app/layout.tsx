import { Toaster } from "@/components/ui/sonner"
import ErrorBoundary from "@/components/error-boundary"
import NavigationServer from "@/components/navigation-server"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "./providers/auth-provider"
import { SwrProvider } from "./providers/swr-provider"
import { geistSans, manrope, lora } from "./fonts"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

// 导入 EventEmitter 优化配置
import "@/lib/event-emitter-config"

import type { Metadata } from "next"
import type React from "react"

export const metadata: Metadata = {
  title: "现代博客平台",
  description: "集博客与社交于一体的现代化平台",
  icons: {
    icon: "/placeholder-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistSans.className} ${manrope.variable} ${lora.variable} antialiased`}
    >
      <body className="bg-background min-h-screen font-sans antialiased">
        <SwrProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ErrorBoundary>
              <AuthProvider>
                <NavigationServer />
                <main>{children}</main>
              </AuthProvider>
            </ErrorBoundary>
            <Toaster />
          </ThemeProvider>
        </SwrProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
