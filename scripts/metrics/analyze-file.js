#!/usr/bin/env node
/*
 * 简单的 TS/TSX 源码分析器（启发式）
 * - 统计：函数数量、每个函数 LOC、估算圈复杂度、估算最大嵌套深度
 * - 统计：文件级重复行比例（忽略空行与导入行）
 * 说明：为代码审查提供可复现的数据支撑，并不用于生产构建
 */

const fs = require("fs")
const path = require("path")

function readFile(p) {
  return fs.readFileSync(p, "utf8")
}

function stripCommentsAndStrings(src) {
  // 粗略移除块注释、行注释与字符串字面量，降低误判
  let s = src
  // 移除块注释
  s = s.replace(/\/\*[\s\S]*?\*\//g, "")
  // 移除行注释
  s = s.replace(/(^|[^:])\/\/.*$/gm, "$1")
  // 移除模板字符串（保留换行）
  s = s.replace(/`[\s\S]*?`/g, "``")
  // 移除普通字符串
  s = s.replace(/'(?:\\.|[^'\\])*'/g, "''")
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '""')
  return s
}

function findFunctions(src) {
  // 匹配常见函数定义：function 声明、export default function、箭头函数赋值
  const patterns = [
    { type: "func", re: /export\s+default\s+function\s+([A-Za-z_$][\w$]*)?\s*\(/g },
    { type: "func", re: /export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g },
    { type: "func", re: /function\s+([A-Za-z_$][\w$]*)\s*\(/g },
    {
      type: "arrow",
      re: /export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=][^=]*?=\s*async?\s*\([^)]*\)\s*=>\s*\{/g,
    },
    { type: "arrow", re: /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*\{/g },
    {
      type: "arrow",
      re: /const\s+([A-Za-z_$][\w$]*)\s*[:=][^=]*?=\s*async?\s*\([^)]*\)\s*=>\s*\{/g,
    },
    { type: "arrow", re: /const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*\{/g },
  ]

  const matches = []
  for (const p of patterns) {
    let m
    while ((m = p.re.exec(src)) !== null) {
      matches.push({ type: p.type, name: m[1] || "default", startIdx: m.index })
    }
  }
  // 按位置排序并去重（可能多正则命中同一函数）
  matches.sort((a, b) => a.startIdx - b.startIdx)
  const dedup = []
  let last = -1
  for (const m of matches) {
    if (last >= 0 && m.startIdx === dedup[last].startIdx) continue
    dedup.push(m)
    last++
  }
  return dedup
}

function indexToLineOffsets(src) {
  const lines = src.split(/\r?\n/)
  const offsets = []
  let sum = 0
  for (let i = 0; i < lines.length; i++) {
    offsets.push(sum)
    sum += lines[i].length + 1 // include newline
  }
  return { lines, offsets }
}

function idxToLine(offsets, idx) {
  // 二分查找
  let lo = 0,
    hi = offsets.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= idx) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return hi + 1 // 1-based line
}

function findParenClose(src, openIdx) {
  // 从 openIdx(为 '(' 索引) 寻找匹配的 ')'
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function findBlockEnd(src, bodyStartIdx) {
  // 从函数体起始 '{' 开始配对 '}'
  const l = src.length
  let i = bodyStartIdx
  if (i === -1 || src[i] !== "{") return -1
  let depth = 0
  for (; i < l; i++) {
    const ch = src[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function estimateCyclomatic(body) {
  const s = stripCommentsAndStrings(body)
  const tokens = [
    /\bif\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?[^:\n]*:/g, // ternary
    /&&/g,
    /\|\|/g,
    /\bswitch\b/g,
  ]
  let count = 1
  for (const re of tokens) {
    const m = s.match(re)
    if (m) count += m.length
  }
  return count
}

function estimateMaxNesting(body) {
  // 通过大括号粗略估算最大嵌套深度
  const s = stripCommentsAndStrings(body)
  let depth = 0
  let maxDepth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "{") {
      depth++
      if (depth > maxDepth) maxDepth = depth
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1)
    }
  }
  // 顶层函数体的第一层不算控制流嵌套，减去 1
  return Math.max(0, maxDepth - 1)
}

function duplicateRate(lines) {
  const filtered = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("import "))
  const map = new Map()
  for (const l of filtered) {
    const norm = l.replace(/\s+/g, " ")
    map.set(norm, (map.get(norm) || 0) + 1)
  }
  let dupInstances = 0
  for (const [, c] of map) {
    if (c > 1) dupInstances += c - 1
  }
  const rate = filtered.length === 0 ? 0 : dupInstances / filtered.length
  return { rate, total: filtered.length, duplicates: dupInstances }
}

function analyze(filePath) {
  const abs = path.resolve(process.cwd(), filePath)
  const src = readFile(abs)
  const { lines, offsets } = indexToLineOffsets(src)
  const funcs = findFunctions(src)
  const results = []
  for (const f of funcs) {
    let bodyStart = -1
    if (f.type === "func") {
      const parenOpen = src.indexOf("(", f.startIdx)
      const parenClose = parenOpen >= 0 ? findParenClose(src, parenOpen) : -1
      bodyStart = parenClose >= 0 ? src.indexOf("{", parenClose) : -1
    } else {
      // 箭头函数：找到 '=>{' 的 '{'
      const arrowIdx = src.indexOf("=>", f.startIdx)
      if (arrowIdx >= 0) {
        bodyStart = src.indexOf("{", arrowIdx)
      }
    }
    const endIdx = findBlockEnd(src, bodyStart)
    if (endIdx === -1) continue
    const startLine = idxToLine(offsets, bodyStart)
    const endLine = idxToLine(offsets, endIdx)
    const body = src.slice(f.startIdx, endIdx + 1)
    const loc = Math.max(1, endLine - startLine + 1)
    const complexity = estimateCyclomatic(body)
    const maxDepth = estimateMaxNesting(body)
    results.push({ name: f.name, startLine, endLine, loc, complexity, maxDepth })
  }

  const totalFunctions = results.length
  const avgLoc = totalFunctions
    ? Math.round(results.reduce((a, b) => a + b.loc, 0) / totalFunctions)
    : 0
  const longest = results.reduce((m, x) => (x.loc > (m?.loc || 0) ? x : m), null)
  const mostComplex = results.reduce((m, x) => (x.complexity > (m?.complexity || 0) ? x : m), null)
  const deepest = results.reduce((m, x) => (x.maxDepth > (m?.maxDepth || 0) ? x : m), null)

  const dup = duplicateRate(lines)

  return {
    file: filePath,
    totalLines: lines.length,
    totalFunctions,
    avgLoc,
    longestFunction: longest || null,
    mostComplexFunction: mostComplex || null,
    deepestFunction: deepest || null,
    duplicateRate: Number((dup.rate * 100).toFixed(2)),
    duplicateStats: dup,
    functions: results,
  }
}

function main() {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error("Usage: node scripts/metrics/analyze-file.js <file...>")
    process.exit(1)
  }
  const out = files.map(analyze)
  console.log(JSON.stringify(out, null, 2))
}

main()
