/// <reference types="vitest" />

import "vitest"

declare module "vitest" {
  interface TestContext {
    // 测试上下文扩展
  }
}

// 增强 Prisma Mock 类型
declare global {
  namespace Vi {
    interface MockedFunction<T extends (...args: any[]) => any> {
      mockResolvedValue(value: Awaited<ReturnType<T>>): this
      mockRejectedValue(error?: any): this
    }
  }
}
