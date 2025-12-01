import type { SWRConfiguration } from "swr"
import { fetchJson } from "@/lib/api/fetch-json"

export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  fetcher: (url: string) => fetchJson(url),
}
