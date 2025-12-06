import type { SWRConfiguration } from "swr"
import { fetchJson, FetchError } from "@/lib/api/fetch-json"

export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  fetcher: (url: string) => fetchJson(url),
  // 对 4xx 客户端错误不重试，避免无限刷新
  onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
    if (error instanceof FetchError && error.statusCode >= 400 && error.statusCode < 500) {
      return
    }
    // 最多重试 3 次
    if (retryCount >= 3) return
    // 5xx 服务端错误：指数退避重试
    setTimeout(() => revalidate({ retryCount }), 5000 * 2 ** retryCount)
  },
}
