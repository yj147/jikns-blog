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
      const words = jieba.cut(trimmed, true)
      return words
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
  return input
    .split(/[\s,，。.!?？；;、"'“”‘’()（）[\]{}<>《》|\\/\-_=+]+/)
    .map(normalizeToken)
    .filter((token): token is string => Boolean(token))
    .join(" ")
}
