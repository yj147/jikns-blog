import { headers } from "next/headers"

export interface ServerContext {
  requestId?: string
  ipAddress?: string
  userAgent?: string
  referer?: string
}

const REQUEST_ID_HEADERS = ["x-request-id", "x-vercel-request-id", "x-vercel-id", "traceparent"]

export function getServerContext(): ServerContext {
  try {
    const headerStore = headers() as unknown as Awaited<ReturnType<typeof headers>>
    const requestId =
      REQUEST_ID_HEADERS.map((key) => headerStore.get(key)).find(
        (value) => value && value.length > 0
      ) || crypto.randomUUID()

    const forwardedFor = headerStore.get("x-forwarded-for")
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      headerStore.get("x-client-ip") ||
      undefined

    return {
      requestId,
      ipAddress,
      userAgent: headerStore.get("user-agent") || undefined,
      referer: headerStore.get("referer") || undefined,
    }
  } catch (error) {
    // 当 headers() 在非请求上下文调用时可能抛错，使用降级数据保证后续逻辑可执行
    return {
      requestId: crypto.randomUUID(),
    }
  }
}
