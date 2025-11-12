/**
 * Supabase Mock Helper
 * 简化的 Supabase 客户端 Mock，专门用于测试
 */

import { vi } from "vitest"

export function createMockSupabaseClient() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { provider: "github", url: "test-url" },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  }
}
