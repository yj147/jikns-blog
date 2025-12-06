import Link from "next/link"
import { UserX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ProfileNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <UserX className="mb-6 h-16 w-16 text-muted-foreground" />
      <h1 className="mb-2 text-2xl font-bold">用户不存在</h1>
      <p className="mb-6 text-muted-foreground">抱歉，您访问的用户资料不存在或不可见。</p>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </main>
  )
}
