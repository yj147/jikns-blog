/**
 * Supabase 测试模拟配置
 * 提供完整的认证和数据库操作模拟
 */

import { vi } from "vitest"
import type { SupabaseClient, User, Session } from "@supabase/supabase-js"

// 模拟用户数据类型
interface MockUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    [key: string]: any
  }
  app_metadata?: {
    provider?: string
    providers?: string[]
  }
}

// 模拟会话数据类型
interface MockSession {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  user: MockUser
}

/**
 * 创建基础的模拟 Supabase 客户端
 */
export function createMockSupabaseClient(): SupabaseClient {
  const mockClient = {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: {
          provider: "github",
          url: "https://github.com/login/oauth/authorize",
        },
        error: null,
      }),

      signInWithPassword: vi.fn().mockImplementation(async ({ email, password }) => {
        // 模拟基础的成功/失败逻辑
        if (email === "test@example.com" && password === "correct_password") {
          return {
            data: {
              user: {
                id: "test-user-id",
                email: "test@example.com",
                user_metadata: {
                  full_name: "测试用户",
                },
              },
            },
            error: null,
          }
        }

        // 无效输入或错误密码
        return {
          data: { user: null },
          error: {
            message: email ? "Invalid login credentials" : "Email is required",
            name: "AuthError",
            status: 400,
          },
        }
      }),

      signUp: vi.fn().mockResolvedValue({
        data: {
          user: null, // Supabase 注册通常需要邮箱验证
          session: null,
        },
        error: null,
      }),

      signOut: vi.fn().mockResolvedValue({
        error: null,
      }),

      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            expires_in: 3600,
            user: {
              id: "test-user-id",
              email: "test@example.com",
            },
          },
        },
        error: null,
      }),

      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            user_metadata: {
              full_name: "测试用户",
            },
          },
        },
        error: null,
      }),

      refreshSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
            user: {
              id: "test-user-id",
              email: "test@example.com",
            },
          },
          user: {
            id: "test-user-id",
            email: "test@example.com",
          },
        },
        error: null,
      }),

      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "oauth-access-token",
            refresh_token: "oauth-refresh-token",
            expires_in: 3600,
            user: {
              id: "github-user-id",
              email: "github-user@example.com",
            },
          },
          user: {
            id: "github-user-id",
            email: "github-user@example.com",
          },
        },
        error: null,
      }),

      resetPasswordForEmail: vi.fn().mockResolvedValue({
        data: {},
        error: null,
      }),

      updateUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
          },
        },
        error: null,
      }),

      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },

    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      containedBy: vi.fn().mockReturnThis(),
      rangeGt: vi.fn().mockReturnThis(),
      rangeGte: vi.fn().mockReturnThis(),
      rangeLt: vi.fn().mockReturnThis(),
      rangeLte: vi.fn().mockReturnThis(),
      rangeAdjacent: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      csv: vi.fn().mockResolvedValue({ data: "", error: null }),
      geojson: vi.fn().mockResolvedValue({ data: null, error: null }),
      explain: vi.fn().mockResolvedValue({ data: null, error: null }),
      rollback: vi.fn().mockResolvedValue({ data: null, error: null }),
      returns: vi.fn().mockReturnThis(),
    })),

    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),

    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/signed-url" },
          error: null,
        }),
        createSignedUrls: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://example.com/public-url" },
        }),
        move: vi.fn().mockResolvedValue({ data: null, error: null }),
        copy: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },

    realtime: {
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
      getChannels: vi.fn().mockReturnValue([]),
    },
  }

  return mockClient as unknown as SupabaseClient
}

/**
 * 模拟 GitHub OAuth 成功登录
 */
export function mockGitHubOAuthSuccess(userData: Partial<MockUser> = {}) {
  const mockClient = createMockSupabaseClient()

  const defaultGitHubUser = {
    id: "github_123456",
    email: "github-user@example.com",
    user_metadata: {
      full_name: "GitHub用户",
      avatar_url: "https://avatars.githubusercontent.com/u/123456",
      name: "GitHub用户",
      user_name: "githubuser",
    },
    app_metadata: {
      provider: "github",
      providers: ["github"],
    },
    ...userData,
  }

  vi.spyOn(mockClient.auth, "signInWithOAuth").mockResolvedValue({
    data: {
      provider: "github",
      url: "https://github.com/login/oauth/authorize?provider=github&redirect_to=http://localhost:3000/auth/callback",
    },
    error: null,
  })

  vi.spyOn(mockClient.auth, "exchangeCodeForSession").mockResolvedValue({
    data: {
      session: {
        access_token: "github_access_token",
        refresh_token: "github_refresh_token",
        expires_in: 3600,
        user: defaultGitHubUser,
      },
      user: defaultGitHubUser,
    },
    error: null,
  })

  return mockClient
}

