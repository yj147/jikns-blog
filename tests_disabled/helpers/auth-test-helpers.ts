/**
 * 认证测试辅助工具
 * 提供认证相关的测试工具函数和断言方法
 */

import { expect } from "vitest"
import { getTestDatabase, testUserFactory } from "../config/test-database"
import type { User } from "../../lib/generated/prisma"
import bcrypt from "bcrypt"

/**
 * 创建测试用户到数据库
 * @param userData 用户数据覆盖
 * @returns 创建的用户记录
 */
export async function createTestUser(
  userData?: Partial<Parameters<typeof testUserFactory.createUser>[0]>
): Promise<User> {
  const db = getTestDatabase()
  const data = testUserFactory.createUser(userData)

  return await db.user.create({ data })
}

/**
 * 创建管理员测试用户到数据库
 */
export async function createTestAdmin(
  userData?: Partial<Parameters<typeof testUserFactory.createAdmin>[0]>
): Promise<User> {
  const db = getTestDatabase()
  const data = testUserFactory.createAdmin(userData)

  return await db.user.create({ data })
}

/**
 * 创建GitHub OAuth测试用户
 */
export async function createGitHubTestUser(
  userData?: Partial<Parameters<typeof testUserFactory.createGitHubUser>[0]>
): Promise<User> {
  const db = getTestDatabase()
  const data = testUserFactory.createGitHubUser(userData)

  return await db.user.create({ data })
}

/**
 * 创建邮箱密码测试用户，使用真实的密码哈希
 */
export async function createEmailTestUser(
  password: string = "Test123456!",
  userData?: Partial<Parameters<typeof testUserFactory.createEmailUser>[0]>
): Promise<{ user: User; plainPassword: string }> {
  const db = getTestDatabase()
  const saltRounds = 10
  const passwordHash = await bcrypt.hash(password, saltRounds)

  const data = testUserFactory.createEmailUser({
    ...userData,
    passwordHash,
  })

  const user = await db.user.create({ data })

  return { user, plainPassword: password }
}

/**
 * 验证密码哈希
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword)
}

/**
 * 断言用户认证状态
 */
export const authAssertions = {
  /**
   * 断言用户已成功创建
   */
  async toBeCreatedUser(actualUser: User, expectedData: Partial<User>) {
    expect(actualUser.id).toBeDefined()
    expect(actualUser.email).toBe(expectedData.email)
    expect(actualUser.name).toBe(expectedData.name)
    expect(actualUser.role).toBe(expectedData.role || "USER")
    expect(actualUser.status).toBe(expectedData.status || "ACTIVE")
    expect(actualUser.createdAt).toBeInstanceOf(Date)
    expect(actualUser.updatedAt).toBeInstanceOf(Date)

    if (expectedData.passwordHash) {
      expect(actualUser.passwordHash).toBeTruthy()
      // 验证密码哈希不是明文
      expect(actualUser.passwordHash).not.toBe(expectedData.passwordHash)
    } else {
      expect(actualUser.passwordHash).toBeNull()
    }
  },

  /**
   * 断言GitHub用户特征
   */
  toBeGitHubUser(user: User) {
    expect(user.passwordHash).toBeNull()
    expect(user.avatarUrl).toMatch(/github|avatars/)
    expect(user.socialLinks).toBeDefined()
    expect(typeof user.socialLinks).toBe("object")
  },

  /**
   * 断言邮箱用户特征
   */
  toBeEmailUser(user: User) {
    expect(user.passwordHash).toBeTruthy()
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/)
  },

  /**
   * 断言管理员权限
   */
  toBeAdmin(user: User) {
    expect(user.role).toBe("ADMIN")
    expect(user.status).toBe("ACTIVE")
  },

  /**
   * 断言用户被封禁
   */
  toBeBanned(user: User) {
    expect(user.status).toBe("BANNED")
  },
}

/**
 * 测试认证错误场景的工具
 */
export const authErrorScenarios = {
  /**
   * 无效的邮箱格式测试数据
   */
  invalidEmails: [
    "invalid-email",
    "test@",
    "@example.com",
    "test..double.dot@example.com",
    "test@example",
    "test space@example.com",
    "test@ex ample.com",
  ],

  /**
   * 弱密码测试数据
   */
  weakPasswords: [
    "123", // 太短
    "12345678", // 只有数字
    "password", // 只有字母
    "PASSWORD", // 只有大写字母
    "Password", // 缺少数字和特殊字符
    "Pass123", // 缺少特殊字符
    "pass!@#", // 缺少大写字母和数字
  ],

  /**
   * 有效的强密码测试数据
   */
  strongPasswords: ["Test123456!", "MySecur3P@ssw0rd", "C0mpl3x!P@ss", "Str0ng#Passw0rd"],
}

/**
 * 模拟浏览器环境的认证状态
 */
export class MockAuthContext {
  private currentUser: User | null = null
  private isLoading = false

  constructor() {}

  /**
   * 设置当前登录用户
   */
  setCurrentUser(user: User | null) {
    this.currentUser = user
  }

  /**
   * 获取当前用户
   */
  getCurrentUser(): User | null {
    return this.currentUser
  }

  /**
   * 设置加载状态
   */
  setLoading(loading: boolean) {
    this.isLoading = loading
  }

  /**
   * 检查是否正在加载
   */
  getIsLoading(): boolean {
    return this.isLoading
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  /**
   * 检查是否是管理员
   */
  isAdmin(): boolean {
    return this.currentUser?.role === "ADMIN"
  }

  /**
   * 检查用户状态是否活跃
   */
  isActive(): boolean {
    return this.currentUser?.status === "ACTIVE"
  }

  /**
   * 模拟登出
   */
  signOut() {
    this.currentUser = null
    this.isLoading = false
  }

  /**
   * 重置状态
   */
  reset() {
    this.currentUser = null
    this.isLoading = false
  }
}

/**
 * 创建测试用的认证上下文
 */
export function createMockAuthContext(): MockAuthContext {
  return new MockAuthContext()
}
