// 测试混合分词策略
import { tokenizeText } from "@/lib/search/tokenizer"

const testCases = [
  "Next.js",
  "Next.js全栈开发",
  "Next.js 全栈开发实战指南",
  "全栈开发",
  "系统管理员",
  "React和Vue的对比",
  "现代Web应用构建",
]

console.log("=== 测试混合分词策略（英文保护 + 中文分词）===\n")

testCases.forEach((text) => {
  const result = tokenizeText(text)
  console.log(`"${text}"`)
  console.log(`  → "${result}"`)
  console.log()
})
