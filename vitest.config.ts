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

    // 优化测试性能和稳定性
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    // 减少并发数量提高稳定性
    pool: "forks", // 替代 threads: false
    maxConcurrency: 3,

    // 测试文件匹配模式 - 扩展测试覆盖范围
    include: includeFromEnv?.length
      ? includeFromEnv
      : [
          "tests/auth-core-stable.test.ts",
          "tests/security/phase4-basic.test.ts",
          "tests/unit/utils-basic.test.ts",
          "tests/unit/utils.test.ts",
          "tests/unit/notification-service.test.ts",
          "tests/unit/email-queue.test.ts",
          "tests/unit/email-queue-cron.test.ts",
          "tests/unit/realtime-notifications.test.ts",
          "tests/unit/activity-tags.test.ts",
          "tests/unit/email-subscription.test.ts",
          "tests/unit/email-subscription.test.tsx",
          "tests/unit/search-tokenizer.test.ts",
          "tests/unit/prisma-token-extension.test.ts",
          "tests/unit/schema-validation.test.ts",
          "tests/unit/admin-settings-page.test.tsx",
          "tests/unit/profile-*.test.{ts,tsx}",
          "tests/unit/likes-*.test.{ts,tsx}",
          "tests/unit/lib/realtime/**/*.test.ts",
          readingTimeTestPattern,
          "tests/middleware/auth-middleware.test.ts",
          "tests/auth/**/*.test.ts",
          "tests/api/posts-crud.test.ts",
          "tests/actions/**/*.test.ts",
          "tests/api/**/*.test.ts",
          "tests/api/**/*.spec.ts",
          "tests/repos/**/*.test.ts",
          "tests/services/**/*.test.ts",
          "tests/unit/scripts/**/*.test.ts",
          "tests/components/**/*.test.{ts,tsx}",
          "tests/components/**/*.spec.{ts,tsx}",
          "tests/hooks/**/*.test.{ts,tsx}",
          "tests/ui/**/*.test.{ts,tsx}",
          "tests/ui/**/*.spec.{ts,tsx}",
          "tests/integration/**/*.test.{ts,tsx}",
          "tests/integration/subscribe-api.test.ts",
        ],

    // 排除不稳定的测试文件
    exclude: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "tests_disabled/**",
      // 暂时排除有问题的测试
      "tests/profile-sync.test.tsx",
      "tests/security/security-e2e.test.ts",
      "tests/integration/security-edge-cases.test.ts",
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
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
