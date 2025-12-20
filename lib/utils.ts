import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCompactCount(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "0"
  }
  const formatted = compactNumberFormatter.format(value)
  const normalized = formatted.replace(/[,\\s]/g, "")

  if (normalized === value.toString()) {
    return formatCompactFallback(value)
  }

  return formatted
}

function formatCompactFallback(value: number): string {
  const abs = Math.abs(value)

  if (abs < 1000) return value.toString()

  const units = [
    { limit: 1_000_000_000, suffix: "B" },
    { limit: 1_000_000, suffix: "M" },
    { limit: 1000, suffix: "K" },
  ]

  const unit = units.find((item) => abs >= item.limit) ?? units[units.length - 1]
  const result = value / unit.limit
  const fixed = result >= 10 ? result.toFixed(0) : result.toFixed(1)

  return `${fixed.replace(/\\.0$/, "")}${unit.suffix}`
}
