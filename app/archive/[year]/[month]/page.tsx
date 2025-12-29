import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  getArchiveData,
  getArchiveMonths,
  getAdjacentMonths,
  getArchiveYears,
  type ArchiveMonth,
} from "@/lib/actions/archive"
import ArchiveTimeline from "@/components/archive/archive-timeline"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import ArchiveSearch from "@/components/archive/archive-search"
import { archiveMonthNames } from "@/lib/utils/archive"

export const dynamic = "force-dynamic"

interface PageProps {
  params: {
    year: string
    month: string
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const month = parseInt(params.month, 10)
  const monthName = archiveMonthNames[month - 1] || ""
  const canonicalPath = `/archive/${params.year}/${params.month}`

  return {
    title: `${params.year}年${monthName}文章归档 | Jikns Blog`,
    description: `浏览${params.year}年${monthName}发布的所有文章`,
    openGraph: {
      title: `${params.year}年${monthName}文章归档`,
      description: `探索${params.year}年${monthName}的文章`,
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
  // 为了性能考虑，只预生成最近2年的月份页面
  const currentYear = new Date().getFullYear()
  const params: { year: string; month: string }[] = []

  for (let year = currentYear; year >= currentYear - 1; year--) {
    const months = await getArchiveMonths(year)
    months.forEach((m) => {
      params.push({
        year: year.toString(),
        month: m.month.toString().padStart(2, "0"),
      })
    })
  }

  return params
}

export default async function MonthArchivePage({ params }: PageProps) {
  const year = parseInt(params.year, 10)
  const month = parseInt(params.month, 10)

  // 验证年份和月份是否有效
  if (
    isNaN(year) ||
    isNaN(month) ||
    year < 2000 ||
    year > new Date().getFullYear() + 1 ||
    month < 1 ||
    month > 12
  ) {
    notFound()
  }

  // 获取该月份的归档数据
  const [archiveData, adjacentMonths, allYears] = await Promise.all([
    getArchiveData({ year, month }),
    getAdjacentMonths(year, month),
    getArchiveYears(),
  ])

  // 如果没有数据，显示404
  if (archiveData.length === 0 || archiveData[0].months.length === 0) {
    notFound()
  }

  const monthData = archiveData[0].months[0]
  const monthName = archiveMonthNames[month - 1]

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* 返回链接和页面标题 */}
      <div className="mb-8">
        <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
          <Link href="/archive" className="hover:text-foreground">
            归档
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/archive/${year}`} className="hover:text-foreground">
            {year}年
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{monthName}</span>
        </div>

        <h1 className="mb-4 text-3xl font-bold">
          {year}年{monthName} 文章归档
        </h1>
        <p className="text-muted-foreground">共 {monthData.count} 篇文章</p>
      </div>

      {/* 月份导航 */}
      <div className="mb-8 flex items-center justify-between">
        {adjacentMonths.prev ? (
          <Link
            href={`/archive/${adjacentMonths.prev.year}/${adjacentMonths.prev.month.toString().padStart(2, "0")}`}
          >
            <Button variant="outline" size="sm">
              <ChevronLeft className="mr-1 h-4 w-4" />
              {adjacentMonths.prev.year}年{archiveMonthNames[adjacentMonths.prev.month - 1]}
            </Button>
          </Link>
        ) : (
          <div />
        )}

        {adjacentMonths.next ? (
          <Link
            href={`/archive/${adjacentMonths.next.year}/${adjacentMonths.next.month.toString().padStart(2, "0")}`}
          >
            <Button variant="outline" size="sm">
              {adjacentMonths.next.year}年{archiveMonthNames[adjacentMonths.next.month - 1]}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <div />
        )}
      </div>

      <ArchiveSearch years={allYears} defaultYear={year} />
      <ArchiveMonthStructuredData year={year} month={month} monthData={monthData} />

      {/* 文章列表 */}
      <div className="space-y-4">
        {monthData.posts.map((post) => (
          <article
            key={post.id}
            className="border-primary/20 hover:border-primary border-l-2 py-2 pl-4 transition-colors"
          >
            <div className="flex items-baseline gap-3">
              <time className="text-muted-foreground text-sm">
                {new Date(post.publishedAt).toLocaleDateString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                })}
              </time>
              <div className="flex-1">
                <Link
                  href={`/blog/${post.slug}`}
                  className="hover:text-primary text-lg font-medium transition-colors"
                >
                  {post.title}
                </Link>
                {post.summary && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{post.summary}</p>
                )}
                {post.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {post.tags.map((postTag) => (
                      <Link
                        key={postTag.tag.id}
                        href={`/tags/${postTag.tag.slug}`}
                        className="bg-secondary hover:bg-secondary/80 rounded-md px-2 py-1 text-xs transition-colors"
                      >
                        {postTag.tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ArchiveMonthStructuredData({
  year,
  month,
  monthData,
}: {
  year: number
  month: number
  monthData: ArchiveMonth
}) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const baseUrl = siteUrl || undefined
  const monthSlug = month.toString().padStart(2, "0")
  const url = baseUrl ? `${baseUrl}/archive/${year}/${monthSlug}` : undefined
  const toIsoString = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${year} 年 ${monthData.monthName} 文章归档`,
    url,
    isPartOf: baseUrl ? `${baseUrl}/archive/${year}` : undefined,
    numberOfItems: monthData.count,
    hasPart: monthData.posts.slice(0, 10).map((post) => {
      const datePublished = toIsoString(post.publishedAt as Date | string)
      return {
        "@type": "Article",
        name: post.title,
        url: baseUrl ? `${baseUrl}/blog/${post.slug}` : undefined,
        ...(datePublished ? { datePublished } : {}),
      }
    }),
  }

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
