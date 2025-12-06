/**
 * 纯 Prisma 客户端，无 tokenizer 扩展
 * 用于 Edge Runtime（middleware）
 */
import { PrismaClient } from "./generated/prisma"

const globalForPrisma = globalThis as unknown as {
  prismaClient: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  })
}

export const prismaClient: PrismaClient =
  globalForPrisma.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = prismaClient
}

export default prismaClient
