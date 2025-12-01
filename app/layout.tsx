import type React from "react"
import type { Metadata } from "next"
import { geistSans, manrope } from "./fonts"
import { AuthProvider } from "./providers/auth-provider"
import { SwrProvider } from "./providers/swr-provider"
import { Toaster } from "@/components/ui/toaster"
// import { Toaster as SonnerToaster } from "sonner"
import { AuthStateListener } from "@/components/auth-state-listener"
import ErrorBoundary from "@/components/error-boundary"
import { CSRFToken } from "@/components/security/csrf-token"
import NavigationServer from "@/components/navigation-server"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

// 导入 EventEmitter 优化配置
import "@/lib/event-emitter-config"

export const metadata: Metadata = {
  title: "现代博客平台",
  description: "集博客与社交于一体的现代化平台",
  generator: "v0.app",
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
      className={`${geistSans.variable} ${geistSans.className} ${manrope.variable} antialiased`}
    >
      <body className="bg-background min-h-screen font-sans antialiased">
        <SwrProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ErrorBoundary>
              <AuthProvider>
                <AuthStateListener />
                <CSRFToken hidden />
                <NavigationServer />
                <main>{children}</main>
              </AuthProvider>
            </ErrorBoundary>
            {/* Toast 通知系统 */}
            <Toaster />
          </ThemeProvider>
        </SwrProvider>
        {/* Sonner Toast - 待安装完成后启用
        <SonnerToaster 
          position="top-right"
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e2e8f0',
              color: '#1e293b',
            },
          }}
          closeButton
          richColors
        />
        */}
      </body>
    </html>
  )
}
