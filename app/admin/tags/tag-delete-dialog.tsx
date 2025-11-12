"use client"

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
import type { TagData } from "@/lib/actions/tags"

interface TagDeleteDialogProps {
  open: boolean
  tag: TagData | null
  isDeleting: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function TagDeleteDialog({
  open,
  tag,
  isDeleting,
  onConfirm,
  onOpenChange,
}: TagDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除标签？</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除标签 <strong>{tag?.name}</strong> 吗？
            {tag && tag.postsCount > 0 && (
              <span className="text-destructive mt-2 block">
                警告：该标签关联了 {tag.postsCount} 篇文章，删除后这些关联将被移除。
              </span>
            )}
            此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "删除中..." : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
