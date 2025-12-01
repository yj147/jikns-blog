import type { ReactNode } from "react"

import { requireAdmin } from "@/lib/auth/session"
import AdminSidebar from "@/components/admin/admin-sidebar"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin()

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1">
          <div className="px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
