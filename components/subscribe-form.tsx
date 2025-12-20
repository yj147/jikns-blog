"use client"

import { useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2, Mail } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const subscribeSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
})

type SubscribeFormValues = z.infer<typeof subscribeSchema>

export default function SubscribeForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  const form = useForm<SubscribeFormValues>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: SubscribeFormValues) => {
    setStatus("idle")
    setMessage("")
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        const err = result?.error?.message ?? "订阅失败，请稍后重试"
        setStatus("error")
        setMessage(err)
        return
      }

      setStatus("success")
      setMessage("订阅请求已提交，请查收邮箱完成验证。")
      form.reset()
    } catch (error) {
      setStatus("error")
      setMessage("网络异常，请稍后再试")
    }
  }

  const { isSubmitting } = form.formState

  return (
    <div className="border-border/60 bg-card rounded-xl border p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="bg-primary/10 text-primary mt-0.5 rounded-md p-2">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <p className="text-card-foreground text-base font-semibold leading-6">订阅最新文章</p>
          <p className="text-muted-foreground text-sm leading-6">
            留下邮箱，第一时间收到新文章和精选内容。随时可退订。
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>邮箱地址</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                    data-testid="email-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "正在提交..." : "订阅更新"}
            </Button>
            <p className="text-muted-foreground text-xs sm:text-sm">
              我们只会在有新内容时发送邮件，不会分享或出售你的邮箱。
            </p>
          </div>
        </form>
      </Form>

      {status !== "idle" ? (
        <Alert
          variant={status === "success" ? "default" : "destructive"}
          className="mt-4"
          data-testid={`${status}-alert`}
        >
          <AlertTitle>{status === "success" ? "订阅成功" : "提交失败"}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
