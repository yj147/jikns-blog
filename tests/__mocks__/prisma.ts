/**
 * Prisma 客户端 Mock
 * 为认证系统测试提供可控的数据库操作模拟
 */

import { vi } from "vitest"
import { TEST_USERS } from "../helpers/test-data"
import type { TestUser } from "../setup"

// Mock 数据库状态
const mockDatabase = {
  users: new Map<string, TestUser>(),
  posts: new Map<string, any>(),
  comments: new Map<string, any>(),
  activities: new Map<string, any>(),
  likes: new Map<string, any>(),
  tags: new Map<string, any>(),
  performanceMetrics: [] as any[],
}

// 初始化测试用户数据
Object.values(TEST_USERS).forEach((user) => {
  mockDatabase.users.set(user.id, user)
})

/**
 * 创建可模拟的 Prisma 客户端方法
 * 使用 vitest mock function 确保 mockResolvedValue 可用
 */
function createMockPrismaMethod<T extends (...args: any[]) => Promise<any>>(implementation: T) {
  const mockFn = vi.fn(implementation)
  return mockFn as typeof mockFn & {
    mockResolvedValue: (value: Awaited<ReturnType<T>>) => typeof mockFn
    mockRejectedValue: (error: any) => typeof mockFn
  }
}

/**
 * Mock Prisma User 操作
 */
