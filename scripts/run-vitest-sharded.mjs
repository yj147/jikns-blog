#!/usr/bin/env node
// 目的：在大规模测试套件上自动分片执行 Vitest，避免单进程堆内存溢出

import { spawnSync } from "node:child_process"
import path from "node:path"

const args = process.argv.slice(2)

const hasShardFlag = args.some((arg) => arg.startsWith("--shard"))
const isWatch = args.includes("--watch") || args.includes("-w")

// 粗略判断是否传入了具体文件/目录过滤器
const positionalArgs = args.filter((arg) => !arg.startsWith("-") && arg !== "run")
const hasExplicitFiles = positionalArgs.some((arg) => /\.|\//.test(arg))

const shouldShard = !hasShardFlag && !isWatch && !hasExplicitFiles

const vitestBin = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest"
)

function runVitest(extraArgs) {
  const result = spawnSync(vitestBin, extraArgs, {
    stdio: "inherit",
    env: process.env,
  })

  if (result.error) {
    console.error("Failed to start vitest:", result.error)
    return 1
  }

  return result.status ?? 1
}

// 显式传入测试文件时，为避免跨文件 mock 污染，逐文件串行执行
if (hasExplicitFiles && !isWatch) {
  const baseArgs = args.filter((arg) => arg.startsWith("-") || arg === "run" || arg === "--reporter=basic")
  for (const file of positionalArgs) {
    const code = runVitest([...baseArgs, file])
    if (code !== 0) {
      process.exit(code)
    }
  }
  process.exit(0)
}

if (shouldShard) {
  const shards = ["1/4", "2/4", "3/4", "4/4"]
  for (const shard of shards) {
    // 强制 run 模式，避免与 watch 冲突
    const code = runVitest(["run", ...args, `--shard=${shard}`])
    if (code !== 0) {
      process.exit(code)
    }
  }
  process.exit(0)
} else {
  process.exit(runVitest(args))
}
