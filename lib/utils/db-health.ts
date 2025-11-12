/**
 * 数据库健康检查工具
 * 检查 PostgreSQL 扩展是否可用
 */

import "server-only"
import { prisma } from "@/lib/prisma"

export interface DbHealthStatus {
  healthy: boolean
  extensions: {
    pg_trgm: boolean
    tsvector: boolean
  }
  errors: string[]
}

/**
 * 检查数据库扩展健康状态
 */
export async function checkDbHealth(): Promise<DbHealthStatus> {
  const errors: string[] = []
  let pg_trgm = false
  let tsvector = false

  try {
    // 检查 pg_trgm 扩展
    const trgmResult = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
    `
    pg_trgm = trgmResult.length > 0

    if (!pg_trgm) {
      errors.push("pg_trgm extension is not installed")
    }
  } catch (error) {
    errors.push(
      `Failed to check pg_trgm: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  try {
    // 检查 tsvector 功能（内置功能，检查是否可用）
    await prisma.$queryRaw`
      SELECT to_tsvector('simple', 'test')
    `
    tsvector = true
  } catch (error) {
    tsvector = false
    errors.push(
      `tsvector function is not available: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  return {
    healthy: pg_trgm && tsvector && errors.length === 0,
    extensions: {
      pg_trgm,
      tsvector,
    },
    errors,
  }
}

/**
 * 检查特定扩展是否可用
 */
export async function checkExtension(extensionName: "pg_trgm" | "tsvector"): Promise<boolean> {
  try {
    if (extensionName === "pg_trgm") {
      const result = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
      `
      return result.length > 0
    } else {
      await prisma.$queryRaw`SELECT to_tsvector('simple', 'test')`
      return true
    }
  } catch {
    return false
  }
}

/**
 * 获取数据库扩展安装指南
 */
export function getExtensionInstallGuide(extensionName: "pg_trgm" | "tsvector"): string {
  if (extensionName === "pg_trgm") {
    return `
To install pg_trgm extension:
1. Connect to your PostgreSQL database as superuser
2. Run: CREATE EXTENSION IF NOT EXISTS pg_trgm;
3. Verify: SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
    `.trim()
  } else {
    return `
tsvector is a built-in PostgreSQL feature.
If it's not available, your PostgreSQL version might be too old.
Minimum required version: PostgreSQL 9.6+
    `.trim()
  }
}
