// 直接测试 nodejieba 的行为，诊断为什么 cutForSearch 产生字符级分词
const nodejieba = require("nodejieba")

const testCases = [
  "Next.js",
  "Next.js全栈开发",
  "全栈开发实战指南",
  "从零到生产环境",
  "现代Web应用构建",
]

console.log("=== 测试 nodejieba.cutForSearch() ===\n")
testCases.forEach((text) => {
  const result = nodejieba.cutForSearch(text)
  console.log(`"${text}":`)
  console.log(`  结果: [${result.join(", ")}]`)
  console.log(`  拼接: "${result.join(" ")}"`)
  console.log()
})

console.log("\n=== 测试 nodejieba.cut() ===\n")
testCases.forEach((text) => {
  const result = nodejieba.cut(text)
  console.log(`"${text}":`)
  console.log(`  结果: [${result.join(", ")}]`)
  console.log(`  拼接: "${result.join(" ")}"`)
  console.log()
})

console.log("\n=== 测试 basicTokenize 逻辑 ===\n")
function basicTokenize(input: string): string {
  return input
    .split(/[\s,，。.!?？；;、"'""''()（）[\]{}<>《》|\\\/\-_=+]+/)
    .map((token) => {
      const trimmed = token.trim()
      return trimmed.length >= 1 ? trimmed : null
    })
    .filter((token): token is string => Boolean(token))
    .join(" ")
}

testCases.forEach((text) => {
  const result = basicTokenize(text)
  console.log(`"${text}": "${result}"`)
})
