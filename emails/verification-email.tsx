import * as React from "react"
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components"

export interface VerificationEmailProps {
  verificationLink: string
  unsubscribeLink: string
  appName?: string
}

export function VerificationEmail({
  verificationLink,
  unsubscribeLink,
  appName = "Jikns Blog",
}: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>确认订阅 {appName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>确认订阅 {appName}</Heading>
          <Text style={styles.text}>点击下方按钮完成邮箱验证，开始接收最新内容。</Text>
          <Button href={verificationLink} style={styles.button}>
            确认订阅
          </Button>
          <Text style={styles.secondary}>
            如果按钮无法点击，请复制链接到浏览器：
            <br />
            <Link href={verificationLink} style={styles.link}>
              {verificationLink}
            </Link>
          </Text>
          <Text style={styles.footer}>
            若非本人操作，可忽略此邮件。取消订阅：
            <Link href={unsubscribeLink} style={styles.link}>
              立即退订
            </Link>
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
    marginBottom: "16px",
  },
  text: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "20px",
    marginBottom: "18px",
  },
  secondary: {
    fontSize: "12px",
    color: "#666",
    lineHeight: "18px",
    marginTop: "16px",
  },
  button: {
    backgroundColor: "#111827",
    color: "#ffffff",
    padding: "12px 18px",
    borderRadius: "6px",
    textDecoration: "none",
    display: "inline-block",
    fontWeight: 600,
  },
  link: {
    color: "#2563eb",
    textDecoration: "underline",
    wordBreak: "break-all",
  },
  footer: {
    fontSize: "12px",
    color: "#888",
    marginTop: "20px",
  },
} as const

export default VerificationEmail
