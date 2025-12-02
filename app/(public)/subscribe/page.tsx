import SubscribeForm from "@/components/subscribe-form"

export default function SubscribePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col gap-8 px-6 py-12 sm:px-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-primary">邮件订阅</p>
        <h1 className="text-3xl font-bold leading-10 tracking-tight text-card-foreground sm:text-4xl">
          订阅 Jikns Blog 更新
        </h1>
        <p className="text-muted-foreground text-base leading-7">
          获取最新文章发布、精选点评和产品更新。我们尊重你的时间，只在有价值的内容时发送邮件。
        </p>
      </div>

      <SubscribeForm />

      <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground sm:p-5">
        提交即表示你同意接收来自本站的邮件。我们遵守隐私承诺，任何时候都可以通过邮件中的退订链接一键取消。
      </div>
    </div>
  )
}
