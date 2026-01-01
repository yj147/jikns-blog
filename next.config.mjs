/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url"
import { dirname } from "path"
import bundleAnalyzer from "@next/bundle-analyzer"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const allowedDevOrigins = [
  "127.0.0.1:3000",
  "localhost:3000",
  "172.29.144.193:3000",
  // dev server extra ports
  "127.0.0.1:3999",
  "localhost:3999",
]

const normalizeOrigin = (origin) => {
  if (!origin) return origin
  if (/^https?:\/\//i.test(origin)) return origin

  const isLocal =
    origin.startsWith("localhost") ||
    origin.startsWith("127.0.0.1") ||
    origin.startsWith("0.0.0.0") ||
    /^\d+\.\d+\.\d+\.\d+:\d+$/.test(origin)

  return `${isLocal ? "http" : "https"}://${origin}`
}

const devOriginsWithProtocol = Array.from(
  new Set(allowedDevOrigins.map((origin) => normalizeOrigin(origin)))
)

const parseOrigins = (value) =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

const envAllowedOrigins = parseOrigins(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS).map(
  normalizeOrigin
)
const siteOrigins = [process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL, process.env.VERCEL_URL]
  .map((origin) => origin?.trim())
  .filter(Boolean)
  .map(normalizeOrigin)

const baseOrigins =
  envAllowedOrigins.length > 0
    ? envAllowedOrigins
    : siteOrigins.length > 0
      ? siteOrigins
      : devOriginsWithProtocol

const serverActionAllowedOrigins = Array.from(
  new Set(
    process.env.NODE_ENV === "production"
      ? baseOrigins
      : [...baseOrigins, ...devOriginsWithProtocol]
  )
)

const getHostnameFromUrl = (value) => {
  if (!value) return undefined
  try {
    return new URL(value).hostname
  } catch {
    return undefined
  }
}

const supabaseHostname = getHostnameFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabaseRemotePatterns = [
  ...(supabaseHostname
    ? [
        {
          protocol: "https",
          hostname: supabaseHostname,
          pathname: "/storage/v1/object/public/**",
        },
        // 支持签名 URL 路径
        {
          protocol: "https",
          hostname: supabaseHostname,
          pathname: "/storage/v1/object/sign/**",
        },
        // 支持 Supabase Image Transformation API (render)
        {
          protocol: "https",
          hostname: supabaseHostname,
          pathname: "/storage/v1/render/image/**",
        },
      ]
    : []),
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  // 支持签名 URL (*.supabase.co)
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/sign/**",
  },
  // 支持 Image Transformation API (*.supabase.co)
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/render/image/**",
  },
  {
    protocol: "https",
    hostname: "*.supabase.in",
    pathname: "/storage/v1/object/public/**",
  },
  // 支持签名 URL (*.supabase.in)
  {
    protocol: "https",
    hostname: "*.supabase.in",
    pathname: "/storage/v1/object/sign/**",
  },
  // 支持 Image Transformation API (*.supabase.in)
  {
    protocol: "https",
    hostname: "*.supabase.in",
    pathname: "/storage/v1/render/image/**",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "54321",
    pathname: "/storage/v1/object/**",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "54321",
    pathname: "/storage/v1/object/**",
  },
  // 开发/测试环境的外部图片源
  {
    protocol: "https",
    hostname: "picsum.photos",
  },
  {
    protocol: "https",
    hostname: "api.dicebear.com",
  },
]

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // 允许的开发环境跨域来源
  allowedDevOrigins,

  // Server Actions 配置
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // 增加到 50MB，支持批量图片上传
      allowedOrigins: serverActionAllowedOrigins,
    },
  },

  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [50, 70, 75, 80, 90, 100],
    minimumCacheTTL: 60,
    remotePatterns: supabaseRemotePatterns,
  },
  // 安全头部配置
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS (仅在生产环境)
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // CSP 头部
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://unpkg.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in http://localhost:* http://127.0.0.1:* https://avatars.githubusercontent.com https://github.com https://api.dicebear.com https://picsum.photos",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },

  // 图标优化配置（Tree shaking）
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{kebabCase member}}",
      preventFullImport: true,
    },
  },
}

export default withBundleAnalyzer(nextConfig)
