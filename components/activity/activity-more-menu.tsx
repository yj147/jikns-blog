"use client"

import { useCallback } from "react"
import { MoreHorizontal, Pencil, Trash2, Flag, Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ActivityMoreMenuProps = {
  activityId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit: boolean
  canDelete: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export default function ActivityMoreMenu({
  activityId,
  open,
  onOpenChange,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: ActivityMoreMenuProps) {
  const hasMenuItems = canEdit || canDelete

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/feed?highlight=${activityId}`
    void navigator.clipboard.writeText(url)
  }, [activityId])

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground -mr-2 h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">更多</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink}>
          <Link2 className="mr-2 h-4 w-4" />
          复制链接
        </DropdownMenuItem>

        {hasMenuItems && <DropdownMenuSeparator />}

        {canEdit && onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            编辑
          </DropdownMenuItem>
        )}

        {canDelete && onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        )}

        {!hasMenuItems && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Flag className="mr-2 h-4 w-4" />
              举报
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
