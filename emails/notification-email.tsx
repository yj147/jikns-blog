import * as React from "react"
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components"

export interface NotificationEmailProps {
  title: string
  message: string
  actionLink?: string
  unsubscribeLink: string
  appName?: string
}

export function NotificationEmail({
  title,
  message,
  actionLink,
  unsubscribeLink,
  appName = "Jikns Blog",
}: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{title}</Heading>
          <Text style={styles.text}>{message}</Text>
          {actionLink ? (
            <Text style={styles.text}>
              查看详情：
              <Link href={actionLink} style={styles.link}>
                {actionLink}
              </Link>
            </Text>
          ) : null}
          <Text style={styles.footer}>
            这是一封来自 {appName} 的通知邮件。如不再希望接收，请点击
            <Link href={unsubscribeLink} style={styles.link}>
              退订
            </Link>
            。
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: "#f5f5f5",
    padding: "24px",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "24px",
    border: "1px solid #e6e6e6",
    fontFamily: "Arial, sans-serif",
    maxWidth: "640px",
    margin: "0 auto",
  },
  heading: {
    fontSize: "20px",
    marginBottom: "12px",
  },
  text: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "20px",
    marginBottom: "12px",
  },
  link: {
    color: "#2563eb",
    textDecoration: "underline",
    wordBreak: "break-all",
  },
  footer: {
    fontSize: "12px",
    color: "#888",
    marginTop: "16px",
  },
} as const

export default NotificationEmail
