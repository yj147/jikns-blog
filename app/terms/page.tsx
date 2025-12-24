import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "服务条款",
  description: "本站的服务条款",
}

export default function TermsPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">服务条款</h1>
      <div className="prose prose-neutral dark:prose-invert">
        <p className="text-muted-foreground">最后更新：2024 年 12 月</p>

        <h2>接受条款</h2>
        <p>使用本网站即表示您同意遵守以下服务条款。如不同意，请勿使用本站。</p>

        <h2>用户行为</h2>
        <p>您同意：</p>
        <ul>
          <li>不发布违法、侵权或有害内容</li>
          <li>不进行任何可能损害网站运行的行为</li>
          <li>尊重其他用户和网站管理员</li>
          <li>对自己发布的内容负责</li>
        </ul>

        <h2>内容所有权</h2>
        <p>
          本站原创内容版权归网站所有者所有。用户发布的内容版权归用户所有，但授予本站展示和存储的权利。
        </p>

        <h2>免责声明</h2>
        <p>本站内容仅供参考，不构成专业建议。对于因使用本站内容造成的任何损失，本站不承担责任。</p>

        <h2>服务变更</h2>
        <p>本站保留随时修改或中断服务的权利，恕不另行通知。</p>

        <h2>条款修改</h2>
        <p>本站保留随时修改服务条款的权利。继续使用本站即视为接受修改后的条款。</p>
      </div>
    </main>
  )
}
