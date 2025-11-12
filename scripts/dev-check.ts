#!/usr/bin/env node

/**
 * 开发环境健诊脚本
 * 检查并验证开发环境配置，避免常见的 "Failed to fetch" 类错误
 *
 * 使用方法：
 * - pnpm dev:check
 * - node scripts/dev-check.js
 */

import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"
import * as dotenv from "dotenv"

// 加载环境变量
dotenv.config({ path: ".env.local" })

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

// 状态图标
const icons = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  loading: "⏳",
}

// 日志输出函数
function log(message: string, type: "success" | "error" | "warning" | "info" = "info") {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.cyan,
  }[type]

  const icon = icons[type]
  console.log(`${color}${icon} ${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(60))
  console.log(`${colors.blue}📋 ${title}${colors.reset}`)
  console.log("=".repeat(60))
}

// 检查结果接口
interface CheckResult {
  passed: boolean
  message: string
  fix?: string
}

// 检查函数集合
const checks = {
  // 1. 检查必要的环境变量
  async checkEnvironmentVariables(): Promise<CheckResult> {
    const requiredVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "DATABASE_URL",
      "DIRECT_URL",
    ]

    const missingVars = requiredVars.filter((varName) => !process.env[varName])

    if (missingVars.length > 0) {
      return {
        passed: false,
        message: `缺少必要的环境变量: ${missingVars.join(", ")}`,
        fix: `请在 .env.local 文件中添加以下环境变量：\n${missingVars.map((v) => `${v}=your_value_here`).join("\n")}`,
      }
    }

    // 验证 Supabase URL 格式
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && !supabaseUrl.startsWith("http")) {
      return {
        passed: false,
        message: "NEXT_PUBLIC_SUPABASE_URL 格式不正确",
        fix: "URL 应该以 http:// 或 https:// 开头",
      }
    }

    return {
      passed: true,
      message: "所有必要的环境变量已配置",
    }
  },

  // 2. 检查 Supabase 连接
  async checkSupabaseConnection(): Promise<CheckResult> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      return {
        passed: false,
        message: "Supabase 配置缺失",
        fix: "请配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY",
      }
    }

    try {
      // 尝试访问 Supabase 健康检查端点
      const response = await fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      })

      if (response.ok) {
        return {
          passed: true,
          message: "Supabase 连接正常",
        }
      } else {
        return {
          passed: false,
          message: `Supabase 连接失败: HTTP ${response.status}`,
          fix: "请检查 Supabase URL 和 API Key 是否正确",
        }
      }
    } catch (error) {
      // 检查是否是本地 Supabase
      if (url.includes("localhost") || url.includes("127.0.0.1")) {
        return {
          passed: false,
          message: "Supabase 本地服务未运行",
          fix: "请运行 `pnpm supabase:start` 启动本地 Supabase 服务",
        }
      }

      return {
        passed: false,
        message: `Supabase 连接错误: ${error instanceof Error ? error.message : "未知错误"}`,
        fix: "请检查网络连接和 Supabase 配置",
      }
    }
  },

  // 3. 检查数据库连接
  async checkDatabaseConnection(): Promise<CheckResult> {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      return {
        passed: false,
        message: "DATABASE_URL 未配置",
        fix: "请在 .env.local 中配置 DATABASE_URL",
      }
    }

    try {
      // 使用 Prisma CLI 测试连接
      execSync('npx prisma db execute --stdin <<< "SELECT 1"', {
        stdio: "pipe",
        encoding: "utf-8",
      })

      return {
        passed: true,
        message: "数据库连接正常",
      }
    } catch (error) {
      return {
        passed: false,
        message: "数据库连接失败",
        fix: "请检查 DATABASE_URL 配置是否正确，并确保数据库服务正在运行",
      }
    }
  },

  // 4. 检查 Node.js 版本
  async checkNodeVersion(): Promise<CheckResult> {
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.split(".")[0].substring(1))

    if (majorVersion < 18) {
      return {
        passed: false,
        message: `Node.js 版本过低: ${nodeVersion}`,
        fix: "请升级到 Node.js 18 或更高版本",
      }
    }

    return {
      passed: true,
      message: `Node.js 版本: ${nodeVersion}`,
    }
  },

  // 5. 检查包管理器
  async checkPackageManager(): Promise<CheckResult> {
    try {
      execSync("pnpm --version", { stdio: "pipe" })
      return {
        passed: true,
        message: "使用 pnpm 包管理器",
      }
    } catch {
      return {
        passed: false,
        message: "pnpm 未安装",
        fix: "请安装 pnpm: npm install -g pnpm",
      }
    }
  },

  // 6. 检查依赖安装
  async checkDependencies(): Promise<CheckResult> {
    const nodeModulesPath = path.join(process.cwd(), "node_modules")

    if (!fs.existsSync(nodeModulesPath)) {
      return {
        passed: false,
        message: "node_modules 不存在",
        fix: "请运行 `pnpm install` 安装依赖",
      }
    }

    // 检查关键依赖
    const criticalDeps = ["next", "react", "prisma", "@supabase/supabase-js"]
    const missingDeps = criticalDeps.filter(
      (dep) => !fs.existsSync(path.join(nodeModulesPath, dep))
    )

    if (missingDeps.length > 0) {
      return {
        passed: false,
        message: `缺少关键依赖: ${missingDeps.join(", ")}`,
        fix: "请运行 `pnpm install` 重新安装依赖",
      }
    }

    return {
      passed: true,
      message: "所有关键依赖已安装",
    }
  },

  // 7. 检查 Prisma 配置
  async checkPrismaSetup(): Promise<CheckResult> {
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")

    if (!fs.existsSync(schemaPath)) {
      return {
        passed: false,
        message: "Prisma schema 文件不存在",
        fix: "请确保 prisma/schema.prisma 文件存在",
      }
    }

    try {
      // 检查 Prisma Client 是否生成
      execSync("npx prisma generate --help", { stdio: "pipe" })

      const prismaClientPath = path.join(process.cwd(), "node_modules", ".prisma", "client")
      if (!fs.existsSync(prismaClientPath)) {
        return {
          passed: false,
          message: "Prisma Client 未生成",
          fix: "请运行 `pnpm db:generate` 生成 Prisma Client",
        }
      }

      return {
        passed: true,
        message: "Prisma 配置正常",
      }
    } catch {
      return {
        passed: false,
        message: "Prisma CLI 不可用",
        fix: "请运行 `pnpm install` 安装 Prisma",
      }
    }
  },

  // 8. 检查端口占用
  async checkPortAvailability(): Promise<CheckResult> {
    const port = process.env.PORT || "3999"

    try {
      // 尝试检查端口是否被占用
      execSync(`lsof -i:${port}`, { stdio: "pipe" })
      return {
        passed: false,
        message: `端口 ${port} 已被占用`,
        fix: `请停止占用端口 ${port} 的服务，或修改 PORT 环境变量`,
      }
    } catch {
      // 命令失败说明端口未被占用（这是好事）
      return {
        passed: true,
        message: `端口 ${port} 可用`,
      }
    }
  },

  // 9. 检查本地 Supabase 状态
  async checkLocalSupabaseStatus(): Promise<CheckResult> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    // 只有当使用本地 Supabase 时才检查
    if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
      return {
        passed: true,
        message: "使用远程 Supabase 服务",
      }
    }

    try {
      execSync("supabase status", { stdio: "pipe" })
      return {
        passed: true,
        message: "本地 Supabase 服务运行中",
      }
    } catch {
      return {
        passed: false,
        message: "本地 Supabase 服务未运行",
        fix: "请运行 `pnpm supabase:start` 启动本地 Supabase 服务",
      }
    }
  },
}

// 主函数
async function main() {
  console.log(`${colors.cyan}🏥 开发环境健康检查${colors.reset}`)
  console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}`)

  let hasErrors = false
  const results: Array<{ name: string; result: CheckResult }> = []

  // 运行所有检查
  for (const [name, check] of Object.entries(checks)) {
    const displayName = name
      .replace(/^check/, "")
      .replace(/([A-Z])/g, " $1")
      .trim()

    process.stdout.write(`${colors.cyan}${icons.loading} 检查 ${displayName}...${colors.reset}`)

    try {
      const result = await check()
      results.push({ name: displayName, result })

      // 清除当前行并显示结果
      process.stdout.write("\r" + " ".repeat(80) + "\r")

      if (result.passed) {
        log(result.message, "success")
      } else {
        log(result.message, "error")
        hasErrors = true
      }
    } catch (error) {
      process.stdout.write("\r" + " ".repeat(80) + "\r")
      log(`检查失败: ${error instanceof Error ? error.message : "未知错误"}`, "error")
      hasErrors = true
    }
  }

  // 显示修复建议
  if (hasErrors) {
    logSection("修复建议")

    for (const { name, result } of results) {
      if (!result.passed && result.fix) {
        console.log(`\n${colors.yellow}🔧 ${name}:${colors.reset}`)
        console.log(`   ${result.fix}`)
      }
    }

    console.log(`\n${colors.red}❌ 环境检查未通过，请根据上述建议修复问题${colors.reset}`)
    process.exit(1)
  } else {
    logSection("检查通过")
    console.log(`${colors.green}✨ 所有检查通过！开发环境配置正确。${colors.reset}`)
    console.log(`${colors.green}可以运行 \`pnpm dev\` 启动开发服务器${colors.reset}`)
  }
}

// 运行检查
main().catch((error) => {
  console.error(`${colors.red}检查过程出错:${colors.reset}`, error)
  process.exit(1)
})