/**
 * 模拟 GitHub OAuth 失败
 */
export function mockGitHubOAuthFailure() {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "signInWithOAuth").mockResolvedValue({
    data: { provider: null, url: null },
    error: {
      message: "OAuth provider configuration error",
      name: "AuthError",
      status: 400,
    },
  })

  vi.spyOn(mockClient.auth, "exchangeCodeForSession").mockResolvedValue({
    data: { session: null, user: null },
    error: {
      message: "Invalid authorization code",
      name: "AuthError",
      status: 400,
    },
  })

  return mockClient
}

/**
 * 模拟邮箱密码成功登录
 */
export function mockEmailPasswordSuccess(email: string = "test@example.com") {
  const mockClient = createMockSupabaseClient()

  const mockUser = {
    id: "email_user_123",
    email: email,
    user_metadata: {
      full_name: "邮箱用户",
    },
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
  }

  vi.spyOn(mockClient.auth, "signInWithPassword").mockResolvedValue({
    data: {
      user: mockUser,
      session: {
        access_token: "email_access_token",
        refresh_token: "email_refresh_token",
        expires_in: 3600,
        user: mockUser,
      },
    },
    error: null,
  })

  return mockClient
}

/**
 * 模拟邮箱密码登录成功（别名）
 */
export function mockEmailPasswordLoginSuccess(user: any, plainPassword: string) {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "signInWithPassword").mockImplementation(
    async ({ email, password }) => {
      if (email === user.email && password === plainPassword) {
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: {
                full_name: user.name,
              },
            },
            session: {
              access_token: "login_access_token",
              refresh_token: "login_refresh_token",
              expires_in: 3600,
              user: {
                id: user.id,
                email: user.email,
              },
            },
          },
          error: null,
        }
      }

      return {
        data: { user: null, session: null },
        error: {
          message: "Invalid login credentials",
          name: "AuthError",
          status: 400,
        },
      }
    }
  )

  return mockClient
}

/**
 * 模拟邮箱密码登录失败
 */
export function mockEmailPasswordFailure(errorMessage: string = "Invalid login credentials") {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "signInWithPassword").mockResolvedValue({
    data: { user: null, session: null },
    error: {
      message: errorMessage,
      name: "AuthError",
      status: 400,
    },
  })

  return mockClient
}

/**
 * 模拟邮箱密码登录失败（别名）
 */
export function mockEmailPasswordLoginFailure(errorMessage: string = "Invalid login credentials") {
  return mockEmailPasswordFailure(errorMessage)
}

/**
 * 模拟用户注册成功（需要邮箱验证）
 */
export function mockEmailSignUpSuccess(email: string = "newuser@example.com") {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "signUp").mockResolvedValue({
    data: {
      user: {
        id: "new_user_123",
        email: email,
        email_confirmed_at: null,
        user_metadata: {
          full_name: "新用户",
        },
      },
      session: null, // 注册后通常需要邮箱验证
    },
    error: null,
  })

  return mockClient
}

/**
 * 模拟用户注册失败
 */
export function mockEmailSignUpFailure(errorMessage: string = "User already registered") {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "signUp").mockResolvedValue({
    data: { user: null, session: null },
    error: {
      message: errorMessage,
      name: "AuthError",
      status: 422,
    },
  })

  return mockClient
}

/**
 * 模拟会话刷新成功
 */
export function mockSessionRefreshSuccess(userData: Partial<MockUser> = {}) {
  const mockClient = createMockSupabaseClient()

  const defaultUser = {
    id: "refresh_user_123",
    email: "refresh@example.com",
    user_metadata: {
      full_name: "刷新用户",
    },
    ...userData,
  }

  vi.spyOn(mockClient.auth, "refreshSession").mockResolvedValue({
    data: {
      session: {
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
        expires_in: 3600,
        user: defaultUser,
      },
      user: defaultUser,
    },
    error: null,
  })

  return mockClient
}

/**
 * 模拟会话刷新失败
 */
export function mockSessionRefreshFailure() {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "refreshSession").mockResolvedValue({
    data: { session: null, user: null },
    error: {
      message: "Refresh token not found",
      name: "AuthSessionMissingError",
      status: 401,
    },
  })

  return mockClient
}

/**
 * 模拟获取用户信息成功
 */
export function mockGetUserSuccess(userData: Partial<MockUser> = {}) {
  const mockClient = createMockSupabaseClient()

  const defaultUser = {
    id: "current_user_123",
    email: "current@example.com",
    user_metadata: {
      full_name: "当前用户",
    },
    ...userData,
  }

  vi.spyOn(mockClient.auth, "getUser").mockResolvedValue({
    data: { user: defaultUser },
    error: null,
  })

  return mockClient
}

