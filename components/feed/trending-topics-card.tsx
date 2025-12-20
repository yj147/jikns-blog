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
            className="hover:bg-muted/60 group -mx-4 flex items-start gap-3 rounded-lg px-4 py-3 transition-colors"
          >
            <span className="text-muted-foreground/70 group-hover:text-muted-foreground w-6 text-right text-lg font-semibold leading-6 transition-colors">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-foreground text-[15px] font-bold leading-5">#{topic.name}</span>
              <span className="text-muted-foreground text-[12px] leading-4">
                科技 · 趋势 · {formatCount(topic.count)} 帖
              </span>
            </div>
            <span className="text-muted-foreground/60 text-sm opacity-0 transition-opacity group-hover:opacity-100">
              →
            </span>
          </Link>
        ))}
      </div>
      <Link href="/tags" className="text-primary mt-4 block text-sm hover:underline">
        显示更多
      </Link>
    </div>
  )
}
