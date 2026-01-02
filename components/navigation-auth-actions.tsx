"use client"

import Link from "next/link"
import dynamic from "next/dynamic"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/app/providers/auth-provider"

const AuthenticatedAuthActions = dynamic(() => import("./navigation-auth-actions-authenticated"), {
  ssr: false,
})

export default function AuthActions() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="hidden items-center space-x-3 sm:flex">
        <Link href="/login" prefetch={false}>
          <Button variant="ghost" size="sm">
            登录
          </Button>
        </Link>
        <Link href="/register" prefetch={false}>
          <Button size="sm">注册</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="hidden items-center space-x-4 sm:flex">
      <AuthenticatedAuthActions />
    </div>
  )
}
