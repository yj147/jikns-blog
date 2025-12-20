import * as React from "react"
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components"

export interface DigestPostItem {
  title: string
  url: string
  excerpt?: string
}

export interface DigestEmailProps {
  posts: DigestPostItem[]
  unsubscribeLink: string
  appName?: string
}

export function DigestEmail({ posts, unsubscribeLink, appName = "Jikns Blog" }: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{appName} 最新文章摘要</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{appName} 周报</Heading>
          {posts.length === 0 ? (
            <Text style={styles.text}>本周暂无新文章，感谢关注。</Text>
          ) : (
            posts.map((post, index) => (
              <Container key={`${post.url}-${index}`} style={styles.card}>
                <Heading as="h2" style={styles.postTitle}>
                  <Link href={post.url} style={styles.link}>
                    {post.title}
                  </Link>
                </Heading>
                {post.excerpt ? <Text style={styles.text}>{post.excerpt}</Text> : null}
              </Container>
            ))
          )}
          <Text style={styles.footer}>
            不想再收到此类邮件？
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
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "12px",
  },
  postTitle: {
    fontSize: "16px",
    marginBottom: "8px",
  },
  text: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "20px",
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

export default DigestEmail
