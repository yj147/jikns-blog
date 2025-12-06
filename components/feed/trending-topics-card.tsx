"use client"

import Link from "next/link"

interface TrendingTopic {
  name: string
  count: number
}

const defaultTopics: TrendingTopic[] = [
  { name: "Next.js 15", count: 1234 },
  { name: "TypeScript", count: 987 },
  { name: "Tailwind CSS", count: 756 },
  { name: "React 19", count: 543 },
  { name: "Prisma", count: 432 },
]

interface TrendingTopicsCardProps {
  topics?: TrendingTopic[]
}

function formatCount(count: number) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`
  }
  return count.toString()
}

export default function TrendingTopicsCard({ topics = defaultTopics }: TrendingTopicsCardProps) {
  return (
    <div className="py-2">
      <div className="space-y-1">
        {topics.map((topic, index) => (
          <Link
            href={`/search?q=${encodeURIComponent(topic.name)}`}
            key={topic.name}
            className="group -mx-4 flex items-start gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <span className="w-6 text-right text-lg font-semibold leading-6 text-muted-foreground/70 transition-colors group-hover:text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-[15px] font-bold leading-5 text-foreground">#{topic.name}</span>
              <span className="text-[12px] leading-4 text-muted-foreground">
                科技 · 趋势 · {formatCount(topic.count)} 帖
              </span>
            </div>
            <span className="text-sm text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
              →
            </span>
          </Link>
        ))}
      </div>
      <Link href="/tags" className="block mt-4 text-sm text-primary hover:underline">
        显示更多
      </Link>
    </div>
  )
}
