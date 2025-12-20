"use client"

import { toast as sonnerToast } from "sonner"
import type { ReactNode } from "react"

type ToastProps = {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  variant?: "default" | "destructive"
  [key: string]: any
}

function toast({ title, description, variant, action, ...props }: ToastProps) {
  const options = {
    description,
    action: action as any,
    ...props,
  }

  if (variant === "destructive") {
    return sonnerToast.error(title, options)
  }

  return sonnerToast(title, options)
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    toasts: [],
  }
}

export { useToast, toast }
