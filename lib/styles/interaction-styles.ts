/**
 * 交互样式工具
 * 使用设计系统中定义的语义颜色变量
 */

// 交互动作样式 - 用于按钮悬停效果
export const interactionStyles = {
  like: "hover:bg-action-like/10 hover:text-action-like transition-colors",
  comment: "hover:bg-action-comment/10 hover:text-action-comment transition-colors",
  share: "hover:bg-primary/10 hover:text-primary transition-colors",
  bookmark: "hover:bg-action-bookmark/10 hover:text-action-bookmark transition-colors",
} as const

// 状态样式 - 用于状态指示
export const statusStyles = {
  success: "text-status-success",
  warning: "text-status-warning",
  error: "text-status-error",
  info: "text-status-info",
} as const

export const statusBackgrounds = {
  success: "bg-status-success/10",
  warning: "bg-status-warning/10",
  error: "bg-status-error/10",
  info: "bg-status-info/10",
} as const

export type InteractionType = keyof typeof interactionStyles
export type StatusType = keyof typeof statusStyles
