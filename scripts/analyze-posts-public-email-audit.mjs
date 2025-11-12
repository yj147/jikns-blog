#!/usr/bin/env node

import { readFile, writeFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const auditLogPath = path.join(process.cwd(), "monitoring-data", "posts-public-email-audit.log")
  const reportPath = path.join(
    process.cwd(),
    "monitoring-data",
    `posts-public-email-audit-report-${new Date().toISOString().slice(0, 10)}.json`
  )

  let content
  try {
    content = await readFile(auditLogPath, "utf8")
  } catch (error) {
    console.error(`未找到审计日志文件: ${auditLogPath}`)
    throw error
  }

  const entries = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        console.warn("无法解析的日志行", line)
        return null
      }
    })
    .filter((entry) => Boolean(entry))

  const clients = new Map()

  for (const entry of entries) {
    const referer = entry.referer || "<unknown>"
    const userAgent = entry.userAgent || "<unknown>"
    const key = `${referer}|||${userAgent}`
    const summary = clients.get(key) || {
      referer,
      userAgent,
      requests: 0,
      totalPosts: 0,
      containsEmail: false,
    }

    summary.requests += 1
    summary.totalPosts += entry.returnedPosts
    summary.containsEmail = summary.containsEmail || entry.containsAuthorEmail

    clients.set(key, summary)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalRequests: entries.length,
    clients: Array.from(clients.values()).sort((a, b) => b.requests - a.requests),
  }

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")
  console.log(`审计报告已生成: ${reportPath}`)
}

main().catch((error) => {
  console.error("生成审计报告失败", error)
  process.exitCode = 1
})
