import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

const readingTimeTestPattern = "tests/unit/reading-time.test.ts"
const isReadingTimeRun = process.argv.some((arg) => arg.includes(readingTimeTestPattern))
const includeFromEnv = process.env.VITEST_INCLUDE?.split(",").filter(Boolean)

const baseCoverageInclude = [
  "components/admin/feed-*.tsx",
  "components/profile/profile-posts-tab.tsx",
  "hooks/useFeedFilters.ts",
  "app/api/admin/feeds/**/*.ts",
  "scripts/reconcile-tag-activities-count.ts",
  // 用户空间补全功能覆盖率
  "components/notifications/**/*.tsx",
  "app/api/notifications/**/*.ts",
  "app/api/users/[userId]/follow-list-handler.ts",
  "hooks/use-follow-list.ts",
  "lib/permissions/follow-permissions.ts",
  "app/actions/settings.ts",
  "app/api/user/preferences/**/*.ts",
  "app/api/user/privacy/**/*.ts",
  "lib/services/notification.ts",
  "lib/interactions/likes.ts",
  "lib/interactions/comments.ts",
  "lib/profile/stats.ts",
  "lib/services/email-subscription.ts",
  "lib/services/resend.ts",
  "types/notification.ts",
  "types/user-settings.ts",
  // 性能指标监控功能覆盖率
  "lib/metrics/persistence.ts",
  "lib/api/response-wrapper.ts",
  "lib/repos/metrics-repo.ts",
  "lib/dto/metrics.dto.ts",
  "app/api/admin/metrics/**/*.ts",
  "hooks/use-metrics-timeseries.ts",
  "components/admin/metrics-chart.tsx",
  "components/admin/monitoring-dashboard.tsx",
  // Realtime 基础设施
  "lib/realtime/**/*.ts",
]

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    globals: true,

    // 避免跨文件复用 mock 状态
    clearMocks: true,

    // 优化测试性能和稳定性
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    // 使用隔离模式避免测试间 mock 状态污染
    // 注意：这会增加内存占用和测试时间，但确保测试稳定性
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },

    // 启用隔离模式，每个测试文件独立环境
    isolate: true,

    // 测试文件匹配模式 - 简化为通用 glob
    include: includeFromEnv?.length
      ? includeFromEnv
      : ["tests/**/*.test.{ts,tsx}", "tests/**/*.spec.{ts,tsx}"],

    // 排除不稳定的测试文件（已移至 tests_disabled/）
    exclude: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "tests_disabled/**",
      "tests/e2e/**", // E2E 测试单独运行
    ],

    // 测试覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage/permissions",

      include: isReadingTimeRun ? ["lib/utils/reading-time.ts"] : baseCoverageInclude,

      exclude: [
        "node_modules/**",
        "tests/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "lib/generated/**",
        "**/*.d.ts",
        "coverage/**",
        "build/**",
        "dist/**",
        ".next/**",
      ],

      // 覆盖率阈值
      thresholds: {
        global: {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },

      all: true,
      clean: true,
      cleanOnRerun: true,
    },

    // 测试报告配置
    reporters: ["verbose"],

    // 环境变量
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=4096",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
