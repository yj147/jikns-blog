/**
 * Prisma 客户端配置
 * 确保全局单例，避免开发环境中的连接池耗尽
 */

import { Prisma, PrismaClient } from "./generated/prisma"
import { tokenizeText } from "./search/tokenizer"

type ExtendedPrismaClient = PrismaClient

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

const POST_TOKEN_FIELDS = [
  { field: "title", tokenField: "titleTokens" },
  { field: "excerpt", tokenField: "excerptTokens" },
  { field: "seoDescription", tokenField: "seoDescriptionTokens" },
  { field: "content", tokenField: "contentTokens" },
] as const

type MutableData = Record<string, unknown> | undefined

function extractScalarString(value: unknown): string | null | undefined {
  if (typeof value === "string") {
    return value
  }

  if (value === null) {
    return null
  }

  if (value && typeof value === "object" && "set" in value) {
    const setValue = (value as Record<string, unknown>).set
    if (typeof setValue === "string" || setValue === null) {
      return setValue
    }
  }

  return undefined
}

const hasOwn = Object.prototype.hasOwnProperty

function applyPostTokens(data: MutableData, options: { forceAll: boolean }) {
  if (!data) return
  const record = data as Record<string, unknown>

  for (const { field, tokenField } of POST_TOKEN_FIELDS) {
    if (hasOwn.call(record, field)) {
      const rawValue = extractScalarString(record[field])
      record[tokenField] = tokenizeText(rawValue)
    } else if (options.forceAll) {
      record[tokenField] = tokenizeText(undefined)
    }
  }
}

function applyActivityTokens(data: MutableData, options: { forceAll: boolean }) {
  if (!data) return
  const record = data as Record<string, unknown>

  if (hasOwn.call(record, "content")) {
    const rawValue = extractScalarString(record["content"])
    record["contentTokens"] = tokenizeText(rawValue)
  } else if (options.forceAll) {
    record["contentTokens"] = tokenizeText(undefined)
  }
}

function applyTagTokens(data: MutableData, options: { forceAll: boolean }) {
  if (!data) return
  const record = data as Record<string, unknown>

  if (hasOwn.call(record, "name")) {
    const rawValue = extractScalarString(record["name"])
    record["nameTokens"] = tokenizeText(rawValue)
  } else if (options.forceAll) {
    record["nameTokens"] = tokenizeText(undefined)
  }

  if (hasOwn.call(record, "description")) {
    const rawValue = extractScalarString(record["description"])
    record["descriptionTokens"] = tokenizeText(rawValue)
  } else if (options.forceAll) {
    record["descriptionTokens"] = tokenizeText(undefined)
  }
}

function applyUserTokens(data: MutableData, options: { forceAll: boolean }) {
  if (!data) return
  const record = data as Record<string, unknown>

  if (hasOwn.call(record, "name")) {
    const rawValue = extractScalarString(record["name"])
    record["nameTokens"] = tokenizeText(rawValue)
  } else if (options.forceAll) {
    record["nameTokens"] = tokenizeText(undefined)
  }

  if (hasOwn.call(record, "bio")) {
    const rawValue = extractScalarString(record["bio"])
    record["bioTokens"] = tokenizeText(rawValue)
  } else if (options.forceAll) {
    record["bioTokens"] = tokenizeText(undefined)
  }
}

function applyTokensToInput(
  payload: MutableData | MutableData[] | undefined,
  applier: (data: MutableData, options: { forceAll: boolean }) => void,
  options: { forceAll: boolean }
) {
  if (!payload) return
  if (Array.isArray(payload)) {
    payload.forEach((item) => applier(item, options))
    return
  }
  applier(payload, options)
}

const searchTokenExtension = Prisma.defineExtension({
  name: "search-token-hooks",
  query: {
    post: {
      create({ args, query }) {
        applyPostTokens(args.data, { forceAll: true })
        return query(args)
      },
      createMany({ args, query }) {
        applyTokensToInput(args.data as MutableData | MutableData[] | undefined, applyPostTokens, {
          forceAll: true,
        })
        return query(args)
      },
      update({ args, query }) {
        applyPostTokens(args.data, { forceAll: false })
        return query(args)
      },
      updateMany({ args, query }) {
        applyTokensToInput(args.data as MutableData | MutableData[] | undefined, applyPostTokens, {
          forceAll: false,
        })
        return query(args)
      },
      upsert({ args, query }) {
        applyPostTokens(args.create, { forceAll: true })
        applyPostTokens(args.update, { forceAll: false })
        return query(args)
      },
    },
    activity: {
      create({ args, query }) {
        applyActivityTokens(args.data, { forceAll: true })
        return query(args)
      },
      createMany({ args, query }) {
        applyTokensToInput(
          args.data as MutableData | MutableData[] | undefined,
          applyActivityTokens,
          { forceAll: true }
        )
        return query(args)
      },
      update({ args, query }) {
        applyActivityTokens(args.data, { forceAll: false })
        return query(args)
      },
      updateMany({ args, query }) {
        applyTokensToInput(
          args.data as MutableData | MutableData[] | undefined,
          applyActivityTokens,
          { forceAll: false }
        )
        return query(args)
      },
      upsert({ args, query }) {
        applyActivityTokens(args.create, { forceAll: true })
        applyActivityTokens(args.update, { forceAll: false })
        return query(args)
      },
    },
    tag: {
      create({ args, query }) {
        applyTagTokens(args.data, { forceAll: true })
        return query(args)
      },
      createMany({ args, query }) {
        applyTokensToInput(
          args.data as MutableData | MutableData[] | undefined,
          applyTagTokens,
          { forceAll: true }
        )
        return query(args)
      },
      update({ args, query }) {
        applyTagTokens(args.data, { forceAll: false })
        return query(args)
      },
      updateMany({ args, query }) {
        applyTokensToInput(
          args.data as MutableData | MutableData[] | undefined,
          applyTagTokens,
          { forceAll: false }
        )
        return query(args)
      },
      upsert({ args, query }) {
        applyTagTokens(args.create, { forceAll: true })
        applyTagTokens(args.update, { forceAll: false })
        return query(args)
      },
    },
    user: {
      create({ args, query }) {
        applyUserTokens(args.data, { forceAll: true })
        return query(args)
      },
      createMany({ args, query }) {
        applyTokensToInput(
          args.data as MutableData | MutableData[] | undefined,
          applyUserTokens,
          { forceAll: true }
        )
        return query(args)
      },
      update({ args, query }) {
        applyUserTokens(args.data, { forceAll: false })
        return query(args)
      },
      updateMany({ args, query }) {
        applyTokensToInput(
          args.data as MutableData | MutableData[] | undefined,
          applyUserTokens,
          { forceAll: false }
        )
        return query(args)
      },
      upsert({ args, query }) {
        applyUserTokens(args.create, { forceAll: true })
        applyUserTokens(args.update, { forceAll: false })
        return query(args)
      },
    },
  },
})

function createPrismaClient(): PrismaClient {
  return (new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }).$extends(searchTokenExtension)) as PrismaClient
}

const prismaInstance: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient()
export const prisma: ExtendedPrismaClient = prismaInstance

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaInstance
}

// 优雅关闭数据库连接
process.on("beforeExit", async () => {
  await prisma.$disconnect()
})

export default prisma
