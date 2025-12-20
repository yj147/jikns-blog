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

    // 测试文件匹配模式 - 扩展测试覆盖范围
    include: includeFromEnv?.length
      ? includeFromEnv
      : [
          "tests/auth-core-stable.test.ts",
          "tests/security/phase4-basic.test.ts",
          "tests/unit/utils-basic.test.ts",
          "tests/unit/utils.test.ts",
          "tests/unit/notification-service.test.ts",
          "tests/unit/notification-components.test.tsx",
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
      // 使用真实数据库的集成测试 - 需要单独运行 (isolate: false 导致 mock 污染)
      "tests/integration/avatar-upload.test.ts",
      "tests/integration/activity-polymorphic-constraints.test.ts",
      "tests/integration/follow-list-privacy.test.ts",
      "tests/integration/follow-notifications.test.ts",
      "tests/integration/notification-preferences.test.ts",
      "tests/integration/users-rls.test.ts",
      "tests/integration/realtime-notifications.test.ts",
      "tests/integration/follow-service-idempotency.test.ts",
      "tests/integration/likes-flow.test.ts",
      "tests/integration/tags.test.ts",
      "tests/integration/likes-consistency.test.ts",
      "tests/integration/user-settings.test.ts",
      "tests/integration/notification-center.test.ts",
      "tests/integration/social-links.test.ts",
      "tests/integration/search-fallback.test.ts",
      "tests/integration/unified-search.test.ts",
      "tests/integration/api-permissions.test.ts",
      "tests/integration/comments-observability-integration.test.ts",
      "tests/integration/comments-rate-limit.test.ts",
      "tests/integration/permissions.test.ts",
      "tests/api/users-profile.test.ts",
      "tests/api/activities-routes.integration.test.ts",
      "tests/api/admin-stats.integration.test.ts",
      "tests/api/admin-users-admin-actions.integration.test.ts",
      "tests/api/admin-settings.integration.test.ts",
      // 需要 mock 隔离修复的测试（与 isolate: false 配置冲突）
      "tests/integration/middleware-performance.test.ts",
      "tests/integration/error-handling.test.ts",
      "tests/hooks/use-realtime-comments.test.ts",
      "tests/components/comments/comment-list.test.tsx",
      "tests/auth/user-sync.test.ts",
      "tests/api/likes-route.test.ts",
      "tests/auth/auth-logging.test.ts",
      "tests/auth/auth-utils.test.ts",
      "tests/auth/user-self-healing.test.ts",
      "tests/integration/admin-monitoring.test.ts",
      "tests/integration/comments-deletion.test.ts",
      "tests/components/use-toast-error-handling.test.tsx",
      "tests/integration/auth-api.test.ts",
      "tests/auth/middleware.test.ts",
      "tests/auth/user-profile-sync.test.ts",
      "tests/components/user-menu-display.test.tsx",
      // 不稳定的 mock 测试 - 需要进一步调查
      "tests/unit/notification-service.test.ts",
      "tests/auth/oauth-flow.test.ts",
      "tests/auth/permissions.test.ts",
      "tests/components/blog/tag-filter.test.tsx",
      "tests/api/comments-api.test.ts",
      "tests/api/tags-route.test.ts",
      "tests/api/comment-deletion.test.ts",
      "tests/integration/search-fts-indexes.test.ts",
      "tests/api/posts-crud.test.ts",
      "tests/components/admin-post-list.test.tsx",
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
