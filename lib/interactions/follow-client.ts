import type { Key } from "swr"
import type { FollowActionResult, UnfollowActionResult } from "@/lib/interactions"

export interface FollowError {
  code: string
  message: string
  retryAfter?: number
}

export interface ToggleFollowSuccessPayload {
  success: true
  data: FollowActionResult | UnfollowActionResult
  message?: string
}

export interface ToggleFollowErrorPayload {
  success: false
  error: FollowError
}

export type ToggleFollowResponse = ToggleFollowSuccessPayload | ToggleFollowErrorPayload
export type ToggleFollowInvoker = (
  targetId: string,
  follow: boolean
) => Promise<ToggleFollowResponse>
export type ToggleFollowLoader = () => Promise<ToggleFollowInvoker>

// 直接注入的 invoker（用于测试），优先级最高
let directInvoker: ToggleFollowInvoker | null = null
let toggleLoader: ToggleFollowLoader | null = null

export const DEFAULT_FOLLOW_MUTATE_MATCHERS: Array<Key | ((key: Key) => boolean)> = [
  (key) => typeof key === "string" && key.startsWith("/api/users/suggested"),
  (key) => typeof key === "string" && key.startsWith("/api/activities"),
  (key) => Array.isArray(key) && key[0] === "follow-status",
]

const ERROR_PRESET: Record<string, FollowError> = {
  RATE_LIMIT_EXCEEDED: { code: "RATE_LIMIT_EXCEEDED", message: "操作过于频繁，请稍后再试" },
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "请先登录后再进行关注操作" },
  FORBIDDEN: { code: "FORBIDDEN", message: "没有权限执行此操作" },
  TARGET_NOT_FOUND: { code: "TARGET_NOT_FOUND", message: "用户不存在" },
  TARGET_INACTIVE: { code: "TARGET_INACTIVE", message: "无法关注该用户" },
  SELF_FOLLOW: { code: "SELF_FOLLOW", message: "不能关注自己" },
  LIMIT_EXCEEDED: { code: "LIMIT_EXCEEDED", message: "批量查询数量超出限制" },
}

export const setToggleFollowInvoker = (invoker: ToggleFollowInvoker | null) => {
  directInvoker = invoker
}

export const setToggleFollowLoader = (loader: ToggleFollowLoader | null) => {
  toggleLoader = loader
}

const ensureToggleFollowInvoker = async (): Promise<ToggleFollowInvoker> => {
  // 测试环境直接注入的 invoker 优先
  if (directInvoker) {
    return directInvoker
  }

  if (!toggleLoader) {
    throw new Error("toggle follow loader is not configured")
  }

  // loader 由调用方配置（生产为静态导入、测试可注入），确保 HMR 能替换 Server Action 引用
  return toggleLoader()
}

export const invokeToggleFollow = async (
  targetId: string,
  follow: boolean
): Promise<ToggleFollowResponse> => {
  const invoker = await ensureToggleFollowInvoker()
  return invoker(targetId, follow)
}

export const normaliseFollowing = (ids?: string[]) =>
  ids?.length ? Array.from(new Set(ids.filter(Boolean))) : []

export const applyFollowState = (ids: string[], userId: string, follow: boolean) => {
  const next = new Set(ids)
  follow ? next.add(userId) : next.delete(userId)
  return Array.from(next)
}

export const followSuccessMessage = (follow: boolean, fallback?: string) =>
  fallback ?? (follow ? "已关注该用户" : "已取消关注")

export const mapFollowServerError = (
  error: { code?: string; message?: string; retryAfter?: number },
  follow: boolean
): FollowError => {
  const preset = error.code ? ERROR_PRESET[error.code] : undefined
  if (preset) {
    return {
      ...preset,
      message: error.message || preset.message,
      retryAfter: error.retryAfter ?? preset.retryAfter,
    }
  }
  return {
    code: error.code || "UNKNOWN_ERROR",
    message: error.message || `${follow ? "关注" : "取消关注"}失败，请稍后重试`,
  }
}

export const mapFollowUnexpectedError = (_error: unknown, follow: boolean): FollowError => ({
  code: "UNKNOWN_ERROR",
  message: `${follow ? "关注" : "取消关注"}失败，请稍后再试`,
})
