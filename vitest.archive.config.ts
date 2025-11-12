import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

const ARCHIVE_TEST_FILES = [
  "tests/actions/archive-actions.test.ts",
  "tests/actions/archive-cache.test.ts",
  "tests/api/archive-routes.test.ts",
  "tests/components/archive/archive-search.test.tsx",
  "tests/utils/archive-utils.test.ts",
  "tests/utils/archive-search-utils.test.ts",
]

const ARCHIVE_COVERAGE_INCLUDE = [
  "lib/actions/archive.ts",
  "lib/actions/archive-cache.ts",
  "lib/cache/archive-tags.ts",
  "lib/utils/archive*.ts",
  "lib/constants/archive-search.ts",
  "app/api/archive/**/route.ts",
  "components/archive/**/*.ts",
  "components/archive/**/*.tsx",
  "hooks/use-intersection-observer.ts",
]

const REPORTS_DIR = path.resolve(__dirname, "coverage/archive")

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    globals: true,
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: "forks",
    maxConcurrency: 3,
    include: ARCHIVE_TEST_FILES,
    exclude: [],
    reporters: ["verbose"],
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      include: ARCHIVE_COVERAGE_INCLUDE,
      exclude: ["**/*.d.ts", "tests/**", "lib/generated/**", "node_modules/**"],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 85,
        lines: 85,
        global: {
          statements: 85,
          branches: 70,
          functions: 85,
          lines: 85,
        },
      },
      all: false,
      clean: true,
      cleanOnRerun: true,
      reporter: ["text", "json", "html"],
      reportsDirectory: REPORTS_DIR,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@/lib/prisma": path.resolve(__dirname, "tests/fixtures/archive/prisma-stub.ts"),
    },
  },
})
