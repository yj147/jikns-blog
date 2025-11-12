import type { MetadataRoute } from "next"
import { getArchiveData, getArchiveYears } from "@/lib/actions/archive"

function getBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  return raw.replace(/\/$/, "")
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const years = await getArchiveYears()

  const yearEntries = years.map(({ year, count }) => ({
    url: `${baseUrl}/archive/${year}`,
    lastModified: new Date(),
    changeFrequency: count > 0 ? ("monthly" as const) : ("yearly" as const),
  }))

  const monthEntries = (
    await Promise.all(
      years.map(async ({ year }) => {
        const data = await getArchiveData({ year })
        const months = data[0]?.months ?? []

        return months.map((month) => {
          const latestPost = month.posts[0]?.publishedAt
          return {
            url: `${baseUrl}/archive/${year}/${month.month.toString().padStart(2, "0")}`,
            lastModified: latestPost ? new Date(latestPost) : new Date(),
            changeFrequency: "monthly" as const,
          }
        })
      })
    )
  ).flat()

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    },
    ...yearEntries,
    ...monthEntries,
  ]
}
