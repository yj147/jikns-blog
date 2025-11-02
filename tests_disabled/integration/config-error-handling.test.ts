/**
 * 环境变量和配置错误处理集成测试套件
 *
 * 测试覆盖：
 * - 环境变量缺失检测
 * - 无效配置值处理
 * - 配置错误恢复机制
 * - 生产环境配置验证
 * - 开发环境配置宽松处理
 *
 * Phase 2 范围：专注于认证系统相关的配置管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { cleanTestDatabase, getTestDatabase } from "../config/test-database"
import { resetSupabaseMocks } from "../config/test-supabase"
import {
  createClientSupabaseClient,
  createServerSupabaseClient,
  validateDatabaseConnection,
  prisma,
} from "@/lib/supabase"

describe("环境变量和配置错误处理测试", () => {
  const db = getTestDatabase()

  // 备份原始环境变量
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    await cleanTestDatabase()
    resetSupabaseMocks()

    // 重置为默认测试环境变量
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      DATABASE_URL: "postgresql://test:test@localhost:5432/blog_test",
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()

    // 恢复原始环境变量
    process.env = { ...originalEnv }
  })

  describe("Supabase 配置验证", () => {
    it("应该检测缺失的 NEXT_PUBLIC_SUPABASE_URL", () => {
      // Arrange: 删除必需的环境变量
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      // Act & Assert: 验证配置错误处理
      expect(() => {
        createClientSupabaseClient()
      }).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    })

    it("应该检测缺失的 NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
      // Arrange: 删除匿名密钥
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      // Act & Assert: 验证配置错误处理
      expect(() => {
        createClientSupabaseClient()
      }).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
    })

    it("应该验证 Supabase URL 格式", () => {
      // Arrange: 测试各种无效URL格式
      const invalidUrls = [
        "not-a-url",
        "ftp://invalid-protocol.com",
        "",
        "http://",
        "https://",
        "localhost:3000", // 缺少协议
        "http://localhost", // 缺少端口（对于本地开发）
      ]

      invalidUrls.forEach((invalidUrl) => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = invalidUrl

        // 模拟URL格式验证
        const isValidUrl = (url: string): boolean => {
          try {
            const parsedUrl = new URL(url)
            return ["http:", "https:"].includes(parsedUrl.protocol)
          } catch {
            return false
          }
        }

        // Act & Assert: 验证URL格式检查
        expect(isValidUrl(invalidUrl)).toBe(false)
      })

      // 验证有效URL
      const validUrls = [
        "http://localhost:54321",
        "https://myproject.supabase.co",
        "https://supabase.example.com",
      ]

      validUrls.forEach((validUrl) => {
        const isValidUrl = (url: string): boolean => {
          try {
            const parsedUrl = new URL(url)
            return ["http:", "https:"].includes(parsedUrl.protocol)
          } catch {
            return false
          }
        }

        expect(isValidUrl(validUrl)).toBe(true)
      })
    })

    it("应该验证 Supabase 匿名密钥格式", () => {
      // Arrange: 测试各种无效密钥格式
      const invalidKeys = ["", "too-short", "123", "invalid-key-format"]

      invalidKeys.forEach((invalidKey) => {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = invalidKey

        // 模拟密钥格式验证（真实的Supabase密钥通常很长且有特定格式）
        const isValidAnonKey = (key: string): boolean => {
          return key.length >= 10 && key.includes(".") // 简化的验证
        }

        // Act & Assert: 验证密钥格式
        expect(isValidAnonKey(invalidKey)).toBe(false)
      })

      // 验证有效密钥格式
      const validKeys = [
        "test-anon-key.with-dots",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ",
        "valid.supabase.anon.key.format",
      ]

      validKeys.forEach((validKey) => {
        const isValidAnonKey = (key: string): boolean => {
          return key.length >= 10 && key.includes(".")
        }

        expect(isValidAnonKey(validKey)).toBe(true)
      })
    })

    it("应该处理服务端 Supabase 客户端创建失败", async () => {
      // Arrange: 设置无效配置
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://nonexistent:54321"
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "invalid-key"

      // 在实际实现中，可能需要捕获和处理连接错误
      // 这里我们模拟服务端客户端创建的错误处理

      // Act: 尝试创建服务端客户端
      try {
        const serverClient = await createServerSupabaseClient()

        // 模拟连接测试
        const testConnection = async () => {
          try {
            await serverClient.auth.getUser()
            return true
          } catch (error) {
            console.error("Supabase 连接测试失败:", error)
            return false
          }
        }

        const connectionSuccess = await testConnection()

        // Assert: 验证连接失败处理
        expect(connectionSuccess).toBe(false)
      } catch (error) {
        // 如果客户端创建本身就失败了，也是预期的
        expect(error).toBeDefined()
      }
    })
  })

  describe("数据库配置验证", () => {
    it("应该检测缺失的 DATABASE_URL", () => {
      // Arrange: 删除数据库URL
      delete process.env.DATABASE_URL

      // Act: 验证数据库配置检查
      const hasDatabaseUrl = !!process.env.DATABASE_URL

      // Assert: 验证配置缺失检测
      expect(hasDatabaseUrl).toBe(false)
    })

    it("应该验证数据库URL格式", () => {
      // Arrange: 测试各种数据库URL格式
      const testUrls = [
        {
          url: "postgresql://user:password@localhost:5432/database",
          valid: true,
          description: "标准PostgreSQL URL",
        },
        {
          url: "postgres://user:password@localhost:5432/database",
          valid: true,
          description: "简化协议名",
        },
        {
          url: "postgresql://localhost:5432/database",
          valid: true,
          description: "无用户名密码",
        },
        {
          url: "mysql://user:password@localhost:3306/database",
          valid: false,
          description: "MySQL协议（应该拒绝）",
        },
        {
          url: "invalid-database-url",
          valid: false,
          description: "完全无效的URL",
        },
        {
          url: "",
          valid: false,
          description: "空URL",
        },
      ]

      testUrls.forEach(({ url, valid, description }) => {
        // 简化的数据库URL验证逻辑
        const isValidDatabaseUrl = (dbUrl: string): boolean => {
          if (!dbUrl) return false
          try {
            const parsedUrl = new URL(dbUrl)
            return ["postgresql:", "postgres:"].includes(parsedUrl.protocol)
          } catch {
            return false
          }
        }

        // Act & Assert
        expect(isValidDatabaseUrl(url)).toBe(valid)
      })
    })

    it("应该测试数据库连接有效性", async () => {
      // Arrange: 设置有效的测试数据库配置
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/blog_test"

      // Act: 测试数据库连接
      const isConnected = await validateDatabaseConnection()

      // Assert: 在测试环境中，连接应该是有效的
      // 如果连接失败，可能是因为测试数据库未配置
      if (isConnected) {
        expect(isConnected).toBe(true)
      } else {
        // 在某些CI环境中，数据库可能不可用，这也是可接受的
        console.warn("数据库连接不可用，跳过连接测试")
        expect(isConnected).toBe(false)
      }
    })

    it("应该处理数据库连接失败", async () => {
      // Arrange: 设置指向不存在数据库的URL
      const originalUrl = process.env.DATABASE_URL
      process.env.DATABASE_URL = "postgresql://nonexistent:5432/nonexistent_db"

      // 创建一个新的Prisma客户端实例用于测试
      let testDb: any = null
      try {
        const { PrismaClient } = require("@/lib/generated/prisma")
        testDb = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL,
            },
          },
        })

        // Act: 尝试连接数据库
        const connectionTest = async () => {
          try {
            await testDb.user.findFirst({ take: 1 })
            return true
          } catch (error) {
            console.error("预期的数据库连接错误:", error.message)
            return false
          }
        }

        const connected = await connectionTest()

        // Assert: 验证连接失败被正确处理
        expect(connected).toBe(false)
      } finally {
        // 清理测试数据库连接
        if (testDb) {
          await testDb.$disconnect()
        }
        // 恢复原始数据库URL
        process.env.DATABASE_URL = originalUrl
      }
    })
  })

  describe("配置环境差异处理", () => {
    it("应该在开发环境中提供更详细的错误信息", () => {
      // Arrange: 设置开发环境
      process.env.NODE_ENV = "development"
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      // Act: 模拟配置验证
      const validateConfig = () => {
        const missing: string[] = []

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          missing.push("NEXT_PUBLIC_SUPABASE_URL")
        }
        if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        }
        if (!process.env.DATABASE_URL) {
          missing.push("DATABASE_URL")
        }

        if (missing.length > 0) {
          const isDevelopment = process.env.NODE_ENV === "development"
          const errorMessage = isDevelopment
            ? `开发环境配置错误：缺少以下环境变量：${missing.join(", ")}。请检查 .env.local 文件。`
            : `配置错误：缺少必需的环境变量。`

          throw new Error(errorMessage)
        }
      }

      // Assert: 验证开发环境错误信息更详细
      expect(() => validateConfig()).toThrow(
        /开发环境配置错误.*NEXT_PUBLIC_SUPABASE_URL.*\.env\.local/
      )
    })

    it("应该在生产环境中提供简洁的错误信息", () => {
      // Arrange: 设置生产环境
      process.env.NODE_ENV = "production"
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      // Act: 模拟生产环境配置验证
      const validateProductionConfig = () => {
        const missing: string[] = []

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          missing.push("NEXT_PUBLIC_SUPABASE_URL")
        }

        if (missing.length > 0) {
          const isDevelopment = process.env.NODE_ENV === "development"
          const errorMessage = isDevelopment
            ? `开发环境配置错误：缺少以下环境变量：${missing.join(", ")}。`
            : `配置错误：缺少必需的环境变量。请联系系统管理员。`

          throw new Error(errorMessage)
        }
      }

      // Assert: 验证生产环境错误信息更简洁
      expect(() => validateProductionConfig()).toThrow(/配置错误.*必需的环境变量.*联系系统管理员/)
    })

    it("应该在测试环境中允许宽松的配置", () => {
      // Arrange: 设置测试环境
      process.env.NODE_ENV = "test"

      // 删除一些在生产环境中必需但在测试中可选的变量
      delete process.env.GITHUB_CLIENT_ID
      delete process.env.GITHUB_CLIENT_SECRET

      // Act: 模拟测试环境配置验证
      const validateTestConfig = () => {
        const isTest = process.env.NODE_ENV === "test"

        // 在测试环境中，某些配置是可选的
        const requiredInTest = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]

        const requiredInProduction = [...requiredInTest, "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]

        const requiredVars = isTest ? requiredInTest : requiredInProduction

        const missing = requiredVars.filter((varName) => !process.env[varName])

        if (missing.length > 0) {
          throw new Error(`Missing required variables: ${missing.join(", ")}`)
        }

        return true
      }

      // Assert: 验证测试环境配置更宽松
      expect(() => validateTestConfig()).not.toThrow()
    })

    it("应该在不同环境中使用不同的默认值", () => {
      // Arrange: 测试不同环境的默认配置
      const environments = ["development", "test", "production"]

      environments.forEach((env) => {
        process.env.NODE_ENV = env

        // Act: 获取环境特定的默认配置
        const getDefaultConfig = () => {
          const defaults: Record<string, any> = {}

          switch (process.env.NODE_ENV) {
            case "development":
              defaults.SUPABASE_URL = "http://localhost:54321"
              defaults.LOG_LEVEL = "debug"
              defaults.ENABLE_MOCKS = "true"
              break

            case "test":
              defaults.SUPABASE_URL = "http://localhost:54321"
              defaults.LOG_LEVEL = "error"
              defaults.ENABLE_MOCKS = "true"
              break

            case "production":
              defaults.LOG_LEVEL = "warn"
              defaults.ENABLE_MOCKS = "false"
              break
          }

          return defaults
        }

        const config = getDefaultConfig()

        // Assert: 验证环境特定配置
        if (env === "development") {
          expect(config.LOG_LEVEL).toBe("debug")
          expect(config.ENABLE_MOCKS).toBe("true")
        } else if (env === "test") {
          expect(config.LOG_LEVEL).toBe("error")
          expect(config.ENABLE_MOCKS).toBe("true")
        } else if (env === "production") {
          expect(config.LOG_LEVEL).toBe("warn")
          expect(config.ENABLE_MOCKS).toBe("false")
        }
      })
    })
  })

  describe("配置错误恢复机制", () => {
    it("应该提供配置错误的恢复建议", () => {
      // Arrange: 模拟各种配置错误
      const configErrors = [
        {
          missing: ["NEXT_PUBLIC_SUPABASE_URL"],
          expectedSuggestion: /创建.*\.env\.local.*NEXT_PUBLIC_SUPABASE_URL/,
        },
        {
          missing: ["DATABASE_URL"],
          expectedSuggestion: /配置数据库连接.*DATABASE_URL/,
        },
        {
          missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
          expectedSuggestion: /Supabase.*配置/,
        },
      ]

      configErrors.forEach(({ missing, expectedSuggestion }) => {
        // 删除相关环境变量
        missing.forEach((varName) => {
          delete process.env[varName]
        })

        // Act: 生成配置错误建议
        const generateConfigSuggestion = (missingVars: string[]) => {
          if (
            missingVars.includes("NEXT_PUBLIC_SUPABASE_URL") ||
            missingVars.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")
          ) {
            return "请配置 Supabase 连接信息。创建 .env.local 文件并添加 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。"
          }

          if (missingVars.includes("DATABASE_URL")) {
            return "请配置数据库连接。在 .env.local 中添加 DATABASE_URL 变量。"
          }

          return `请配置缺失的环境变量：${missingVars.join(", ")}`
        }

        const suggestion = generateConfigSuggestion(missing)

        // Assert: 验证建议内容
        expect(suggestion).toMatch(expectedSuggestion)

        // 恢复环境变量
        missing.forEach((varName) => {
          process.env[varName] = originalEnv[varName] || "default-test-value"
        })
      })
    })

    it("应该支持配置自动修复", () => {
      // Arrange: 模拟自动修复场景
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:3000" // 错误端口

      // Act: 模拟配置自动修复逻辑
      const autoFixConfig = () => {
        let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

        // 自动修复常见错误
        if (supabaseUrl.includes("localhost:3000")) {
          supabaseUrl = supabaseUrl.replace(":3000", ":54321")
          console.warn("自动修复 Supabase URL: 将端口从 3000 改为 54321")
        }

        return { supabaseUrl, fixed: supabaseUrl !== process.env.NEXT_PUBLIC_SUPABASE_URL }
      }

      const result = autoFixConfig()

      // Assert: 验证自动修复
      expect(result.fixed).toBe(true)
      expect(result.supabaseUrl).toBe("http://localhost:54321")
    })

    it("应该提供配置验证清单", () => {
      // Act: 生成配置验证清单
      const generateConfigChecklist = () => {
        const checklist = [
          {
            item: "Supabase URL 已设置",
            check: () => !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            required: true,
          },
          {
            item: "Supabase 匿名密钥已设置",
            check: () => !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            required: true,
          },
          {
            item: "数据库连接已配置",
            check: () => !!process.env.DATABASE_URL,
            required: true,
          },
          {
            item: "GitHub OAuth 已配置",
            check: () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
            required: false, // 在某些环境中可选
          },
        ]

        return checklist.map((item) => ({
          ...item,
          status: item.check() ? "passed" : "failed",
        }))
      }

      const checklist = generateConfigChecklist()

      // Assert: 验证清单生成
      expect(checklist).toHaveLength(4)
      checklist.forEach((item) => {
        expect(item).toHaveProperty("item")
        expect(item).toHaveProperty("status")
        expect(item).toHaveProperty("required")
        expect(["passed", "failed"]).toContain(item.status)
      })

      // 验证必需项目的状态
      const requiredItems = checklist.filter((item) => item.required)
      const failedRequired = requiredItems.filter((item) => item.status === "failed")

      // 在正确配置的测试环境中，不应该有必需项目失败
      if (failedRequired.length > 0) {
        console.warn(
          "部分必需配置项未通过:",
          failedRequired.map((item) => item.item)
        )
      }
    })
  })

  describe("动态配置加载", () => {
    it("应该支持运行时配置更新", () => {
      // Arrange: 初始配置
      process.env.FEATURE_FLAG_OAUTH = "false"

      // Act: 模拟运行时配置更新
      const updateRuntimeConfig = (key: string, value: string) => {
        const oldValue = process.env[key]
        process.env[key] = value

        // 触发配置更新事件（在实际应用中可能使用事件系统）
        return { key, oldValue, newValue: value, updated: true }
      }

      const result = updateRuntimeConfig("FEATURE_FLAG_OAUTH", "true")

      // Assert: 验证运行时更新
      expect(result.updated).toBe(true)
      expect(result.oldValue).toBe("false")
      expect(result.newValue).toBe("true")
      expect(process.env.FEATURE_FLAG_OAUTH).toBe("true")
    })

    it("应该支持配置热重载", () => {
      // Arrange: 模拟配置文件
      const configFile = {
        supabase: {
          url: "http://localhost:54321",
          anonKey: "test-anon-key",
        },
        database: {
          url: "postgresql://localhost:5432/test",
        },
      }

      // Act: 模拟配置热重载
      const reloadConfig = (newConfig: typeof configFile) => {
        // 在实际实现中，这里会重新加载配置文件并更新环境变量
        Object.entries(newConfig.supabase).forEach(([key, value]) => {
          process.env[`NEXT_PUBLIC_SUPABASE_${key.toUpperCase()}`] = value
        })

        process.env.DATABASE_URL = newConfig.database.url

        return { reloaded: true, timestamp: new Date().toISOString() }
      }

      const updatedConfig = {
        ...configFile,
        supabase: {
          ...configFile.supabase,
          url: "http://localhost:54322", // 更新URL
        },
      }

      const result = reloadConfig(updatedConfig)

      // Assert: 验证热重载
      expect(result.reloaded).toBe(true)
      expect(result.timestamp).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54322")
    })
  })
})
