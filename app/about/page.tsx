import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "关于",
  description: "关于本站",
}

export default function AboutPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">关于本站</h1>
      <div className="prose prose-neutral dark:prose-invert">
        <p>这是一个个人博客，用于分享技术文章和生活感悟。</p>
        <p>本站使用 Next.js 构建，部署于 Vercel。</p>
      </div>
    </main>
  )
}
