/**
 * Prisma 客户端配置
 * 确保全局单例，避免开发环境中的连接池耗尽
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

// 优雅关闭数据库连接
process.on("beforeExit", async () => {
  await prisma.$disconnect()
})

export default prisma
