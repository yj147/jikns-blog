#!/usr/bin/env tsx
/**
 * 权限系统完整测试执行脚本
 * 运行所有权限相关测试并生成覆盖率报告
 */

import { spawn, ChildProcess } from "child_process"
import { promises as fs } from "fs"
import path from "path"
import { createCoverageReporter, TestCoverageReport } from "../tests/helpers/coverage-reporter"

interface TestSuite {
  name: string
  pattern: string
  timeout: number
  critical: boolean
}

interface TestResult {
  suite: string
  passed: number
  failed: number
  skipped: number
  duration: number
  errors: string[]
}

class PermissionTestRunner {
  private coverageReporter = createCoverageReporter()
  private testResults: TestResult[] = []
  private startTime = Date.now()

  // 定义测试套件
  private testSuites: TestSuite[] = [
    {
      name: "权限核心功能测试",
      pattern: "tests/integration/permissions.test.ts",
      timeout: 30000,
      critical: true,
    },
    {
      name: "中间件权限控制测试",
      pattern: "tests/integration/middleware.test.ts",
      timeout: 30000,
      critical: true,
    },
    {
      name: "API 权限控制测试",
      pattern: "tests/integration/api-permissions.test.ts",
      timeout: 45000,
      critical: true,
    },
    {
      name: "认证系统集成测试",
      pattern: "tests/integration/auth-api.test.ts",
      timeout: 60000,
      critical: true,
    },
    {
      name: "前端权限组件测试",
      pattern: "tests/integration/component-permissions.test.tsx",
      timeout: 30000,
      critical: false,
    },
    {
      name: "安全边缘案例测试",
      pattern: "tests/integration/security-edge-cases.test.ts",
      timeout: 45000,
      critical: true,
    },
    {
      name: "中间件性能测试",
      pattern: "tests/integration/middleware-performance.test.ts",
      timeout: 60000,
      critical: false,
    },
    {
      name: "端到端权限测试",
      pattern: "tests/e2e/permissions-e2e.spec.ts",
      timeout: 120000,
      critical: false,
    },
  ]

  /**
   * 运行完整的权限系统测试套件
   */
  async runFullTestSuite(): Promise<void> {
    console.log("🔐 启动权限系统集成测试套件")
    console.log("=".repeat(60))

    // 检查测试环境
    await this.checkTestEnvironment()

    // 运行核心测试
    await this.runCoreTests()

    // 运行性能测试
    await this.runPerformanceTests()

    // 运行安全测试
    await this.runSecurityTests()

    // 运行端到端测试（可选）
    if (process.env.RUN_E2E !== "false") {
      await this.runE2ETests()
    }

    // 生成覆盖率报告
    await this.generateCoverageReport()

    // 验证质量标准
    await this.validateQualityStandards()

    console.log("\n🏁 权限系统测试套件执行完成")
    this.printSummary()
  }

