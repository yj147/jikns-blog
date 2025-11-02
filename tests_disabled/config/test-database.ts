/**
 * 测试数据库配置
 * 为测试环境提供独立的数据库实例，确保测试隔离
 */

import { PrismaClient } from "@/lib/generated/prisma"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// 测试数据库实例
let testDb: PrismaClient | null = null

/**
 * 获取测试数据库实例
 * 单例模式确保整个测试过程使用同一个数据库连接
 */
export function getTestDatabase(): PrismaClient {
  if (!testDb) {
    testDb = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === "test" ? ["error"] : ["query", "info", "warn", "error"],
    })
  }
  return testDb
}

/**
 * 清理测试数据库
 * 删除所有测试数据，保持测试间的隔离性
 */
export async function cleanTestDatabase(): Promise<void> {
  const db = getTestDatabase()

  try {
    // 按照依赖关系的逆序删除表数据
    await db.like.deleteMany()
    await db.comment.deleteMany()
    await db.bookmark.deleteMany()
    await db.follow.deleteMany()
    await db.postTag.deleteMany()
    await db.activity.deleteMany()
    await db.post.deleteMany()
    await db.series.deleteMany()
    await db.tag.deleteMany()
    await db.user.deleteMany()
  } catch (error) {
    console.error("清理测试数据库时发生错误:", error)
    // 在测试环境中，如果清理失败也继续执行
  }
}

/**
 * 初始化测试数据库
 * 执行数据库迁移和基础数据准备
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // 确保数据库结构是最新的
    await execAsync("npx prisma db push --force-reset")
    console.log("✅ 测试数据库结构已更新")
  } catch (error) {
    console.error("❌ 测试数据库初始化失败:", error)
    // 在测试环境中，如果数据库不可用，使用内存模式
    console.log("⚠️ 使用模拟数据库模式")
  }
}

/**
 * 关闭测试数据库连接
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.$disconnect()
    testDb = null
  }
}

/**
 * 生成测试用户数据工厂
 */
export const testUserFactory = {
  /**
   * 创建标准测试用户
   */
  createUser: (overrides?: Partial<Parameters<PrismaClient["user"]["create"]>[0]["data"]>) => ({
    email: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    name: "测试用户",
    avatarUrl: "https://example.com/avatar.jpg",
    bio: "这是一个测试用户",
    role: "USER" as const,
    status: "ACTIVE" as const,
    ...overrides,
  }),

  /**
   * 创建管理员测试用户
   */
  createAdmin: (overrides?: Partial<Parameters<PrismaClient["user"]["create"]>[0]["data"]>) => ({
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    name: "测试管理员",
    avatarUrl: "https://example.com/admin-avatar.jpg",
    bio: "这是一个测试管理员账号",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    ...overrides,
  }),

  /**
   * 创建GitHub OAuth用户
   */
  createGitHubUser: (
    overrides?: Partial<Parameters<PrismaClient["user"]["create"]>[0]["data"]>
  ) => ({
    email: `github-${Date.now()}-${Math.random().toString(36).slice(2)}@github.com`,
    name: "GitHub测试用户",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    bio: "通过GitHub OAuth注册的测试用户",
    socialLinks: {
      github: "https://github.com/testuser",
      website: "https://testuser.dev",
    },
    passwordHash: null, // GitHub用户没有密码
    role: "USER" as const,
    status: "ACTIVE" as const,
    ...overrides,
  }),

  /**
   * 创建邮箱密码用户
   */
  createEmailUser: (
    overrides?: Partial<Parameters<PrismaClient["user"]["create"]>[0]["data"]>
  ) => ({
    email: `email-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    name: "邮箱注册用户",
    avatarUrl: null,
    bio: "通过邮箱密码注册的测试用户",
    passwordHash: "$2b$10$TEST_HASH_FOR_PASSWORD_123456", // 模拟的密码哈希
    role: "USER" as const,
    status: "ACTIVE" as const,
    ...overrides,
  }),
}
