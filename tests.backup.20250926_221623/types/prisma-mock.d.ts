/**
 * Prisma Mock 类型声明
 * 为测试环境提供 Mock 方法的类型支持
 */

import type { PrismaClient } from "@/lib/generated/prisma"
import type { MockedFunction } from "vitest"

declare module "@/lib/prisma" {
  interface PrismaMock {
    user: {
      findUnique: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      findMany: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      create: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      update: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      delete: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      count: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      upsert: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
    }
    post: {
      findUnique: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      findMany: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      create: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      update: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      delete: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
    }
    comment: {
      findMany: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      create: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
      delete: MockedFunction<any> & {
        mockResolvedValue: (value: any) => MockedFunction<any>
        mockRejectedValue: (error?: any) => MockedFunction<any>
      }
    }
    $transaction: MockedFunction<any>
    $connect: MockedFunction<any>
    $disconnect: MockedFunction<any>
    $queryRaw: MockedFunction<any>
    $executeRaw: MockedFunction<any>
  }
}
