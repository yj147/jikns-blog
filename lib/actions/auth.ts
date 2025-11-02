"use server"

/**
 * 认证相关的 Server Actions
 * 为用户资料页提供带缓存标签的数据获取功能
 */

import { revalidateTag } from "next/cache"
import { getCurrentUser as getCurrentUserBase } from "@/lib/auth"
import type { User } from "../generated/prisma"

/**
 * 获取当前用户（Server Action 版本）
 * 不使用 cache() 避免渲染期间状态更新问题
 */
export async function getCurrentUser(): Promise<User | null> {
  // 直接调用基础的 getCurrentUser 函数
  const user = await getCurrentUserBase()
  return user
}

/**
 * 使用户资料缓存失效
 * 在用户资料更新后调用
 */
export async function revalidateUserProfile(): Promise<void> {
  revalidateTag("user:self")
}

/**
 * Server Action: 获取用户资料
 * 供客户端组件调用的包装函数
 */
export async function getUserProfile(): Promise<User | null> {
  return await getCurrentUser()
}
