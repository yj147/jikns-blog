/**
 * 测试覆盖率配置
 * 定义认证功能的覆盖率要求和质量标准
 */

export const coverageConfig = {
  // 全局覆盖率要求
  global: {
    branches: 80,
    functions: 85,
    lines: 80,
    statements: 80,
  },

  // 关键模块的覆盖率要求
  critical: {
    // 认证核心逻辑必须100%覆盖
    authCore: {
      branches: 100,
      functions: 100,
      lines: 95,
      statements: 95,
      files: ["lib/auth/github-oauth.ts", "lib/auth/email-password.ts", "lib/auth/user-sync.ts"],
    },

    // 权限检查逻辑必须100%覆盖
    permissions: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
      files: ["lib/auth/permissions.ts", "lib/auth/roles.ts"],
    },

    // 安全相关功能必须100%覆盖
    security: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
      files: [
        "lib/auth/password-security.ts",
        "lib/auth/session-security.ts",
        "lib/auth/validation.ts",
      ],
    },
  },

  // 排除的文件和目录
  exclude: [
    "tests/**/*",
    "**/*.test.ts",
    "**/*.config.*",
    "coverage/**/*",
    ".next/**/*",
    "node_modules/**/*",
  ],

  // 覆盖率报告配置
  reporters: ["text", "text-summary", "html", "lcov", "json"],

  // 输出目录
  reportsDirectory: "./coverage",
}

/**
 * 验证覆盖率是否达标
 */
export function validateCoverage(coverage: {
  branches: number
  functions: number
  lines: number
  statements: number
}): { passed: boolean; failures: string[] } {
  const failures: string[] = []

  if (coverage.branches < coverageConfig.global.branches) {
    failures.push(`分支覆盖率 ${coverage.branches}% < 要求的 ${coverageConfig.global.branches}%`)
  }

  if (coverage.functions < coverageConfig.global.functions) {
    failures.push(`函数覆盖率 ${coverage.functions}% < 要求的 ${coverageConfig.global.functions}%`)
  }

  if (coverage.lines < coverageConfig.global.lines) {
    failures.push(`行覆盖率 ${coverage.lines}% < 要求的 ${coverageConfig.global.lines}%`)
  }

  if (coverage.statements < coverageConfig.global.statements) {
    failures.push(
      `语句覆盖率 ${coverage.statements}% < 要求的 ${coverageConfig.global.statements}%`
    )
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}

/**
 * 生成覆盖率报告摘要
 */
export function generateCoverageSummary(coverage: any): string {
  const summary = `
# 认证功能测试覆盖率报告

## 📊 整体覆盖率
- **分支覆盖率**: ${coverage.branches?.toFixed(2) || "N/A"}%
- **函数覆盖率**: ${coverage.functions?.toFixed(2) || "N/A"}%
- **行覆盖率**: ${coverage.lines?.toFixed(2) || "N/A"}%
- **语句覆盖率**: ${coverage.statements?.toFixed(2) || "N/A"}%

## ✅ 质量标准
${validateCoverage(coverage).passed ? "✅ 所有覆盖率要求已达标" : "❌ 存在未达标的覆盖率要求"}

## 🎯 关键模块状态
- **认证核心**: ${coverage.authCore ? "✅ 已覆盖" : "⚠️ 待实现"}
- **权限检查**: ${coverage.permissions ? "✅ 已覆盖" : "⚠️ 待实现"}
- **安全功能**: ${coverage.security ? "✅ 已覆盖" : "⚠️ 待实现"}

## 📈 改进建议
${coverage.branches < 90 ? "- 增加更多边界条件测试以提高分支覆盖率\n" : ""}
${coverage.functions < 90 ? "- 确保所有函数都有对应的测试用例\n" : ""}
${coverage.lines < 85 ? "- 提高代码行的测试覆盖度\n" : ""}

---
*生成时间: ${new Date().toLocaleString("zh-CN")}*
`

  return summary.trim()
}
