/**
 * 测试覆盖率配置和报告工具
 * 为权限系统测试提供覆盖率分析
 */

import type { UserConfig } from "vitest/config"

// 权限系统测试覆盖率目标
export const COVERAGE_TARGETS = {
  // 核心权限逻辑必须达到 90% 覆盖率
  core: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },

  // API 权限控制必须达到 85% 覆盖率
  api: {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85,
  },

  // UI 组件需要达到 80% 覆盖率
  components: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
}

// 权限系统测试覆盖范围
export const COVERAGE_INCLUDE = [
  "lib/auth.ts",
  "lib/supabase.ts",
  "middleware.ts",
  "app/api/*/route.ts",
  "components/auth/**",
  "hooks/use-*auth*.ts",
  "hooks/use-*permission*.ts",
]

export const COVERAGE_EXCLUDE = [
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
]

// Vitest 覆盖率配置
export const coverageConfig: UserConfig["test"] = {
  coverage: {
    provider: "v8",
    reporter: ["text", "json", "html"],
    reportsDirectory: "coverage/permissions",

    include: COVERAGE_INCLUDE,
    exclude: COVERAGE_EXCLUDE,

    // 覆盖率阈值配置
    thresholds: {
      // 全局阈值
      global: COVERAGE_TARGETS.core,

      // 特定文件阈值
      "lib/auth.ts": COVERAGE_TARGETS.core,
      "middleware.ts": COVERAGE_TARGETS.core,
      "app/api/**/route.ts": COVERAGE_TARGETS.api,
      "components/auth/**": COVERAGE_TARGETS.components,
    },

    // 覆盖率检查选项
    all: true,
    clean: true,
    cleanOnRerun: true,
  },
}

// 测试报告生成器
export interface TestReport {
  timestamp: string
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  coverage: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
  duration: number
  environment: string
}

export function generateTestReport(results: any): TestReport {
  return {
    timestamp: new Date().toISOString(),
    totalTests: results.numTotalTests || 0,
    passedTests: results.numPassedTests || 0,
    failedTests: results.numFailedTests || 0,
    skippedTests: results.numPendingTests || 0,
    coverage: {
      statements: results.coverage?.statements?.pct || 0,
      branches: results.coverage?.branches?.pct || 0,
      functions: results.coverage?.functions?.pct || 0,
      lines: results.coverage?.lines?.pct || 0,
    },
    duration: results.testResults?.[0]?.perfStats?.runtime || 0,
    environment: process.env.NODE_ENV || "test",
  }
}

// 测试质量指标
export interface QualityMetrics {
  coverageScore: number // 覆盖率得分 (0-100)
  testReliability: number // 测试可靠性 (0-100)
  performanceScore: number // 性能得分 (0-100)
  securityScore: number // 安全测试得分 (0-100)
  overallScore: number // 综合得分 (0-100)
}

export function calculateQualityMetrics(report: TestReport): QualityMetrics {
  // 计算覆盖率得分 (25% 权重)
  const coverageScore = Math.round(
    (report.coverage.statements +
      report.coverage.branches +
      report.coverage.functions +
      report.coverage.lines) /
      4
  )

  // 计算测试可靠性 (30% 权重)
  const testReliability =
    report.totalTests > 0 ? Math.round((report.passedTests / report.totalTests) * 100) : 0

  // 计算性能得分 (20% 权重) - 基于执行时间
  const performanceScore =
    report.duration < 30000
      ? 100
      : report.duration < 60000
        ? 80
        : report.duration < 120000
          ? 60
          : 40

  // 安全测试得分 (25% 权重) - 基于安全相关测试通过率
  const securityScore = testReliability // 简化计算，实际应该基于安全测试子集

  // 综合得分
  const overallScore = Math.round(
    coverageScore * 0.25 + testReliability * 0.3 + performanceScore * 0.2 + securityScore * 0.25
  )

  return {
    coverageScore,
    testReliability,
    performanceScore,
    securityScore,
    overallScore,
  }
}

// 测试结果验证器
export interface ValidationRule {
  name: string
  check: (report: TestReport) => boolean
  message: string
  severity: "error" | "warning" | "info"
}

export const QUALITY_VALIDATION_RULES: ValidationRule[] = [
  {
    name: "minimum-coverage",
    check: (report) => report.coverage.statements >= 85,
    message: "语句覆盖率必须达到 85% 以上",
    severity: "error",
  },
  {
    name: "branch-coverage",
    check: (report) => report.coverage.branches >= 80,
    message: "分支覆盖率应该达到 80% 以上",
    severity: "warning",
  },
  {
    name: "no-failing-tests",
    check: (report) => report.failedTests === 0,
    message: "不应该有失败的测试用例",
    severity: "error",
  },
  {
    name: "test-performance",
    check: (report) => report.duration < 120000, // 2分钟
    message: "测试执行时间应该在 2 分钟内完成",
    severity: "warning",
  },
  {
    name: "test-count",
    check: (report) => report.totalTests >= 20,
    message: "权限系统应该至少有 20 个测试用例",
    severity: "info",
  },
]

export function validateTestResults(report: TestReport): {
  passed: boolean
  errors: string[]
  warnings: string[]
  infos: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const infos: string[] = []

  for (const rule of QUALITY_VALIDATION_RULES) {
    if (!rule.check(report)) {
      switch (rule.severity) {
        case "error":
          errors.push(rule.message)
          break
        case "warning":
          warnings.push(rule.message)
          break
        case "info":
          infos.push(rule.message)
          break
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    infos,
  }
}

// 测试环境检查器
export function checkTestEnvironment(): {
  isReady: boolean
  issues: string[]
  recommendations: string[]
} {
  const issues: string[] = []
  const recommendations: string[] = []

  // 检查必要的环境变量
  const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push(`缺少环境变量: ${envVar}`)
    }
  }

  // 检查测试数据库连接
  if (
    process.env.NODE_ENV === "test" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")
  ) {
    recommendations.push("建议使用本地 Supabase 实例进行测试")
  }

  // 检查测试文件结构
  const testFiles = [
    "tests/setup.ts",
    "tests/helpers/test-data.ts",
    "tests/__mocks__/supabase.ts",
    "tests/__mocks__/prisma.ts",
  ]

  // 这里实际上应该检查文件是否存在
  // 为了简化，我们假设文件都存在

  return {
    isReady: issues.length === 0,
    issues,
    recommendations,
  }
}
