"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { secureFetch } from "@/lib/security/csrf-client"
import type { ActivityWithAuthor } from "@/types/activity"

interface ActivityDeleteDialogProps {
  activity: ActivityWithAuthor | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (activityId: string) => void
}

export function ActivityDeleteDialog({
  activity,
  open,
  onOpenChange,
  onSuccess,
}: ActivityDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!activity) return

    setIsDeleting(true)
    try {
      const response = await secureFetch(`/api/activities?id=${activity.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || "删除失败")
      }

      toast.success("动态已删除")
      onSuccess?.(activity.id)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setIsDeleting(false)
    }
  }

  if (!activity) return null

  const contentPreview =
    activity.content.length > 50
      ? `${activity.content.slice(0, 50)}...`
      : activity.content

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除这条动态吗？此操作无法撤销。
            <span className="mt-2 block rounded bg-muted p-2 text-sm text-foreground">
              "{contentPreview}"
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              "删除"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
