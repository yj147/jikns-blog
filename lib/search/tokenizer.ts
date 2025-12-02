import type { Post } from "@/lib/generated/prisma"

type NodeJiebaModule = typeof import("nodejieba")

let cachedNodeJieba: NodeJiebaModule | null | undefined

function isNodeEnvironment() {
  return typeof window === "undefined"
}

function shouldDisableJieba() {
  return process.env.DISABLE_JIEBA === "1" || process.env.PLAYWRIGHT === "1"
}

function loadNodeJieba(): NodeJiebaModule | null {
  if (cachedNodeJieba !== undefined) {
    return cachedNodeJieba
  }

  if (!isNodeEnvironment() || shouldDisableJieba()) {
    cachedNodeJieba = null
    return cachedNodeJieba
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicRequire: NodeRequire = eval("require")
    cachedNodeJieba = dynamicRequire("nodejieba") as NodeJiebaModule
  } catch {
    cachedNodeJieba = null
  }

  return cachedNodeJieba
}

const MIN_TOKEN_LENGTH = 1

function normalizeToken(token: string): string | null {
  const trimmed = token.trim()
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return null
  }
  return trimmed
}

export function tokenizeText(value: string | null | undefined): string {
  if (!value) {
    return ""
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  const jieba = loadNodeJieba()

  if (jieba) {
    try {
      // 策略：分离中英文，分别处理后合并
      const allTokens: string[] = []
      const parts: Array<{ type: "english" | "chinese"; text: string }> = []

      // 拆分中英文部分
      let lastIndex = 0
      const englishPattern = /[a-zA-Z]+(?:\.[a-zA-Z]+)*/g
      let match: RegExpExecArray | null

      while ((match = englishPattern.exec(trimmed)) !== null) {
        // 添加之前的中文部分
        if (match.index > lastIndex) {
          const chinesePart = trimmed.slice(lastIndex, match.index).trim()
          if (chinesePart) {
            parts.push({ type: "chinese", text: chinesePart })
          }
        }
        // 添加英文部分
        parts.push({ type: "english", text: match[0] })
        lastIndex = match.index + match[0].length
      }

      // 添加剩余的中文部分
      if (lastIndex < trimmed.length) {
        const remaining = trimmed.slice(lastIndex).trim()
        if (remaining) {
          parts.push({ type: "chinese", text: remaining })
        }
      }

      // 分别处理
      for (const part of parts) {
        if (part.type === "english") {
          // 英文直接小写化
          allTokens.push(part.text.toLowerCase())
        } else {
          // 中文用 nodejieba 分词
          const chineseTokens = jieba.cutForSearch(part.text)
          allTokens.push(...chineseTokens)
        }
      }

      return allTokens
        .map(normalizeToken)
        .filter((token): token is string => Boolean(token))
        .join(" ")
    } catch {
      // fall through to basic tokenizer
    }
  }

  return basicTokenize(trimmed)
}

type TokenizablePostFields = Pick<Post, "title" | "excerpt" | "seoDescription" | "content">

export function buildPostTokens(fields: Partial<TokenizablePostFields>): {
  titleTokens: string
  excerptTokens: string
  seoDescriptionTokens: string
  contentTokens: string
} {
  return {
    titleTokens: tokenizeText(fields.title),
    excerptTokens: tokenizeText(fields.excerpt),
    seoDescriptionTokens: tokenizeText(fields.seoDescription),
    contentTokens: tokenizeText(fields.content),
  }
}

export function buildActivityTokens(content?: string | null): string {
  return tokenizeText(content)
}

function basicTokenize(input: string): string {
  // 在缺少 nodejieba 时，先为连续的中文字符插入空格，避免整段中文变成一个 token
  const separated = input.replace(/([\p{Script=Han}])/gu, "$1 ")

  return separated
    .split(/[\s,，。.!?？；;、"'“”‘’()（）[\]{}<>《》|\\/\-_=+]+/)
    .map(normalizeToken)
    .filter((token): token is string => Boolean(token))
    .join(" ")
}