const mockUserOperations = {
  findUnique: createMockPrismaMethod(
    async ({ where, select }: { where: { id?: string; email?: string }; select?: any }) => {
      let user: TestUser | undefined = undefined

      if (where.id) {
        user = mockDatabase.users.get(where.id)
      } else if (where.email) {
        user = [...mockDatabase.users.values()].find((u) => u.email === where.email)
      }

      if (!user) return null

      // 如果指定了 select，只返回选中的字段
      if (select) {
        const result: any = {}
        Object.keys(select).forEach((key) => {
          if (key in user) {
            result[key] = (user as any)[key]
          }
        })
        return result
      }

      return user
    }
  ),

  findMany: createMockPrismaMethod(async ({ where = {}, take, skip, orderBy }: any = {}) => {
    let users = [...mockDatabase.users.values()]

    // 应用筛选条件
    if (where.role) {
      users = users.filter((user) => user.role === where.role)
    }
    if (where.status) {
      users = users.filter((user) => user.status === where.status)
    }
    if (where.email) {
      users = users.filter((user) => user.email.includes(where.email.contains || where.email))
    }

    // 应用排序
    if (orderBy) {
      const field = Object.keys(orderBy)[0]
      const direction = orderBy[field]
      users.sort((a, b) => {
        const aVal = (a as any)[field]
        const bVal = (b as any)[field]
        if (direction === "desc") {
          return bVal > aVal ? 1 : -1
        }
        return aVal > bVal ? 1 : -1
      })
    }

    // 应用分页
    if (skip) {
      users = users.slice(skip)
    }
    if (take) {
      users = users.slice(0, take)
    }

    return users
  }),

  create: createMockPrismaMethod(async ({ data }: { data: Partial<TestUser> }) => {
    const newUser: TestUser = {
      id: data.id || `mock-id-${Date.now()}`,
      email: data.email || "new@test.com",
      name: data.name || "New User",
      role: data.role || "USER",
      status: data.status || "ACTIVE",
      avatarUrl: data.avatarUrl || undefined,
      lastLoginAt: data.lastLoginAt || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // 检查邮箱唯一性约束
    const existingUser = [...mockDatabase.users.values()].find((u) => u.email === newUser.email)
    if (existingUser) {
      throw new Error("Unique constraint failed on the fields: (`email`)")
    }

    mockDatabase.users.set(newUser.id, newUser)
    return newUser
  }),

  update: createMockPrismaMethod(
    async ({ where, data }: { where: { id: string }; data: Partial<TestUser> }) => {
      const existingUser = mockDatabase.users.get(where.id)
      if (!existingUser) {
        throw new Error("Record to update not found")
      }

      const updatedUser = {
        ...existingUser,
        ...data,
        updatedAt: new Date(),
      }

      mockDatabase.users.set(where.id, updatedUser)
      return updatedUser
    }
  ),

  delete: createMockPrismaMethod(async ({ where }: { where: { id: string } }) => {
    const user = mockDatabase.users.get(where.id)
    if (!user) {
      throw new Error("Record to delete does not exist")
    }

    mockDatabase.users.delete(where.id)
    return user
  }),

  count: createMockPrismaMethod(async ({ where = {} }: any = {}) => {
    let users = [...mockDatabase.users.values()]

    if (where.role) {
      users = users.filter((user) => user.role === where.role)
    }
    if (where.status) {
      users = users.filter((user) => user.status === where.status)
    }

    return users.length
  }),

  upsert: createMockPrismaMethod(async ({ where, create, update }: any) => {
    const existingUser = mockDatabase.users.get(where.id)

    if (existingUser) {
      // 执行更新
      const updatedUser = {
        ...existingUser,
        ...update,
        updatedAt: new Date(),
      }
      mockDatabase.users.set(where.id, updatedUser)
      return updatedUser
    } else {
      // 执行创建
      const newUser: TestUser = {
        id: where.id || `mock-id-${Date.now()}`,
        email: create.email || "new@test.com",
        name: create.name || "New User",
        role: create.role || "USER",
        status: create.status || "ACTIVE",
        avatarUrl: create.avatarUrl || undefined,
        lastLoginAt: create.lastLoginAt || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockDatabase.users.set(newUser.id, newUser)
      return newUser
    }
  }),
}

/**
 * Mock Post 模型操作（用于权限测试）
 */
const mockPostOperations = {
  findUnique: createMockPrismaMethod(async ({ where }: { where: { id: string } }) => {
    return (
      mockDatabase.posts.get(where.id) || {
        id: where.id,
        title: "Mock Post",
        content: "Mock content",
        authorId: TEST_USERS.user.id,
        status: "PUBLISHED",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    )
  }),

  findMany: createMockPrismaMethod(async ({ where = {}, include }: any = {}) => {
    const posts = [...mockDatabase.posts.values()]

    if (where.authorId) {
      return posts.filter((post: any) => post.authorId === where.authorId)
    }

    return posts.length > 0
      ? posts
      : [
          {
            id: "mock-post-1",
            title: "Test Post 1",
            content: "Test content 1",
            authorId: TEST_USERS.user.id,
            status: "PUBLISHED",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "mock-post-2",
            title: "Test Post 2",
            content: "Test content 2",
            authorId: TEST_USERS.admin.id,
            status: "DRAFT",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
  }),

  create: createMockPrismaMethod(async ({ data }: any) => {
    const newPost = {
      id: `mock-post-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockDatabase.posts.set(newPost.id, newPost)
    return newPost
  }),

  update: createMockPrismaMethod(async ({ where, data }: any) => {
    const existingPost = mockDatabase.posts.get(where.id)
    if (!existingPost) {
      throw new Error("Post not found")
    }

    const updatedPost = {
      ...existingPost,
      ...data,
      updatedAt: new Date(),
    }
    mockDatabase.posts.set(where.id, updatedPost)
    return updatedPost
  }),

  delete: createMockPrismaMethod(async ({ where }: any) => {
    const post = mockDatabase.posts.get(where.id)
    if (!post) {
      throw new Error("Post not found")
    }

    mockDatabase.posts.delete(where.id)
    return post
  }),
}

/**
 * Mock Comment 模型操作
 */
const mockCommentOperations = {
  findMany: createMockPrismaMethod(async ({ where = {} }: any = {}) => {
    const comments = [...mockDatabase.comments.values()]

    if (where.postId) {
      return comments.filter((comment: any) => comment.postId === where.postId)
    }
    if (where.authorId) {
      return comments.filter((comment: any) => comment.authorId === where.authorId)
    }

    return comments
  }),

  create: createMockPrismaMethod(async ({ data }: any) => {
    const newComment = {
      id: `mock-comment-${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockDatabase.comments.set(newComment.id, newComment)
    return newComment
  }),

  delete: createMockPrismaMethod(async ({ where }: any) => {
    const comment = mockDatabase.comments.get(where.id)
    if (!comment) {
      throw new Error("Comment not found")
    }

    mockDatabase.comments.delete(where.id)
    return comment
  }),
}

/**
 * Mock Activity 模型操作
 */
const mockActivityOperations = {
  findMany: createMockPrismaMethod(async ({ where = {}, take, skip }: any = {}) => {
    let activities = [...mockDatabase.activities.values()]

    // 应用筛选条件
    if (where.deletedAt !== undefined) {
      activities = activities.filter((activity: any) => activity.deletedAt === where.deletedAt)
    }
    if (where.authorId) {
      activities = activities.filter((activity: any) => activity.authorId === where.authorId)
    }

    // 应用分页
    if (skip) {
      activities = activities.slice(skip)
    }
    if (take) {
      activities = activities.slice(0, take)
    }

    return activities
  }),

  count: createMockPrismaMethod(async ({ where = {} }: any = {}) => {
    let activities = [...mockDatabase.activities.values()]

    if (where.deletedAt !== undefined) {
      activities = activities.filter((activity: any) => activity.deletedAt === where.deletedAt)
    }

    return activities.length
  }),
}

/**
 * Mock Like 模型操作
 */
const mockLikeOperations = {
  findMany: createMockPrismaMethod(async ({ where = {}, take, skip, orderBy }: any = {}) => {
    let likes = [...mockDatabase.likes.values()]

    if (where.authorId) {
      likes = likes.filter((like) => like.authorId === where.authorId)
    }

    if (where.OR) {
      likes = likes.filter((like) =>
        where.OR.some((condition: any) => {
          if (condition.activity?.is) {
            return Boolean(like.activity) && like.activity?.deletedAt === condition.activity.is.deletedAt
          }
          if (condition.post?.is) {
            return Boolean(like.post) && like.post?.published === condition.post.is.published
          }
          return true
        })
      )
    }

    if (orderBy) {
      const field = Object.keys(orderBy)[0]
      const direction = orderBy[field]
      likes.sort((a: any, b: any) => {
        const aVal = (a as any)[field]
        const bVal = (b as any)[field]
        if (direction === "desc") {
          return bVal > aVal ? 1 : -1
        }
        return aVal > bVal ? 1 : -1
      })
    }

    if (skip) {
      likes = likes.slice(skip)
    }
    if (take) {
      likes = likes.slice(0, take)
    }

    return likes
  }),

  count: createMockPrismaMethod(async ({ where = {} }: any = {}) => {
    let likes = [...mockDatabase.likes.values()]

    if (where.authorId) {
      likes = likes.filter((like) => like.authorId === where.authorId)
    }

    if (where.OR) {
      likes = likes.filter((like) =>
        where.OR.some((condition: any) => {
          if (condition.activity?.is) {
            return Boolean(like.activity) && like.activity?.deletedAt === condition.activity.is.deletedAt
          }
          if (condition.post?.is) {
            return Boolean(like.post) && like.post?.published === condition.post.is.published
          }
          return true
        })
      )
    }

    return likes.length
  }),

  groupBy: createMockPrismaMethod(async ({ where = {}, _count }: any = {}) => {
    const likes = [...mockDatabase.likes.values()].filter((like) => {
      if (where.postId?.in) {
        return where.postId.in.includes(like.postId)
      }
      return true
    })

    const groups = new Map<string, number>()
    likes.forEach((like) => {
      if (like.postId) {
        groups.set(like.postId, (groups.get(like.postId) || 0) + 1)
      }
    })

    return Array.from(groups.entries()).map(([postId, count]) => ({
      postId,
      _count: {
        _all: _count?._all ? count : 0,
      },
    }))
  }),

  create: createMockPrismaMethod(async ({ data }: any) => {
    const newLike = {
      id: data.id || `mock-like-${Date.now()}`,
      createdAt: data.createdAt || new Date(),
      authorId: data.authorId,
      postId: data.postId || null,
      activityId: data.activityId || null,
      activity: data.activity,
      post: data.post,
    }
    mockDatabase.likes.set(newLike.id, newLike)
    return newLike
  }),

  delete: createMockPrismaMethod(async ({ where }: any) => {
    const like = mockDatabase.likes.get(where.id)
    if (!like) {
      throw new Error("Like not found")
    }
    mockDatabase.likes.delete(where.id)
    return like
  }),
}

/**
 * Mock Tag 模型操作
 */
const mockTagOperations = {
  findMany: createMockPrismaMethod(async ({ where = {}, take, skip }: any = {}) => {
    let tags = [...mockDatabase.tags.values()]

    // 应用筛选条件
    if (where.OR) {
      tags = tags.filter((tag: any) => {
        return where.OR.some((condition: any) => {
          if (condition.name) {
            return tag.name.includes(condition.name.contains || condition.name)
          }
          if (condition.description) {
            return tag.description?.includes(
              condition.description.contains || condition.description
            )
          }
          return false
        })
      })
    }

    // 应用分页
    if (skip) {
      tags = tags.slice(skip)
    }
    if (take) {
      tags = tags.slice(0, take)
    }

    return tags
  }),

  count: createMockPrismaMethod(async ({ where = {} }: any = {}) => {
    let tags = [...mockDatabase.tags.values()]

    if (where.OR) {
      tags = tags.filter((tag: any) => {
        return where.OR.some((condition: any) => {
          if (condition.name) {
            return tag.name.includes(condition.name.contains || condition.name)
          }
          if (condition.description) {
            return tag.description?.includes(
              condition.description.contains || condition.description
            )
          }
          return false
        })
      })
    }

    return tags.length
  }),
}

const mockPerformanceMetricOperations = {
  createMany: createMockPrismaMethod(async ({ data }: { data: any[] }) => {
    const metrics = Array.isArray(data) ? data : []
    mockDatabase.performanceMetrics.push(...metrics)
    return { count: metrics.length }
  }),
}

/**
 * Mock Prisma 客户端
 */
export const mockPrisma = {
  user: mockUserOperations,
  users: mockUserOperations,
  post: mockPostOperations,
  posts: mockPostOperations,
  comment: mockCommentOperations,
  comments: mockCommentOperations,
  activity: mockActivityOperations,
  activities: mockActivityOperations,
  like: mockLikeOperations,
  likes: mockLikeOperations,
  tag: mockTagOperations,
  tags: mockTagOperations,
  performanceMetric: mockPerformanceMetricOperations,

  // 事务支持
  $transaction: vi.fn(async (operations: any[]) => {
    const results = []
    for (const operation of operations) {
      if (typeof operation === "function") {
        results.push(await operation(mockPrisma))
      } else {
        results.push(await operation)
      }
    }
    return results
  }),

  // 连接管理
  $connect: vi.fn(async () => {
    // 模拟连接成功
  }),

  $disconnect: vi.fn(async () => {
    // 模拟断开连接
  }),

  // 查询执行
  $queryRaw: vi.fn(async () => []),
  $executeRaw: vi.fn(async () => 0),
}

/**
 * 重置所有 Prisma Mock 状态
 */
export function resetPrismaMocks() {
  // 重置数据库状态
  mockDatabase.users.clear()
  mockDatabase.posts.clear()
  mockDatabase.comments.clear()
  mockDatabase.activities.clear()
  mockDatabase.likes.clear()
  mockDatabase.tags.clear()
  mockDatabase.performanceMetrics = []

  // 重新初始化测试用户
  Object.values(TEST_USERS).forEach((user) => {
    mockDatabase.users.set(user.id, user)
  })

  // 清除所有 mock 调用记录
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === "object" && model !== null) {
      Object.values(model).forEach((method) => {
        if (vi.isMockFunction(method)) {
          method.mockClear()
        }
      })
    }
  })
}

/**
 * 添加测试数据到 Mock 数据库
 */
export function addMockUser(user: TestUser) {
  mockDatabase.users.set(user.id, user)
}

export function addMockPost(post: any) {
  mockDatabase.posts.set(post.id, post)
}

export function addMockComment(comment: any) {
  mockDatabase.comments.set(comment.id, comment)
}

/**
 * 获取 Mock 数据库状态
 */
export function getMockUsers() {
  return [...mockDatabase.users.values()]
}

export function getMockPosts() {
  return [...mockDatabase.posts.values()]
}

/**
 * 模拟数据库错误
 */
export function simulateConnectionError() {
  const connectionError = new Error("connect ECONNREFUSED 127.0.0.1:5432")
  Object.values(mockUserOperations).forEach((method) => {
    if (vi.isMockFunction(method)) {
      method.mockRejectedValueOnce(connectionError)
    }
  })
}

export function simulateTimeoutError() {
  const timeoutError = new Error("Query timeout")
  Object.values(mockUserOperations).forEach((method) => {
    if (vi.isMockFunction(method)) {
      method.mockRejectedValueOnce(timeoutError)
    }
  })
}

export function simulateUniqueConstraintError() {
  mockUserOperations.create.mockRejectedValueOnce(
    new Error("Unique constraint failed on the fields: (`email`)")
  )
}

/**
 * 数据库错误模拟函数
 */
export function mockDatabaseError(error: Error) {
  Object.values(mockUserOperations).forEach((method) => {
    if (vi.isMockFunction(method)) {
      method.mockRejectedValueOnce(error)
    }
  })
}

/**
 * 恢复正常的数据库操作
 */
export function restoreNormalOperation() {
  resetPrismaMocks()
}

/**
 * 创建 Mock Prisma 客户端实例
 * 为测试提供一致的接口
 */
export function createMockPrismaClient() {
  return mockPrisma
}

// 导出单例实例
export const prisma = mockPrisma

// 默认导出
export default {
  prisma: mockPrisma,
  resetPrismaMocks,
  addMockUser,
  addMockPost,
  getMockUsers,
  simulateConnectionError,
  simulateTimeoutError,
  restoreNormalOperation,
  mockDatabaseError,
}
