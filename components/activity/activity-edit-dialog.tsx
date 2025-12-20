"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ActivityForm } from "@/components/activity/activity-form"
import type { ActivityWithAuthor } from "@/types/activity"

interface ActivityEditDialogProps {
  activity: ActivityWithAuthor | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (activity: ActivityWithAuthor) => void
}

export function ActivityEditDialog({
  activity,
  open,
  onOpenChange,
  onSuccess,
}: ActivityEditDialogProps) {
  const handleSuccess = (updatedActivity: ActivityWithAuthor) => {
    onSuccess?.(updatedActivity)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  if (!activity) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>编辑动态</DialogTitle>
        </DialogHeader>
        <ActivityForm
          mode="edit"
          initialData={activity}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          showPinOption={activity.author?.role === "ADMIN"}
        />
      </DialogContent>
    </Dialog>
  )
}
