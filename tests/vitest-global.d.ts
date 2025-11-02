/**
 * Vitest 全局类型声明
 * 解决测试中的 Mock 类型问题
 */

import type { MockedFunction } from "vitest"

// 全局增强 vi.mocked 返回的类型
declare global {
  namespace Vi {
    function mocked<T>(item: T, deep?: boolean): MockedRecursively<T>
  }
}

// 递归 Mock 类型
type MockedRecursively<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? MockedFunction<T[K]> & {
        mockResolvedValue(value: Awaited<ReturnType<T[K]>>): MockedFunction<T[K]>
        mockRejectedValue(error?: any): MockedFunction<T[K]>
      }
    : T[K] extends object
      ? MockedRecursively<T[K]>
      : T[K]
}

export {}
