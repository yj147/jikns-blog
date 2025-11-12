import { Metadata } from "next"
import {
  getArchiveData,
  getArchiveStats,
  getArchiveYears,
  type ArchiveStats as ArchiveStatsType,
} from "@/lib/actions/archive"
import ArchiveTimeline from "@/components/archive/archive-timeline"
import ArchiveStats from "@/components/archive/archive-stats"
import ArchiveNavigation from "@/components/archive/archive-navigation"
import ArchiveSearch from "@/components/archive/archive-search"

export const metadata: Metadata = {
  title: "文章归档 | Jikns Blog",
  description: "浏览所有历史文章，按时间线组织",
  keywords: ["文章归档", "Jikns Blog", "博客目录", "历史文章"],
  openGraph: {
    title: "文章归档",
    description: "探索我们的文章时间线",
    type: "website",
    url: "/archive",
  },
  alternates: {
    canonical: "/archive",
  },
  robots: {
    index: true,
    follow: true,
  },
}

const RECENT_YEAR_WINDOW = 3

export default async function ArchivePage() {
  // 获取归档数据和统计信息
  const [archiveData, stats, years] = await Promise.all([
    getArchiveData({ limitYears: RECENT_YEAR_WINDOW }),
    getArchiveStats(),
    getArchiveYears(),
  ])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="mb-4 text-3xl font-bold">文章归档</h1>
        <p className="text-muted-foreground">探索所有历史文章，按时间顺序浏览</p>
      </div>

      <ArchiveSearch years={years} />

      {/* 统计信息 */}
      <ArchiveStats stats={stats} />
      <ArchiveStructuredData stats={stats} years={years} />

      {/* 年份快速导航 */}
      <ArchiveNavigation years={years} />
      {years.length > RECENT_YEAR_WINDOW && (
        <p className="text-muted-foreground mt-2 text-xs">
          仅展示最近 {RECENT_YEAR_WINDOW} 年，其余年份请通过导航查看。
        </p>
      )}

      {/* 时间线主体 */}
      <div className="mt-8">
        {archiveData.length > 0 ? (
          <ArchiveTimeline
            data={archiveData}
            totalYearCount={years.length}
            initialChunkSize={RECENT_YEAR_WINDOW}
          />
        ) : (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">暂无文章</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ArchiveStructuredData({
  stats,
  years,
}: {
  stats: ArchiveStatsType
  years: { year: number; count: number }[]
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const baseUrl = siteUrl || undefined
  const url = baseUrl ? `${baseUrl}/archive` : undefined

  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "文章归档",
    description: "浏览所有历史文章，按时间顺序了解内容发展",
    url,
    numberOfItems: stats.totalPosts,
    hasPart: years.slice(0, 12).map((item) => ({
      "@type": "CollectionPage",
      name: `${item.year} 年文章`,
      url: baseUrl ? `${baseUrl}/archive/${item.year}` : undefined,
      numberOfItems: item.count,
    })),
    about: stats.postsPerYear.map((item) => ({
      "@type": "CreativeWorkSeason",
      name: `${item.year} 年`,
      numberOfItems: item.count,
    })),
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
