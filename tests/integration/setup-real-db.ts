/**
 * 真实数据库集成测试配置
 *
 * 此文件提供真实的 Prisma 客户端连接，用于验证数据库层面的约束和完整性。
 * 与单元测试的 mock Prisma 不同，这里从 @/lib/generated/prisma 导入真实客户端，绕过 Vitest 的全局 mock。
 */

import { randomUUID } from "node:crypto"
import { PrismaClient } from "@/lib/generated/prisma"
import type { Role, UserStatus } from "@/lib/generated/prisma"

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DB_URL
}

/**
 * 真实的 Prisma 客户端实例
 * 连接到测试数据库（通过 TEST_DATABASE_URL 环境变量配置）
 *
 * 注意：从 @/lib/generated/prisma 导入真实 Prisma 客户端，绕过 @/lib/prisma 的全局 mock
 */
export const realPrisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DB_URL,
    },
  },
  log: process.env.DEBUG_TESTS ? ["query", "error", "warn"] : ["error"],
})

/**
 * 清理所有测试数据
 * 按照外键依赖顺序删除，避免违反外键约束
 */
export async function cleanupTestData(): Promise<void> {
  await realPrisma.comments.deleteMany()
  await realPrisma.likes.deleteMany()
  await realPrisma.bookmarks.deleteMany()
  await realPrisma.follows.deleteMany()
  await realPrisma.activities.deleteMany()
  await realPrisma.posts.deleteMany()
  await realPrisma.system_settings.deleteMany()
  await realPrisma.users.deleteMany()
}

/**
 * 创建测试用户
 */
export async function createTestUser(data?: {
  id?: string
  email?: string
  name?: string
  role?: Role
  status?: UserStatus
}) {
  const email = data?.email || `test-${randomUUID()}@example.com`
  return realPrisma.users.create({
    data: {
      id: data?.id || randomUUID(),
      email,
      name: data?.name || "Test User",
      role: data?.role || "USER",
      status: data?.status || "ACTIVE",
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    },
  })
}

/**
 * 创建测试文章
 */
export async function createTestPost(data: {
  authorId: string
  title?: string
  slug?: string
  content?: string
}) {
  return realPrisma.posts.create({
    data: {
      id: randomUUID(),
      title: data.title || "Test Post",
      slug: data.slug || `test-post-${Date.now()}`,
      content: data.content || "Test content",
      excerpt: "Test excerpt",
      authorId: data.authorId,
      published: true,
      publishedAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

/**
 * 创建测试动态
 */
export async function createTestActivity(data: {
  authorId: string
  content?: string
  imageUrls?: string[]
}) {
  return realPrisma.activities.create({
    data: {
      id: randomUUID(),
      content: data.content || "Test activity",
      imageUrls: data.imageUrls || [],
      authorId: data.authorId,
      updatedAt: new Date(),
    },
  })
}

/**
 * 创建测试评论
 */
export async function createTestComment(data: {
  authorId: string
  content?: string
  postId?: string
  activityId?: string
  parentId?: string
}) {
  if (!data.postId && !data.activityId) {
    throw new Error("Comment must have either postId or activityId")
  }
  if (data.postId && data.activityId) {
    throw new Error("Comment cannot have both postId and activityId")
  }

  return realPrisma.comments.create({
    data: {
      id: randomUUID(),
      content: data.content || "Test comment",
      authorId: data.authorId,
      postId: data.postId,
      activityId: data.activityId,
      parentId: data.parentId,
      updatedAt: new Date(),
    },
  })
}

/**
 * 创建测试点赞
 */
export async function createTestLike(data: {
  authorId: string
  postId?: string
  activityId?: string
}) {
  if (!data.postId && !data.activityId) {
    throw new Error("Like must have either postId or activityId")
  }
  if (data.postId && data.activityId) {
    throw new Error("Like cannot have both postId and activityId")
  }

  return realPrisma.likes.create({
    data: {
      id: randomUUID(),
      authorId: data.authorId,
      postId: data.postId,
      activityId: data.activityId,
    },
  })
}

/**
 * 断开数据库连接
 */
export async function disconnectRealDb(): Promise<void> {
  await realPrisma.$disconnect()
}
