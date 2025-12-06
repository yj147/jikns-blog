interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }

  return entry.value as T
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function invalidateCache(pattern: string): void {
  cache.forEach((_, key) => {
    if (key.includes(pattern)) {
      cache.delete(key)
    }
  })
}
