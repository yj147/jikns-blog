"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

export default function TrendingTopicsCard({ topics = defaultTopics }: TrendingTopicsCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">热门话题</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topics.map((topic, index) => (
          <div key={topic.name} className="flex items-center justify-between" data-hover-scale="">
            <span className="font-medium">#{topic.name}</span>
            <Badge variant="secondary">{topic.count} 讨论</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

