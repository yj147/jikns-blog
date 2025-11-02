/**
 * 用户数据同步集成测试套件
 *
 * 测试覆盖：
 * - 首次登录用户创建
 * - 已有用户数据更新
 * - 数据同步一致性检查
 * - 并发同步处理
 * - 数据冲突解决
 * - 同步失败恢复机制
 *
 * Phase 2 范围：专注于 Supabase Auth 与应用数据库的同步逻辑
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { cleanTestDatabase, getTestDatabase } from "../config/test-database"
import { resetSupabaseMocks } from "../config/test-supabase"
import {
  createEmailTestUser,
  createGitHubTestUser,
  authAssertions,
} from "../helpers/auth-test-helpers"
import {
  syncUserToDatabase,
  getUserWithStats,
  checkUserPermissions,
  getBatchUserInfo,
} from "@/lib/supabase"
import type { SupabaseUser } from "@/lib/supabase"

describe("用户数据同步集成测试", () => {
  const db = getTestDatabase()

  beforeEach(async () => {
    await cleanTestDatabase()
    resetSupabaseMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe("首次登录用户创建", () => {
    it("应该为GitHub OAuth用户创建完整的数据库记录", async () => {
      // Arrange: 模拟GitHub用户数据
      const githubUserData: SupabaseUser = {
        id: "github_12345",
        email: "github-new@example.com",
        user_metadata: {
          full_name: "GitHub新用户",
          avatar_url: "https://avatars.githubusercontent.com/u/12345",
          user_name: "github-new-user",
        },
        app_metadata: {
          provider: "github",
          providers: ["github"],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步GitHub用户
      const syncResult = await syncUserToDatabase(githubUserData)

      // Assert: 验证用户创建结果
      expect(syncResult.isNewUser).toBe(true)
      expect(syncResult.user.id).toBe(githubUserData.id)
      expect(syncResult.user.email).toBe(githubUserData.email)
      expect(syncResult.user.name).toBe("GitHub新用户")
      expect(syncResult.user.avatarUrl).toBe("https://avatars.githubusercontent.com/u/12345")
      expect(syncResult.user.passwordHash).toBeNull()
      expect(syncResult.user.role).toBe("USER")
      expect(syncResult.user.status).toBe("ACTIVE")
      expect(syncResult.user.lastLoginAt).toBeInstanceOf(Date)

      // 验证同步字段记录
      expect(syncResult.syncedFields).toContain("id")
      expect(syncResult.syncedFields).toContain("email")
      expect(syncResult.syncedFields).toContain("name")
      expect(syncResult.syncedFields).toContain("avatarUrl")
      expect(syncResult.syncedFields).toContain("lastLoginAt")

      // 验证数据库中的记录
      const dbUser = await db.user.findUnique({
        where: { id: githubUserData.id },
      })

      authAssertions.toBeGitHubUser(dbUser!)
      expect(dbUser!.createdAt).toBeInstanceOf(Date)
      expect(dbUser!.updatedAt).toBeInstanceOf(Date)
    })

    it("应该为邮箱用户创建基础数据库记录", async () => {
      // Arrange: 模拟邮箱用户数据
      const emailUserData: SupabaseUser = {
        id: "email_67890",
        email: "email-new@example.com",
        user_metadata: {
          name: "邮箱新用户",
        },
        app_metadata: {
          provider: "email",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步邮箱用户
      const syncResult = await syncUserToDatabase(emailUserData)

      // Assert: 验证用户创建结果
      expect(syncResult.isNewUser).toBe(true)
      expect(syncResult.user.id).toBe(emailUserData.id)
      expect(syncResult.user.email).toBe(emailUserData.email)
      expect(syncResult.user.name).toBe("邮箱新用户")
      expect(syncResult.user.avatarUrl).toBeNull()
      expect(syncResult.user.role).toBe("USER")
      expect(syncResult.user.status).toBe("ACTIVE")

      // 验证数据库记录
      const dbUser = await db.user.findUnique({
        where: { id: emailUserData.id },
      })

      expect(dbUser!.passwordHash).toBeNull() // 由Supabase管理
    })

    it("应该处理用户元数据缺失的情况", async () => {
      // Arrange: 模拟缺少元数据的用户
      const minimalUserData: SupabaseUser = {
        id: "minimal_user",
        email: "minimal@example.com",
        user_metadata: {}, // 空元数据
        app_metadata: {
          provider: "github",
        },
        created_at: new Date().toISOString(),
      }

      // Act: 同步缺少元数据的用户
      const syncResult = await syncUserToDatabase(minimalUserData)

      // Assert: 验证默认值处理
      expect(syncResult.isNewUser).toBe(true)
      expect(syncResult.user.email).toBe("minimal@example.com")
      expect(syncResult.user.name).toBe("minimal") // 从邮箱提取
      expect(syncResult.user.avatarUrl).toBeNull()
      expect(syncResult.user.role).toBe("USER")
      expect(syncResult.user.status).toBe("ACTIVE")
    })

    it("应该正确生成用户显示名称的后备方案", async () => {
      // Arrange: 测试不同的元数据组合
      const testCases = [
        {
          userData: {
            id: "user_1",
            email: "user1@example.com",
            user_metadata: { full_name: "Full Name User" },
            app_metadata: { provider: "github" },
            created_at: new Date().toISOString(),
          },
          expectedName: "Full Name User",
        },
        {
          userData: {
            id: "user_2",
            email: "user2@example.com",
            user_metadata: { user_name: "username2" },
            app_metadata: { provider: "github" },
            created_at: new Date().toISOString(),
          },
          expectedName: "username2",
        },
        {
          userData: {
            id: "user_3",
            email: "user3@example.com",
            user_metadata: { name: "Simple Name" },
            app_metadata: { provider: "github" },
            created_at: new Date().toISOString(),
          },
          expectedName: "Simple Name",
        },
        {
          userData: {
            id: "user_4",
            email: "fallback@example.com",
            user_metadata: {},
            app_metadata: { provider: "github" },
            created_at: new Date().toISOString(),
          },
          expectedName: "fallback", // 从邮箱提取
        },
      ]

      // Act & Assert: 测试每个情况
      for (const testCase of testCases) {
        await cleanTestDatabase() // 清理数据库

        const syncResult = await syncUserToDatabase(testCase.userData as SupabaseUser)
        expect(syncResult.user.name).toBe(testCase.expectedName)
      }
    })
  })

  describe("已有用户数据更新", () => {
    it("应该正确更新GitHub用户的变化信息", async () => {
      // Arrange: 创建已存在的GitHub用户
      const existingUser = await createGitHubTestUser({
        id: "github_existing",
        email: "existing@github.com",
        name: "旧昵称",
        avatarUrl: "https://old-avatar.com/avatar.jpg",
        lastLoginAt: new Date("2024-01-01"),
      })

      // 模拟GitHub返回的更新数据
      const updatedGitHubData: SupabaseUser = {
        id: "github_existing",
        email: "existing@github.com",
        user_metadata: {
          full_name: "新昵称",
          avatar_url: "https://new-avatar.com/avatar.jpg",
          user_name: "updated_username",
        },
        app_metadata: {
          provider: "github",
        },
        created_at: existingUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步更新的用户数据
      const syncResult = await syncUserToDatabase(updatedGitHubData)

      // Assert: 验证用户更新结果
      expect(syncResult.isNewUser).toBe(false)
      expect(syncResult.user.id).toBe(existingUser.id)
      expect(syncResult.user.name).toBe("新昵称")
      expect(syncResult.user.avatarUrl).toBe("https://new-avatar.com/avatar.jpg")
      expect(syncResult.user.lastLoginAt!.getTime()).toBeGreaterThan(
        existingUser.lastLoginAt!.getTime()
      )

      // 验证同步的字段
      expect(syncResult.syncedFields).toContain("name")
      expect(syncResult.syncedFields).toContain("avatarUrl")
      expect(syncResult.syncedFields).toContain("lastLoginAt")
      expect(syncResult.syncedFields).not.toContain("email") // 邮箱未变化
    })

    it("应该检测并更新用户邮箱变更", async () => {
      // Arrange: 创建用户
      const existingUser = await createGitHubTestUser({
        id: "github_email_change",
        email: "old-email@github.com",
        name: "用户名",
      })

      // 模拟用户在GitHub上更改了邮箱
      const updatedUserData: SupabaseUser = {
        id: "github_email_change",
        email: "new-email@github.com", // 新邮箱
        user_metadata: {
          full_name: "用户名",
        },
        app_metadata: {
          provider: "github",
        },
        created_at: existingUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步邮箱变更
      const syncResult = await syncUserToDatabase(updatedUserData)

      // Assert: 验证邮箱更新
      expect(syncResult.isNewUser).toBe(false)
      expect(syncResult.user.email).toBe("new-email@github.com")
      expect(syncResult.syncedFields).toContain("email")
      expect(syncResult.syncedFields).toContain("lastLoginAt")

      // 验证数据库中的邮箱已更新
      const updatedDbUser = await db.user.findUnique({
        where: { id: existingUser.id },
      })
      expect(updatedDbUser!.email).toBe("new-email@github.com")
    })

    it("应该只在数据实际变化时更新字段", async () => {
      // Arrange: 创建用户
      const existingUser = await createGitHubTestUser({
        id: "github_no_change",
        email: "nochange@github.com",
        name: "不变的昵称",
        avatarUrl: "https://nochange.com/avatar.jpg",
      })

      const originalUpdatedAt = existingUser.updatedAt

      // 模拟相同的用户数据（无实际变化）
      const sameUserData: SupabaseUser = {
        id: "github_no_change",
        email: "nochange@github.com",
        user_metadata: {
          full_name: "不变的昵称",
          avatar_url: "https://nochange.com/avatar.jpg",
        },
        app_metadata: {
          provider: "github",
        },
        created_at: existingUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步无变化的数据
      const syncResult = await syncUserToDatabase(sameUserData)

      // Assert: 验证只更新了登录时间
      expect(syncResult.isNewUser).toBe(false)
      expect(syncResult.user.name).toBe(existingUser.name)
      expect(syncResult.user.avatarUrl).toBe(existingUser.avatarUrl)
      expect(syncResult.user.email).toBe(existingUser.email)

      // 只有登录时间被更新
      expect(syncResult.syncedFields).toEqual(["lastLoginAt"])
      expect(syncResult.user.lastLoginAt).toBeInstanceOf(Date)
      expect(syncResult.user.lastLoginAt!.getTime()).toBeGreaterThan(
        existingUser.lastLoginAt?.getTime() || 0
      )
    })

    it("应该保持用户角色和状态不被同步覆盖", async () => {
      // Arrange: 创建管理员用户
      const adminUser = await createGitHubTestUser({
        id: "github_admin",
        email: "admin@github.com",
        name: "管理员",
        role: "ADMIN",
        status: "ACTIVE",
      })

      // 模拟同步数据（不包含角色信息）
      const syncData: SupabaseUser = {
        id: "github_admin",
        email: "admin@github.com",
        user_metadata: {
          full_name: "管理员用户", // 更新昵称
        },
        app_metadata: {
          provider: "github",
        },
        created_at: adminUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步数据
      const syncResult = await syncUserToDatabase(syncData)

      // Assert: 验证角色和状态保持不变
      expect(syncResult.user.role).toBe("ADMIN") // 保持管理员角色
      expect(syncResult.user.status).toBe("ACTIVE") // 保持活跃状态
      expect(syncResult.user.name).toBe("管理员用户") // 昵称被更新
      expect(syncResult.syncedFields).toContain("name")
      expect(syncResult.syncedFields).not.toContain("role")
      expect(syncResult.syncedFields).not.toContain("status")
    })
  })

  describe("数据同步一致性检查", () => {
    it("应该验证同步后的数据完整性", async () => {
      // Arrange: 创建GitHub用户数据
      const githubData: SupabaseUser = {
        id: "integrity_test",
        email: "integrity@github.com",
        user_metadata: {
          full_name: "完整性测试用户",
          avatar_url: "https://github.com/integrity.jpg",
        },
        app_metadata: {
          provider: "github",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步用户
      const syncResult = await syncUserToDatabase(githubData)

      // 从数据库重新获取用户进行验证
      const dbUser = await db.user.findUnique({
        where: { id: githubData.id },
      })

      const userWithStats = await getUserWithStats(githubData.id)
      const userPermissions = await checkUserPermissions(githubData.id)

      // Assert: 验证数据一致性
      expect(dbUser).toBeDefined()
      expect(dbUser!.id).toBe(syncResult.user.id)
      expect(dbUser!.email).toBe(syncResult.user.email)
      expect(dbUser!.name).toBe(syncResult.user.name)

      // 验证统计信息
      expect(userWithStats).toBeDefined()
      expect(userWithStats!.stats.publishedPosts).toBe(0)
      expect(userWithStats!.stats.activities).toBe(0)
      expect(userWithStats!.stats.followers).toBe(0)

      // 验证权限信息
      expect(userPermissions.isAdmin).toBe(false)
      expect(userPermissions.canInteract).toBe(true)
      expect(userPermissions.isActive).toBe(true)
    })

    it("应该检测并修复数据不一致问题", async () => {
      // Arrange: 创建用户并人为制造不一致
      const user = await createEmailTestUser("TestPassword123!")

      // 人为修改数据库中的邮箱，但不更新其他相关数据
      await db.user.update({
        where: { id: user.user.id },
        data: { email: "modified@database.com" },
      })

      // 模拟Supabase返回的原始数据
      const supabaseUserData: SupabaseUser = {
        id: user.user.id,
        email: user.user.email, // 原始邮箱
        user_metadata: {
          name: user.user.name,
        },
        app_metadata: {
          provider: "email",
        },
        created_at: user.user.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步应该修复不一致
      const syncResult = await syncUserToDatabase(supabaseUserData)

      // Assert: 验证不一致被修复
      expect(syncResult.user.email).toBe(user.user.email) // 恢复原始邮箱
      expect(syncResult.syncedFields).toContain("email")

      // 验证数据库中的数据已修复
      const correctedUser = await db.user.findUnique({
        where: { id: user.user.id },
      })
      expect(correctedUser!.email).toBe(user.user.email)
    })

    it("应该验证关联数据的引用完整性", async () => {
      // Arrange: 创建用户并添加一些关联数据
      const { user } = await createEmailTestUser("TestPassword123!")

      // 创建一些测试数据来验证关联关系
      const testActivity = await db.activity.create({
        data: {
          content: "测试动态",
          authorId: user.id,
        },
      })

      const testComment = await db.comment.create({
        data: {
          content: "测试评论",
          authorId: user.id,
          activityId: testActivity.id,
        },
      })

      // Act: 获取用户统计信息
      const userStats = await getUserWithStats(user.id)

      // Assert: 验证关联数据正确计算
      expect(userStats).toBeDefined()
      expect(userStats!.stats.activities).toBe(1)
      expect(userStats!.stats.comments).toBe(1)
      expect(userStats!.activities).toHaveLength(1)
      expect(userStats!.comments).toHaveLength(1)

      // 验证关联数据的ID匹配
      expect(userStats!.activities[0].id).toBe(testActivity.id)
      expect(userStats!.comments[0].id).toBe(testComment.id)
    })
  })

  describe("并发同步处理", () => {
    it("应该正确处理并发的用户创建请求", async () => {
      // Arrange: 准备相同的用户数据
      const userData: SupabaseUser = {
        id: "concurrent_create",
        email: "concurrent@example.com",
        user_metadata: {
          full_name: "Concurrent User",
        },
        app_metadata: {
          provider: "github",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 并发发起同步请求
      const concurrentSyncs = Array.from({ length: 5 }, () => syncUserToDatabase(userData))

      const results = await Promise.allSettled(concurrentSyncs)

      // Assert: 验证并发处理结果
      const successResults = results.filter((r) => r.status === "fulfilled")
      expect(successResults.length).toBeGreaterThan(0)

      // 验证数据库中只创建了一个用户
      const userCount = await db.user.count({
        where: { email: userData.email },
      })
      expect(userCount).toBe(1)

      // 如果有成功的结果，验证它们都指向同一个用户
      if (successResults.length > 0) {
        const userIds = (successResults as any).map((r) => r.value.user.id)
        expect(new Set(userIds).size).toBe(1) // 所有ID应该相同
      }
    })

    it("应该正确处理并发的用户更新请求", async () => {
      // Arrange: 创建基础用户
      const existingUser = await createGitHubTestUser({
        id: "concurrent_update",
        email: "update@github.com",
        name: "原昵称",
      })

      // 准备不同的更新数据
      const updateData1: SupabaseUser = {
        id: existingUser.id,
        email: existingUser.email,
        user_metadata: {
          full_name: "更新1",
          avatar_url: "https://avatar1.com/img.jpg",
        },
        app_metadata: { provider: "github" },
        created_at: existingUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      const updateData2: SupabaseUser = {
        id: existingUser.id,
        email: existingUser.email,
        user_metadata: {
          full_name: "更新2",
          avatar_url: "https://avatar2.com/img.jpg",
        },
        app_metadata: { provider: "github" },
        created_at: existingUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 并发发起更新
      const [result1, result2] = await Promise.allSettled([
        syncUserToDatabase(updateData1),
        syncUserToDatabase(updateData2),
      ])

      // Assert: 验证并发更新结果
      expect(result1.status).toBe("fulfilled")
      expect(result2.status).toBe("fulfilled")

      // 验证最终数据库状态（最后一个更新生效）
      const finalUser = await db.user.findUnique({
        where: { id: existingUser.id },
      })

      expect(finalUser).toBeDefined()
      expect(["更新1", "更新2"]).toContain(finalUser!.name)
      expect(finalUser!.lastLoginAt).toBeInstanceOf(Date)
    })

    it("应该避免并发同步导致的数据竞争", async () => {
      // Arrange: 创建用户
      const { user } = await createEmailTestUser("TestPassword123!")

      // 模拟多个同时的同步操作
      const syncOperations = Array.from({ length: 3 }, (_, index) => {
        const userData: SupabaseUser = {
          id: user.id,
          email: user.email,
          user_metadata: {
            name: `同步操作${index + 1}`,
          },
          app_metadata: { provider: "email" },
          created_at: user.createdAt.toISOString(),
          updated_at: new Date().toISOString(),
        }
        return syncUserToDatabase(userData)
      })

      // Act: 执行并发同步
      const results = await Promise.allSettled(syncOperations)

      // Assert: 验证所有操作都成功完成
      results.forEach((result) => {
        expect(result.status).toBe("fulfilled")
      })

      // 验证数据库状态一致
      const finalUser = await db.user.findUnique({
        where: { id: user.id },
      })

      expect(finalUser).toBeDefined()
      expect(finalUser!.id).toBe(user.id)
      expect(finalUser!.email).toBe(user.email)
    })
  })

  describe("数据冲突解决", () => {
    it("应该处理邮箱冲突场景", async () => {
      // Arrange: 创建已存在的邮箱用户
      const existingUser = await createEmailTestUser("ExistingPassword123!", {
        email: "conflict@example.com",
        name: "已存在用户",
      })

      // 尝试同步一个GitHub用户使用相同邮箱
      const conflictUserData: SupabaseUser = {
        id: "github_conflict_user",
        email: "conflict@example.com", // 相同邮箱
        user_metadata: {
          full_name: "GitHub冲突用户",
          avatar_url: "https://github.com/conflict.jpg",
        },
        app_metadata: {
          provider: "github",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act & Assert: 验证邮箱冲突被检测
      await expect(async () => {
        await syncUserToDatabase(conflictUserData)
      }).rejects.toThrow(/用户数据同步失败/)

      // 验证原用户记录未受影响
      const originalUser = await db.user.findUnique({
        where: { id: existingUser.user.id },
      })
      expect(originalUser).toBeDefined()
      expect(originalUser!.email).toBe("conflict@example.com")
      expect(originalUser!.name).toBe("已存在用户")
    })

    it("应该处理用户ID冲突但邮箱不同的异常情况", async () => {
      // Arrange: 创建用户
      const existingUser = await createEmailTestUser("TestPassword123!", {
        id: "user_id_conflict",
        email: "original@example.com",
      })

      // 尝试同步相同ID但不同邮箱的用户（这是异常情况）
      const conflictUserData: SupabaseUser = {
        id: "user_id_conflict",
        email: "different@example.com", // 不同邮箱
        user_metadata: {
          name: "不同邮箱用户",
        },
        app_metadata: {
          provider: "email",
        },
        created_at: existingUser.user.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 尝试同步冲突数据
      const syncResult = await syncUserToDatabase(conflictUserData)

      // Assert: 应该更新为新的邮箱（Supabase Auth为权威源）
      expect(syncResult.user.id).toBe("user_id_conflict")
      expect(syncResult.user.email).toBe("different@example.com")
      expect(syncResult.syncedFields).toContain("email")

      // 验证数据库已更新
      const updatedUser = await db.user.findUnique({
        where: { id: "user_id_conflict" },
      })
      expect(updatedUser!.email).toBe("different@example.com")
    })

    it("应该处理数据类型不匹配的冲突", async () => {
      // Arrange: 模拟包含无效数据类型的用户数据
      const invalidUserData = {
        id: "type_conflict_user",
        email: "typeconflict@example.com",
        user_metadata: {
          full_name: 123, // 无效的数字类型昵称
          avatar_url: null,
        },
        app_metadata: {
          provider: "github",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 同步时应该处理类型转换
      const syncResult = await syncUserToDatabase(invalidUserData as any)

      // Assert: 验证类型转换和默认值处理
      expect(syncResult.user.id).toBe("type_conflict_user")
      expect(syncResult.user.email).toBe("typeconflict@example.com")
      expect(syncResult.user.name).toBe("typeconflict") // 回退到邮箱用户名
      expect(syncResult.user.avatarUrl).toBeNull()
    })
  })

  describe("同步失败恢复机制", () => {
    it("应该从数据库连接失败中恢复", async () => {
      // Arrange: 模拟数据库连接失败
      const originalCreate = db.user.create
      let callCount = 0

      vi.spyOn(db.user, "create").mockImplementation(async (args) => {
        callCount++
        if (callCount === 1) {
          throw new Error("Database connection failed")
        }
        return originalCreate.call(db.user, args)
      })

      const userData: SupabaseUser = {
        id: "recovery_test",
        email: "recovery@example.com",
        user_metadata: {
          name: "恢复测试用户",
        },
        app_metadata: {
          provider: "email",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 第一次同步失败，但重试应该成功
      await expect(syncUserToDatabase(userData)).rejects.toThrow("用户数据同步失败")

      // 重置mock，允许第二次调用成功
      vi.mocked(db.user.create).mockRestore()

      // 重试同步
      const retryResult = await syncUserToDatabase(userData)

      // Assert: 验证重试成功
      expect(retryResult.isNewUser).toBe(true)
      expect(retryResult.user.email).toBe("recovery@example.com")
      expect(callCount).toBe(1) // 确认第一次调用失败
    })

    it("应该处理部分数据同步失败", async () => {
      // Arrange: 创建用户
      const existingUser = await createGitHubTestUser({
        id: "partial_sync_fail",
        email: "partial@github.com",
        name: "原昵称",
      })

      // 模拟更新操作在某个步骤失败
      const originalUpdate = db.user.update
      vi.spyOn(db.user, "update").mockImplementation(async (args) => {
        // 模拟更新过程中的错误
        throw new Error("Partial update failed")
      })

      const updateData: SupabaseUser = {
        id: existingUser.id,
        email: existingUser.email,
        user_metadata: {
          full_name: "新昵称",
          avatar_url: "https://new-avatar.com/img.jpg",
        },
        app_metadata: { provider: "github" },
        created_at: existingUser.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Act: 尝试同步更新
      await expect(syncUserToDatabase(updateData)).rejects.toThrow("用户数据同步失败")

      // Assert: 验证原数据未被损坏
      const unchangedUser = await db.user.findUnique({
        where: { id: existingUser.id },
      })

      expect(unchangedUser!.name).toBe("原昵称") // 保持原始状态
      expect(unchangedUser!.email).toBe(existingUser.email)

      // 清理mock
      vi.mocked(db.user.update).mockRestore()
    })

    it("应该记录同步失败的详细信息", async () => {
      // Arrange: 准备会导致失败的用户数据
      const invalidUserData: SupabaseUser = {
        id: "", // 空ID会导致错误
        email: "invalid@example.com",
        user_metadata: {},
        app_metadata: { provider: "email" },
        created_at: new Date().toISOString(),
      }

      // 模拟控制台日志
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      // Act: 尝试同步无效数据
      await expect(syncUserToDatabase(invalidUserData)).rejects.toThrow("用户数据同步失败")

      // Assert: 验证错误被正确记录
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith("用户数据同步失败:", expect.any(Error))

      // 清理
      consoleSpy.mockRestore()
    })
  })

  describe("批量用户信息获取", () => {
    it("应该高效获取多个用户的基本信息", async () => {
      // Arrange: 创建多个测试用户
      const users = await Promise.all([
        createEmailTestUser("Password1!", { email: "user1@example.com", name: "用户1" }),
        createEmailTestUser("Password2!", { email: "user2@example.com", name: "用户2" }),
        createGitHubTestUser({ email: "user3@github.com", name: "用户3" }),
      ])

      const userIds = users.map((u) => (u.user ? u.user.id : u.id))

      // Act: 批量获取用户信息
      const batchUserInfo = await getBatchUserInfo(userIds)

      // Assert: 验证批量获取结果
      expect(batchUserInfo).toHaveLength(3)

      batchUserInfo.forEach((user, index) => {
        expect(user.id).toBe(userIds[index])
        expect(user.email).toBeDefined()
        expect(user.name).toBeDefined()
        expect(user.role).toBeDefined()
        expect(user.status).toBeDefined()
        expect(user.createdAt).toBeInstanceOf(Date)
      })

      // 验证返回的字段完整性
      const expectedFields = [
        "id",
        "email",
        "name",
        "avatarUrl",
        "role",
        "status",
        "createdAt",
        "lastLoginAt",
      ]
      batchUserInfo.forEach((user) => {
        expectedFields.forEach((field) => {
          expect(user).toHaveProperty(field)
        })
      })
    })

    it("应该正确处理不存在的用户ID", async () => {
      // Arrange: 混合存在和不存在的用户ID
      const existingUser = await createEmailTestUser("TestPassword123!")
      const userIds = [existingUser.user.id, "nonexistent_user_1", "nonexistent_user_2"]

      // Act: 批量获取用户信息
      const batchUserInfo = await getBatchUserInfo(userIds)

      // Assert: 只返回存在的用户
      expect(batchUserInfo).toHaveLength(1)
      expect(batchUserInfo[0].id).toBe(existingUser.user.id)
    })

    it("应该处理空的用户ID列表", async () => {
      // Act: 传入空列表
      const batchUserInfo = await getBatchUserInfo([])

      // Assert: 返回空结果
      expect(batchUserInfo).toHaveLength(0)
    })
  })
})
