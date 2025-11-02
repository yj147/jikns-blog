/**
 * 兼容现有测试的 Prisma Mock 实现
 * 为所有 Prisma 方法添加 mockResolvedValue/mockRejectedValue 支持
 */

import { vi } from "vitest"
import { mockPrisma, resetPrismaMocks } from "./prisma"

// 创建一个代理对象，为所有方法添加 Mock 功能
function createPrismaProxy() {
  return new Proxy(mockPrisma, {
    get(target: any, prop: string | symbol) {
      const value = target[prop]

      // 如果是模型操作 (user, post, comment)
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return new Proxy(value, {
          get(modelTarget: any, methodName: string | symbol) {
            const method = modelTarget[methodName]

            // 如果是函数，返回我们的 Mock 函数
            if (typeof method === "function") {
              return method
            }

            return method
          },
        })
      }

      return value
    },
  })
}

// 创建代理的 Prisma 客户端
const prismaMockProxy = createPrismaProxy()

// 模拟数据库错误（更新签名以匹配测试期望）
export function mockDatabaseError(error?: Error) {
  const errorToThrow = error || new Error("Mock database error")

  // 为所有用户操作方法设置错误
  Object.values(mockPrisma.user).forEach((method) => {
    if (vi.isMockFunction(method)) {
      method.mockRejectedValue(errorToThrow)
    }
  })
}

// 导出兼容的 prisma mock
export const prisma = prismaMockProxy
export { resetPrismaMocks }

// 默认导出
export default {
  prisma: prismaMockProxy,
  mockDatabaseError,
  resetPrismaMocks,
}
