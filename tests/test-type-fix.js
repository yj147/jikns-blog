/**
 * 快速修复测试类型问题的脚本
 */

const fs = require("fs")
const path = require("path")
const { glob } = require("glob")

async function fixTestFiles() {
  // 查找所有测试文件
  const testFiles = await glob("tests/**/*.test.ts", { cwd: __dirname + "/.." })

  for (const file of testFiles) {
    const filePath = path.join(__dirname, "..", file)
    let content = fs.readFileSync(filePath, "utf8")
    let modified = false

    // 替换所有 mockPrisma.user.method.mockResolvedValue 调用
    content = content.replace(
      /mockPrisma\.user\.(\w+)\.mockResolvedValue/g,
      "(mockPrisma.user.$1 as any).mockResolvedValue"
    )

    // 替换所有 mockPrisma.user.method.mockRejectedValue 调用
    content = content.replace(
      /mockPrisma\.user\.(\w+)\.mockRejectedValue/g,
      "(mockPrisma.user.$1 as any).mockRejectedValue"
    )

    // 替换所有其他 mockPrisma.model.method.mock* 调用
    content = content.replace(
      /mockPrisma\.(\w+)\.(\w+)\.mock(Resolved|Rejected)Value/g,
      "(mockPrisma.$1.$2 as any).mock$3Value"
    )

    if (content !== fs.readFileSync(filePath, "utf8")) {
      fs.writeFileSync(filePath, content)
      console.log(`Fixed ${file}`)
      modified = true
    }
  }

  console.log("Test type fixes completed")
}

// 执行修复
fixTestFiles().catch(console.error)
