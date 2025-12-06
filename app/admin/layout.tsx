import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { fetchAuthenticatedUser } from "@/lib/auth/session"
import AdminSidebar from "@/components/admin/admin-sidebar"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await fetchAuthenticatedUser()

  if (!user) {
    redirect("/login/email?redirect=/admin")
  }

  if (user.role !== "ADMIN") {
    redirect("/unauthorized")
  }

  if (user.status !== "ACTIVE") {
    redirect("/unauthorized")
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1">
          <div className="p-6 md:p-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
