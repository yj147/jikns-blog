import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getArchiveData, getArchiveYears, type ArchiveYear } from "@/lib/actions/archive"
import ArchiveTimeline from "@/components/archive/archive-timeline"
import ArchiveNavigation from "@/components/archive/archive-navigation"
import ArchiveSearch from "@/components/archive/archive-search"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export const dynamic = "force-dynamic"

interface PageProps {
  params: {
    year: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const canonicalPath = `/archive/${params.year}`
  return {
    title: `${params.year}年文章归档 | Jikns Blog`,
    description: `浏览${params.year}年发布的所有文章`,
    openGraph: {
      title: `${params.year}年文章归档`,
      description: `探索${params.year}年的文章时间线`,
      type: "website",
      url: canonicalPath,
    },
    alternates: {
      canonical: canonicalPath,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export async function generateStaticParams() {
  const years = await getArchiveYears()
  return years.map((item) => ({
    year: item.year.toString(),
  }))
}

export default async function YearArchivePage({ params }: PageProps) {
  const year = parseInt(params.year, 10)

  // 验证年份是否有效
  if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 1) {
    notFound()
  }

  // 获取该年份的归档数据
  const [archiveData, allYears] = await Promise.all([getArchiveData({ year }), getArchiveYears()])

  // 如果没有数据，显示404
  if (archiveData.length === 0) {
    notFound()
  }

  const yearData = archiveData[0] // 因为只查询了特定年份

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* 返回链接和页面标题 */}
      <div className="mb-8">
        <Link
          href="/archive"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center text-sm"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          返回归档首页
        </Link>
        <h1 className="mb-4 text-3xl font-bold">{year}年 文章归档</h1>
        <p className="text-muted-foreground">
          共 {yearData.totalCount} 篇文章，分布在 {yearData.months.length} 个月份
        </p>
      </div>

      {/* 年份导航 */}
      <ArchiveNavigation years={allYears} currentYear={year} />

      <ArchiveSearch years={allYears} defaultYear={year} />

      {/* 时间线主体 */}
      <div className="mt-8">
        <ArchiveTimeline data={[yearData]} />
      </div>

      <ArchiveYearStructuredData year={year} data={yearData} />
    </div>
  )
}

function ArchiveYearStructuredData({ year, data }: { year: number; data: ArchiveYear }) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const baseUrl = siteUrl || undefined
  const url = baseUrl ? `${baseUrl}/archive/${year}` : undefined

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${year} 年文章归档`,
    url,
    isPartOf: baseUrl ? `${baseUrl}/archive` : undefined,
    numberOfItems: data.totalCount,
    hasPart: data.months.map((month) => ({
      "@type": "CollectionPage",
      name: `${year} 年 ${month.monthName}`,
      numberOfItems: month.count,
      url: baseUrl
        ? `${baseUrl}/archive/${year}/${month.month.toString().padStart(2, "0")}`
        : undefined,
    })),
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
