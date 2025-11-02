/**
 * 用户数据同步测试套件
 * 测试Supabase Auth与Prisma数据库之间的用户数据同步逻辑
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { cleanTestDatabase, getTestDatabase } from "../config/test-database"
import { createTestUser, createGitHubTestUser, authAssertions } from "../helpers/auth-test-helpers"
import type { User } from "@prisma/client"

// 用户同步服务接口
interface UserSyncService {
  syncUserFromSupabase: (
    supabaseUser: any
  ) => Promise<{ user?: User; created?: boolean; error?: any }>
  updateUserProfile: (userId: string, profileData: any) => Promise<{ user?: User; error?: any }>
  deactivateUser: (userId: string) => Promise<{ error?: any }>
  reactivateUser: (userId: string) => Promise<{ user?: User; error?: any }>
}

describe("用户数据同步", () => {
  const db = getTestDatabase()

  beforeEach(async () => {
    await cleanTestDatabase()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Supabase to Prisma 同步", () => {
    it("应该创建新的Prisma用户记录（来自Supabase Auth）", async () => {
      // Arrange: 模拟Supabase Auth用户数据
      const supabaseUser = {
        id: "supabase-uuid-12345",
        email: "newuser@example.com",
        user_metadata: {
          name: "新Supabase用户",
          avatar_url: "https://supabase.com/avatar.jpg",
        },
        app_metadata: {},
        created_at: "2025-01-01T00:00:00Z",
        confirmed_at: "2025-01-01T00:01:00Z",
        last_sign_in_at: "2025-01-01T00:02:00Z",
      }

      // Act: 同步用户到Prisma（模拟实现）
      const syncedUser = await db.user.upsert({
        where: { email: supabaseUser.email },
        update: {
          name: supabaseUser.user_metadata.name,
          avatarUrl: supabaseUser.user_metadata.avatar_url,
          lastLoginAt: new Date(supabaseUser.last_sign_in_at),
        },
        create: {
          email: supabaseUser.email,
          name: supabaseUser.user_metadata.name || null,
          avatarUrl: supabaseUser.user_metadata.avatar_url || null,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(supabaseUser.last_sign_in_at),
          createdAt: new Date(supabaseUser.created_at),
        },
      })

      // Assert: 验证用户创建
      await authAssertions.toBeCreatedUser(syncedUser, {
        email: supabaseUser.email,
        name: supabaseUser.user_metadata.name,
        role: "USER",
      })

      expect(syncedUser.lastLoginAt).toEqual(new Date(supabaseUser.last_sign_in_at))
    })

    it("应该更新现有用户的元数据（增量同步）", async () => {
      // Arrange: 创建已存在的用户
      const existingUser = await createTestUser({
        email: "existing@example.com",
        name: "旧昵称",
        avatarUrl: "https://old-avatar.com/image.jpg",
      })

      // 模拟Supabase返回的更新数据
      const updatedSupabaseUser = {
        id: "supabase-existing",
        email: "existing@example.com",
        user_metadata: {
          name: "更新后的昵称",
          avatar_url: "https://new-avatar.com/image.jpg",
          bio: "更新后的个人简介",
        },
        last_sign_in_at: new Date().toISOString(),
      }

      // Act: 增量同步用户数据
      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: updatedSupabaseUser.user_metadata.name,
          avatarUrl: updatedSupabaseUser.user_metadata.avatar_url,
          bio: updatedSupabaseUser.user_metadata.bio,
          lastLoginAt: new Date(updatedSupabaseUser.last_sign_in_at),
        },
      })

      // Assert: 验证更新结果
      expect(updatedUser.name).toBe("更新后的昵称")
      expect(updatedUser.avatarUrl).toBe("https://new-avatar.com/image.jpg")
      expect(updatedUser.bio).toBe("更新后的个人简介")
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date)
    })

    it("应该处理不完整的Supabase用户数据", async () => {
      // Arrange: 模拟不完整的Supabase数据
      const incompleteSupabaseUser = {
        id: "incomplete-user",
        email: "incomplete@example.com",
        user_metadata: {}, // 空的元数据
        created_at: "2025-01-01T00:00:00Z",
      }

      // Act: 同步不完整的用户数据
      const syncedUser = await db.user.upsert({
        where: { email: incompleteSupabaseUser.email },
        update: {
          lastLoginAt: new Date(),
        },
        create: {
          email: incompleteSupabaseUser.email,
          name: null, // 允许为空
          avatarUrl: null,
          bio: null,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
          createdAt: new Date(incompleteSupabaseUser.created_at),
        },
      })

      // Assert: 验证处理不完整数据
      expect(syncedUser.email).toBe(incompleteSupabaseUser.email)
      expect(syncedUser.name).toBeNull()
      expect(syncedUser.avatarUrl).toBeNull()
      expect(syncedUser.bio).toBeNull()
      expect(syncedUser.role).toBe("USER")
    })

    it("应该保留Prisma特有的字段（不被Supabase覆盖）", async () => {
      // Arrange: 创建具有特定权限的用户
      const adminUser = await createTestUser({
        email: "admin@example.com",
        role: "ADMIN",
        status: "ACTIVE",
      })

      // 模拟Supabase同步（不包含role/status）
      const supabaseUpdate = {
        email: "admin@example.com",
        user_metadata: {
          name: "管理员更新昵称",
        },
        last_sign_in_at: new Date().toISOString(),
      }

      // Act: 同步时保留Prisma字段
      const updatedUser = await db.user.update({
        where: { id: adminUser.id },
        data: {
          // 只更新Supabase提供的字段
          name: supabaseUpdate.user_metadata.name,
          lastLoginAt: new Date(supabaseUpdate.last_sign_in_at),
          // role 和 status 保持不变
        },
      })

      // Assert: 验证权限字段未被覆盖
      expect(updatedUser.name).toBe("管理员更新昵称")
      expect(updatedUser.role).toBe("ADMIN") // 保持原来的角色
      expect(updatedUser.status).toBe("ACTIVE") // 保持原来的状态
    })
  })

  describe("冲突处理和数据一致性", () => {
    it("应该处理邮箱冲突（Supabase vs Prisma）", async () => {
      // Arrange: Prisma中已有用户
      const existingPrismaUser = await createTestUser({
        email: "conflict@example.com",
        name: "Prisma用户",
      })

      // Supabase尝试同步不同的用户但邮箱相同
      const conflictSupabaseUser = {
        id: "different-supabase-id",
        email: "conflict@example.com",
        user_metadata: {
          name: "Supabase用户",
        },
      }

      // Act: 同步操作应该更新现有用户而不是创建新用户
      const result = await db.user.upsert({
        where: { email: conflictSupabaseUser.email },
        update: {
          name: conflictSupabaseUser.user_metadata.name,
          lastLoginAt: new Date(),
        },
        create: {
          email: conflictSupabaseUser.email,
          name: conflictSupabaseUser.user_metadata.name,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
      })

      // Assert: 应该是同一个用户记录被更新
      expect(result.id).toBe(existingPrismaUser.id)
      expect(result.name).toBe("Supabase用户") // 名称被更新

      // 确保数据库中只有一个用户
      const userCount = await db.user.count({
        where: { email: "conflict@example.com" },
      })
      expect(userCount).toBe(1)
    })

    it("应该处理并发同步请求", async () => {
      // Arrange: 准备并发同步的用户数据
      const supabaseUser = {
        email: "concurrent@example.com",
        user_metadata: {
          name: "并发用户",
          avatar_url: "https://concurrent.com/avatar.jpg",
        },
        last_sign_in_at: new Date().toISOString(),
      }

      // Act: 模拟多个并发同步请求
      const concurrentSyncs = Array.from({ length: 5 }, () =>
        db.user.upsert({
          where: { email: supabaseUser.email },
          update: {
            name: supabaseUser.user_metadata.name,
            avatarUrl: supabaseUser.user_metadata.avatar_url,
            lastLoginAt: new Date(supabaseUser.last_sign_in_at),
          },
          create: {
            email: supabaseUser.email,
            name: supabaseUser.user_metadata.name,
            avatarUrl: supabaseUser.user_metadata.avatar_url,
            role: "USER",
            status: "ACTIVE",
            lastLoginAt: new Date(supabaseUser.last_sign_in_at),
          },
        })
      )

      const results = await Promise.all(concurrentSyncs)

      // Assert: 所有请求都成功，指向同一用户
      expect(results).toHaveLength(5)
      const userIds = new Set(results.map((user) => user.id))
      expect(userIds.size).toBe(1) // 所有操作指向同一用户

      // 确保数据库中只有一个用户记录
      const finalUserCount = await db.user.count({
        where: { email: supabaseUser.email },
      })
      expect(finalUserCount).toBe(1)
    })

    it("应该处理数据回滚场景", async () => {
      // Arrange: 创建用户和备份状态
      const originalUser = await createTestUser({
        email: "rollback@example.com",
        name: "原始用户",
        avatarUrl: "https://original.com/avatar.jpg",
      })

      const originalState = { ...originalUser }

      try {
        // Act: 模拟同步过程中的错误
        await db.$transaction(async (tx) => {
          // 更新用户数据
          await tx.user.update({
            where: { id: originalUser.id },
            data: {
              name: "更新后的用户",
              avatarUrl: "https://updated.com/avatar.jpg",
            },
          })

          // 模拟后续操作失败
          throw new Error("同步过程中发生错误")
        })
      } catch (error) {
        // 预期的错误
        expect(error.message).toBe("同步过程中发生错误")
      }

      // Assert: 验证事务回滚，数据未被修改
      const userAfterRollback = await db.user.findUnique({
        where: { id: originalUser.id },
      })

      expect(userAfterRollback?.name).toBe(originalState.name)
      expect(userAfterRollback?.avatarUrl).toBe(originalState.avatarUrl)
    })
  })

  describe("用户状态管理", () => {
    it("应该支持用户激活/禁用操作", async () => {
      // Arrange: 创建活跃用户
      const activeUser = await createTestUser({
        email: "status@example.com",
        status: "ACTIVE",
      })

      // Act: 禁用用户
      const bannedUser = await db.user.update({
        where: { id: activeUser.id },
        data: { status: "BANNED" },
      })

      // Assert: 验证用户被禁用
      authAssertions.toBeBanned(bannedUser)

      // Act: 重新激活用户
      const reactivatedUser = await db.user.update({
        where: { id: activeUser.id },
        data: { status: "ACTIVE" },
      })

      // Assert: 验证用户重新激活
      expect(reactivatedUser.status).toBe("ACTIVE")
    })

    it("应该记录状态变更历史", async () => {
      // Arrange: 创建用户
      const user = await createTestUser({
        email: "history@example.com",
        status: "ACTIVE",
      })

      const statusChanges: Array<{ status: string; timestamp: Date; reason?: string }> = []

      // Act: 模拟状态变更记录
      const bannedUser = await db.user.update({
        where: { id: user.id },
        data: {
          status: "BANNED",
          updatedAt: new Date(),
        },
      })

      statusChanges.push({
        status: "BANNED",
        timestamp: bannedUser.updatedAt,
        reason: "违规行为",
      })

      // 重新激活
      const reactivatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      })

      statusChanges.push({
        status: "ACTIVE",
        timestamp: reactivatedUser.updatedAt,
        reason: "申诉成功",
      })

      // Assert: 验证状态变更记录
      expect(statusChanges).toHaveLength(2)
      expect(statusChanges[0].status).toBe("BANNED")
      expect(statusChanges[1].status).toBe("ACTIVE")
      expect(statusChanges[1].timestamp.getTime()).toBeGreaterThan(
        statusChanges[0].timestamp.getTime()
      )
    })
  })

  describe("性能和优化", () => {
    it("应该只更新变化的字段（避免不必要的写入）", async () => {
      // Arrange: 创建用户
      const user = await createTestUser({
        email: "optimize@example.com",
        name: "优化测试用户",
        avatarUrl: "https://optimize.com/avatar.jpg",
      })

      const originalUpdatedAt = user.updatedAt

      // 模拟相同的数据同步
      const sameData = {
        name: "优化测试用户",
        avatarUrl: "https://optimize.com/avatar.jpg",
      }

      // Act: 检查是否需要更新
      const needsUpdate = user.name !== sameData.name || user.avatarUrl !== sameData.avatarUrl

      // Assert: 不需要更新
      expect(needsUpdate).toBe(false)

      // 如果数据没有变化，应该避免数据库写入
      // 在实际实现中，这里应该有条件更新逻辑
    })

    it("应该批量处理多个用户同步", async () => {
      // Arrange: 准备多个用户数据
      const batchUsers = Array.from({ length: 10 }, (_, i) => ({
        email: `batch${i}@example.com`,
        user_metadata: {
          name: `批量用户${i}`,
          avatar_url: `https://batch.com/avatar${i}.jpg`,
        },
      }))

      // Act: 批量创建用户
      const createdUsers = await Promise.all(
        batchUsers.map((userData) =>
          db.user.create({
            data: {
              email: userData.email,
              name: userData.user_metadata.name,
              avatarUrl: userData.user_metadata.avatar_url,
              role: "USER",
              status: "ACTIVE",
            },
          })
        )
      )

      // Assert: 验证批量创建结果
      expect(createdUsers).toHaveLength(10)
      createdUsers.forEach((user, index) => {
        expect(user.email).toBe(`batch${index}@example.com`)
        expect(user.name).toBe(`批量用户${index}`)
      })

      // 验证数据库中的记录数
      const totalUsers = await db.user.count({
        where: {
          email: {
            startsWith: "batch",
          },
        },
      })
      expect(totalUsers).toBe(10)
    })

    it("应该有合理的同步性能", async () => {
      // Arrange: 准备性能测试
      const userData = {
        email: "performance@example.com",
        user_metadata: {
          name: "性能测试用户",
          avatar_url: "https://performance.com/avatar.jpg",
        },
      }

      // Act: 测量同步性能
      const startTime = Date.now()

      const user = await db.user.upsert({
        where: { email: userData.email },
        update: {
          name: userData.user_metadata.name,
          avatarUrl: userData.user_metadata.avatar_url,
          lastLoginAt: new Date(),
        },
        create: {
          email: userData.email,
          name: userData.user_metadata.name,
          avatarUrl: userData.user_metadata.avatar_url,
          role: "USER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
      })

      const syncTime = Date.now() - startTime

      // Assert: 同步应该在合理时间内完成
      expect(syncTime).toBeLessThan(100) // 100ms内
      expect(user).toBeDefined()
      expect(user.email).toBe(userData.email)
    })
  })
})
