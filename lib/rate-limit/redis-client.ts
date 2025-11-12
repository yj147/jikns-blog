import { Redis } from "@upstash/redis"

let cachedClient: Redis | null | undefined

export function getRedisClient(): Redis | null {
  if (cachedClient !== undefined) {
    return cachedClient
  }

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    cachedClient = null
    return cachedClient
  }

  cachedClient = new Redis({ url, token })
  return cachedClient
}