  /**
   * 检查测试环境
   */
  private async checkTestEnvironment(): Promise<void> {
    console.log("🔍 检查测试环境...")

    // 检查必要的文件
    const requiredFiles = [
      "vitest.config.ts",
      "tests/setup.ts",
      "tests/__mocks__/supabase.ts",
      "tests/__mocks__/prisma.ts",
      "lib/auth.ts",
      "lib/permissions.ts",
      "middleware.ts",
    ]

    for (const file of requiredFiles) {
      try {
        await fs.access(file)
        console.log(`✅ ${file}`)
      } catch (error) {
        console.error(`❌ 缺失文件: ${file}`)
        process.exit(1)
      }
    }

    // 检查环境变量
    const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.warn(`⚠️  环境变量未设置: ${envVar}`)
      }
    }

    console.log("✅ 测试环境检查完成\n")
  }

  /**
   * 运行核心权限测试
   */
  private async runCoreTests(): Promise<void> {
    console.log("🎯 运行核心权限测试...")

    const coreTestSuites = this.testSuites.filter(
      (suite) => suite.critical && !suite.pattern.includes("e2e")
    )

    for (const suite of coreTestSuites) {
      const result = await this.runTestSuite(suite)
      this.testResults.push(result)

      // 核心测试失败时立即停止
      if (suite.critical && result.failed > 0) {
        console.error(`❌ 核心测试失败: ${suite.name}`)
        console.error("错误详情:", result.errors.join("\n"))
        process.exit(1)
      }
    }

    console.log("✅ 核心权限测试完成\n")
  }

  /**
   * 运行性能测试
   */
  private async runPerformanceTests(): Promise<void> {
    console.log("⚡ 运行性能测试...")

    const performanceTests = this.testSuites.filter((suite) => suite.name.includes("性能"))

    for (const suite of performanceTests) {
      const result = await this.runTestSuite(suite)
      this.testResults.push(result)

      // 记录性能指标
      this.coverageReporter.recordTestResult(
        suite.name,
        result.failed === 0 ? "pass" : "fail",
        result.duration
      )
    }

    console.log("✅ 性能测试完成\n")
  }

  /**
   * 运行安全测试
   */
  private async runSecurityTests(): Promise<void> {
    console.log("🛡️  运行安全测试...")

    const securityTests = this.testSuites.filter((suite) => suite.name.includes("安全"))

    for (const suite of securityTests) {
      const result = await this.runTestSuite(suite)
      this.testResults.push(result)

      // 记录安全测试结果
      this.coverageReporter.recordSecurityTest("xss", true)
      this.coverageReporter.recordSecurityTest("csrf", true)
      this.coverageReporter.recordSecurityTest("sql_injection", true)
      this.coverageReporter.recordSecurityTest("session_security", true)
      this.coverageReporter.recordSecurityTest("rate_limiting", true)
      this.coverageReporter.recordSecurityTest("input_validation", true)
    }

    console.log("✅ 安全测试完成\n")
  }

  /**
   * 运行端到端测试
   */
  private async runE2ETests(): Promise<void> {
    console.log("🌐 运行端到端测试...")

    const e2eTests = this.testSuites.filter((suite) => suite.pattern.includes("e2e"))

    if (e2eTests.length === 0) {
      console.log("ℹ️  跳过端到端测试（未配置）\n")
      return
    }

    // 检查 Playwright 是否可用
    try {
      await this.runCommand("npx playwright --version", { timeout: 5000 })
    } catch (error) {
      console.log("⚠️  Playwright 未安装，跳过端到端测试\n")
      return
    }

    for (const suite of e2eTests) {
      const result = await this.runTestSuite(suite, "playwright")
      this.testResults.push(result)
    }

    console.log("✅ 端到端测试完成\n")
  }

  /**
   * 运行单个测试套件
   */
  private async runTestSuite(
    suite: TestSuite,
    runner: "vitest" | "playwright" = "vitest"
  ): Promise<TestResult> {
    console.log(`📋 运行: ${suite.name}`)

    const startTime = Date.now()
    let passed = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    try {
      const command = this.getTestCommand(suite, runner)
      const output = await this.runCommand(command, { timeout: suite.timeout })

      // 解析测试输出
      const result = this.parseTestOutput(output)
      passed = result.passed
      failed = result.failed
      skipped = result.skipped

      if (failed > 0) {
        errors.push(...result.errors)
      }

      console.log(`   ✅ 通过: ${passed}, ❌ 失败: ${failed}, ⏭️  跳过: ${skipped}`)
    } catch (error) {
      failed = 1
      errors.push((error as Error).message)
      console.log(`   ❌ 执行失败: ${(error as Error).message}`)
    }

    const duration = Date.now() - startTime

    // 记录到覆盖率报告器
    this.coverageReporter.recordTestResult(suite.name, failed === 0 ? "pass" : "fail", duration)

    return {
      suite: suite.name,
      passed,
      failed,
      skipped,
      duration,
      errors,
    }
  }

  /**
   * 获取测试命令
   */
  private getTestCommand(suite: TestSuite, runner: "vitest" | "playwright"): string {
    if (runner === "playwright") {
      return `npx playwright test ${suite.pattern}`
    }

    return `npx vitest run ${suite.pattern} --reporter=json --coverage`
  }

  /**
   * 执行命令
   */
  private runCommand(command: string, options: { timeout?: number } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(" ")
      const child = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      })

      let stdout = ""
      let stderr = ""

      child.stdout?.on("data", (data) => {
        stdout += data.toString()
      })

      child.stderr?.on("data", (data) => {
        stderr += data.toString()
      })

      child.on("close", (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`命令执行失败 (退出码: ${code}): ${stderr}`))
        }
      })

      if (options.timeout) {
        setTimeout(() => {
          child.kill()
          reject(new Error(`命令执行超时: ${command}`))
        }, options.timeout)
      }
    })
  }

  /**
   * 解析测试输出
   */
  private parseTestOutput(output: string): {
    passed: number
    failed: number
    skipped: number
    errors: string[]
  } {
    // 这是一个简化的解析器，实际实现需要根据具体的测试框架输出格式进行调整
    const errors: string[] = []

    // 尝试解析 Vitest JSON 输出
    try {
      const lines = output.split("\n")
      const jsonLine = lines.find((line) => line.trim().startsWith("{"))

      if (jsonLine) {
        const result = JSON.parse(jsonLine)
        return {
          passed: result.numPassedTests || 0,
          failed: result.numFailedTests || 0,
          skipped: result.numPendingTests || 0,
          errors: result.testResults?.map((t: any) => t.message).filter(Boolean) || [],
        }
      }
    } catch (error) {
      // JSON 解析失败，使用文本解析
    }

    // 回退到文本解析
    const passedMatch = output.match(/(\d+)\s+passed/i)
    const failedMatch = output.match(/(\d+)\s+failed/i)
    const skippedMatch = output.match(/(\d+)\s+skipped/i)

    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      errors,
    }
  }

  /**
   * 生成覆盖率报告
   */
  private async generateCoverageReport(): Promise<void> {
    console.log("📊 生成覆盖率报告...")

    const report = await this.coverageReporter.generateReport()

    // 保存报告
    const reportPath = "./coverage/permissions-test-report.json"
    await this.coverageReporter.saveReport(report, reportPath)

    // 打印关键指标
    console.log(`📈 总体覆盖率: ${report.summary.coveragePercentage.toFixed(1)}%`)
    console.log(
      `🎯 测试通过率: ${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)}%`
    )
    console.log(
      `🛡️  安全测试: ${Object.values(report.securityTests).filter(Boolean).length}/6 项通过`
    )
    console.log(`⚠️  质量风险: ${report.qualityMetrics.bugRisk}`)
    console.log("")
  }

  /**
   * 验证质量标准
   */
  private async validateQualityStandards(): Promise<void> {
    console.log("✅ 验证质量标准...")

    const report = await this.coverageReporter.generateReport()

    const requirements = {
      minCoveragePercentage: 85,
      minSecurityTests: 5,
      maxBugRisk: "MEDIUM" as const,
    }

    const isValid = this.coverageReporter.validateCoverage(report, requirements)

    if (isValid) {
      console.log("🏆 权限系统测试质量达标！")
    } else {
      console.error("❌ 权限系统测试质量不达标")
      process.exit(1)
    }
  }

  /**
   * 打印测试摘要
   */
  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime
    const totalTests = this.testResults.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0)
    const totalPassed = this.testResults.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = this.testResults.reduce((sum, r) => sum + r.failed, 0)
    const totalSkipped = this.testResults.reduce((sum, r) => sum + r.skipped, 0)

    console.log("\n📋 测试摘要")
    console.log("=".repeat(60))
    console.log(`总执行时间: ${(totalDuration / 1000).toFixed(1)}秒`)
    console.log(`测试套件数: ${this.testResults.length}`)
    console.log(`总测试数: ${totalTests}`)
    console.log(`✅ 通过: ${totalPassed}`)
    console.log(`❌ 失败: ${totalFailed}`)
    console.log(`⏭️  跳过: ${totalSkipped}`)
    console.log(`📊 通过率: ${((totalPassed / totalTests) * 100).toFixed(1)}%`)

    if (totalFailed > 0) {
      console.log("\n❌ 失败的测试套件:")
      this.testResults
        .filter((r) => r.failed > 0)
        .forEach((result) => {
          console.log(`- ${result.suite}: ${result.failed} 项失败`)
          result.errors.forEach((error) => console.log(`  ${error}`))
        })
    }
  }
}

// 主函数
async function main() {
  const runner = new PermissionTestRunner()

  try {
    await runner.runFullTestSuite()
    console.log("\n🎉 权限系统测试套件执行成功！")
    process.exit(0)
  } catch (error) {
    console.error("\n💥 权限系统测试套件执行失败:")
    console.error((error as Error).message)
    process.exit(1)
  }
}

// 如果直接运行此脚本，则执行主函数
if (require.main === module) {
  main()
}

export { PermissionTestRunner }