/**
 * 模拟获取用户信息失败（未登录）
 */
export function mockGetUserFailure() {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "getUser").mockResolvedValue({
    data: { user: null },
    error: {
      message: "JWT expired",
      name: "AuthSessionMissingError",
      status: 401,
    },
  })

  return mockClient
}

/**
 * 模拟密码重置成功
 */
export function mockPasswordResetSuccess() {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "resetPasswordForEmail").mockResolvedValue({
    data: {},
    error: null,
  })

  return mockClient
}

/**
 * 模拟密码重置失败
 */
export function mockPasswordResetFailure() {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "resetPasswordForEmail").mockResolvedValue({
    data: {},
    error: {
      message: "User not found",
      name: "AuthError",
      status: 400,
    },
  })

  return mockClient
}

/**
 * 模拟登出成功
 */
export function mockSignOutSuccess() {
  const mockClient = createMockSupabaseClient()

  vi.spyOn(mockClient.auth, "signOut").mockResolvedValue({
    error: null,
  })

  vi.spyOn(mockClient.auth, "getUser").mockResolvedValue({
    data: { user: null },
    error: {
      message: "JWT expired",
      name: "AuthSessionMissingError",
      status: 401,
    },
  })

  return mockClient
}

/**
 * 模拟网络错误
 */
export function mockNetworkError() {
  const mockClient = createMockSupabaseClient()

  const networkError = {
    message: "Network request failed",
    name: "NetworkError",
    status: 0,
  }

  vi.spyOn(mockClient.auth, "signInWithOAuth").mockRejectedValue(networkError)
  vi.spyOn(mockClient.auth, "signInWithPassword").mockRejectedValue(networkError)
  vi.spyOn(mockClient.auth, "signUp").mockRejectedValue(networkError)
  vi.spyOn(mockClient.auth, "getUser").mockRejectedValue(networkError)
  vi.spyOn(mockClient.auth, "getSession").mockRejectedValue(networkError)

  return mockClient
}

/**
 * 模拟服务器错误
 */
export function mockServerError() {
  const mockClient = createMockSupabaseClient()

  const serverError = {
    message: "Internal Server Error",
    name: "ServerError",
    status: 500,
  }

  vi.spyOn(mockClient.auth, "signInWithOAuth").mockResolvedValue({
    data: { provider: null, url: null },
    error: serverError,
  })

  vi.spyOn(mockClient.auth, "signInWithPassword").mockResolvedValue({
    data: { user: null, session: null },
    error: serverError,
  })

  return mockClient
}

/**
 * 重置所有 Supabase 模拟
 */
export function resetSupabaseMocks() {
  vi.clearAllMocks()
}

/**
 * 获取默认的测试用户数据
 */
export const testUsers = {
  github: {
    id: "github_123456",
    email: "github-user@example.com",
    user_metadata: {
      full_name: "GitHub测试用户",
      avatar_url: "https://avatars.githubusercontent.com/u/123456",
      name: "GitHub测试用户",
      user_name: "githubuser",
    },
    app_metadata: {
      provider: "github",
      providers: ["github"],
    },
  },

  email: {
    id: "email_123456",
    email: "email-user@example.com",
    user_metadata: {
      full_name: "邮箱测试用户",
    },
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
  },

  admin: {
    id: "admin_123456",
    email: "admin@example.com",
    user_metadata: {
      full_name: "管理员用户",
    },
    app_metadata: {
      provider: "github",
      providers: ["github"],
      role: "admin",
    },
  },
}

/**
 * 用户数据同步函数模拟
 */
export async function syncUserToDatabase(userData: any) {
  // 模拟用户数据同步逻辑
  if (!userData.id || !userData.email) {
    throw new Error("用户数据同步失败: 缺少必要字段")
  }

  // 检查数据有效性
  if (typeof userData.id !== "string" || typeof userData.email !== "string") {
    throw new Error("用户数据同步失败: 数据类型不匹配")
  }

  // 模拟成功同步
  return {
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.user_metadata?.full_name || userData.name || "测试用户",
      avatarUrl: userData.user_metadata?.avatar_url || null,
      bio: null,
      socialLinks: userData.user_metadata?.user_name
        ? {
            github: `https://github.com/${userData.user_metadata.user_name}`,
          }
        : null,
      passwordHash: null,
      role: "USER",
      status: "ACTIVE",
      emailVerified: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    isNewUser: true,
    syncedFields: ["id", "email", "name", "avatarUrl"],
  }
}
