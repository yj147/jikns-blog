import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "隐私政策",
  description: "本站的隐私政策",
}

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">隐私政策</h1>
      <div className="prose prose-neutral dark:prose-invert">
        <p className="text-muted-foreground">最后更新：2024 年 12 月</p>

        <h2>信息收集</h2>
        <p>本站可能收集以下信息：</p>
        <ul>
          <li>您注册时提供的邮箱地址和用户名</li>
          <li>您的 IP 地址和浏览器信息（用于安全和分析）</li>
          <li>您在本站的互动数据（评论、点赞等）</li>
        </ul>

        <h2>信息使用</h2>
        <p>收集的信息仅用于：</p>
        <ul>
          <li>提供和改进网站服务</li>
          <li>发送必要的服务通知</li>
          <li>保障网站安全</li>
        </ul>

        <h2>信息保护</h2>
        <p>我们采取合理的安全措施保护您的个人信息，包括加密传输和安全存储。</p>

        <h2>第三方服务</h2>
        <p>本站使用以下第三方服务：</p>
        <ul>
          <li>Supabase（身份验证和数据存储）</li>
          <li>Cloudflare（CDN 和安全防护）</li>
          <li>Vercel（网站托管）</li>
        </ul>

        <h2>联系方式</h2>
        <p>如有任何隐私相关问题，请通过网站联系方式与我们取得联系。</p>
      </div>
    </main>
  )
}
