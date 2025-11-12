import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const compactNumberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCompactCount(value: number | null | undefined): string {
  if (value == null) {
    return "0"
  }
  return compactNumberFormatter.format(value)
}
