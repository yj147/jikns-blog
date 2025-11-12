/**
 * 关注系统类型定义
 *
 * 集中管理关注功能相关的 TypeScript 类型，包括：
 * - Hook 配置选项
 * - 依赖注入接口
 * - 操作结果类型
 */

import type { Key } from "swr"
import type { FollowError, ToggleFollowResponse } from "@/lib/interactions/follow-client"

/**
 * SWR Mutate 函数类型
 * 支持两种调用方式：
 * 1. 传入具体 Key
 * 2. 传入匹配器函数
 */
export type MutateFn = {
  (key: Key, data?: any, opts?: { revalidate?: boolean }): Promise<any>
  (matcher: (key: Key) => boolean, data?: any, opts?: { revalidate?: boolean }): Promise<any>
}

/**
 * Toast 通知 API
 */
export type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
}

/**
 * 关注切换函数类型
 * @param userId - 目标用户 ID
 * @param follow - true 表示关注，false 表示取消关注
 * @returns 操作结果
 */
export type ToggleFn = (userId: string, follow: boolean) => Promise<ToggleFollowResponse>

/**
 * 日志记录器接口
 */
export interface LoggerLike {
  warn: (message: string, context?: Record<string, any>) => void
  error: (message: string, context?: Record<string, any>) => void
}

/**
 * useFollowUser Hook 配置选项
 */
export interface UseFollowUserOptions {
  /**
   * 需要刷新的额外缓存 Key 列表
   * 在关注操作成功后，这些 Key 对应的缓存会被重新验证
   */
  mutateCacheKeys?: Key[]

  /**
   * 自定义缓存匹配器列表
   * 匹配器函数返回 true 的 Key 会被刷新
   */
  mutateMatchers?: ((key: Key) => boolean)[]

  /**
   * 是否启用乐观更新
   * @default true
   */
  optimistic?: boolean

  /**
   * 是否显示 Toast 提示
   * @default true
   */
  showToast?: boolean

  /**
   * 初始关注用户 ID 列表
   * 用于初始化 Hook 的关注状态
   */
  initialFollowing?: string[]
}

/**
 * Follow Hook 依赖注入接口
 * 用于创建 useFollowUser Hook 的工厂函数
 */
export interface FollowHookDeps {
  /**
   * 关注切换函数（调用 API 或 Server Action）
   */
  toggle: ToggleFn

  /**
   * SWR Mutate 函数（用于缓存刷新）
   */
  mutate: MutateFn

  /**
   * Toast 通知 API
   */
  toast: ToastApi

  /**
   * 日志记录器
   */
  logger: LoggerLike
}

/**
 * 关注操作结果
 */
export interface FollowActionResult {
  /**
   * 操作是否成功
   */
  success: boolean

  /**
   * 失败时的错误信息
   */
  error?: FollowError
}
