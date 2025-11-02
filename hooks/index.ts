/**
 * Hooks 统一导出
 * Phase 5: 前端错误处理与用户体验优化
 */

// 现有的 hooks
export { toast } from "./use-toast"

// Phase 5 新增的 hooks
export { default as useErrorHandler } from "./use-error-handler"
export { default as useSecurityState } from "./use-security-state"
export { default as useRetry } from "./use-retry"

// Phase 5.1.3 新增的 hooks
export { useAutoSave } from "./use-auto-save"
export { useDebounce } from "./use-debounce"

// 类型定义
export type { UseErrorHandlerOptions, UseErrorHandlerReturn } from "./use-error-handler"

export type { UseSecurityStateOptions, UseSecurityStateReturn } from "./use-security-state"

export type { UseRetryOptions, UseRetryReturn } from "./use-retry"

export type { UseAutoSaveOptions, UseAutoSaveReturn } from "./use-auto-save"
