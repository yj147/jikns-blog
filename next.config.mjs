/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url"
import { dirname } from "path"
import bundleAnalyzer from "@next/bundle-analyzer"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const allowedDevOrigins = ["127.0.0.1:3000", "localhost:3000", "172.29.144.193:3000"]

const normalizeOrigin = (origin) =>
  origin && /^https?:\/\//i.test(origin) ? origin : `http://${origin}`

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
const siteOrigins = [process.env.NEXT_PUBLIC_SITE_URL, process.env.SITE_URL]
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
      ]
    : []),
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "*.supabase.in",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "54321",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "54321",
    pathname: "/storage/v1/object/public/**",
  },
]

const supabaseImageDomains = Array.from(
  new Set(
    [
      supabaseHostname,
      ...(process.env.NODE_ENV !== "production" ? ["localhost", "127.0.0.1"] : []),
    ].filter(Boolean)
  )
)

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

  // Node.js 优化配置
  serverRuntimeConfig: {
    // 增加 EventEmitter 最大监听器限制，防止内存泄漏警告
    maxListeners: 50,
  },

  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    domains: supabaseImageDomains,
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com https://github.com",
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

  // Webpack 优化配置
  webpack: (config, { isServer }) => {
    // 彻底解决 108KB 缓存警告 - 禁用问题缓存策略
    if (config.cache && typeof config.cache === "object") {
      config.cache.maxMemoryGenerations = 0 // 避免内存中的大字符串缓存
      config.cache.memoryCacheUnaffected = false // 禁用未受影响的内存缓存

      // 对于大字符串使用更激进的缓存策略
      if (config.cache.buildDependencies) {
        config.cache.buildDependencies.config = [__filename]
      }
    }

    // 对于开发环境，完全禁用持久化缓存以避免序列化大字符串
    if (process.env.NODE_ENV === "development") {
      config.cache = false
    }

    // 优化 Prisma 生成文件的处理
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client": isServer ? "@prisma/client" : "@prisma/client",
    }

    // 减少包大小的分析输出
    if (!isServer) {
      const existingSplitChunks = config.optimization.splitChunks || {}
      const existingCacheGroups = existingSplitChunks.cacheGroups || {}

      config.optimization.splitChunks = {
        ...existingSplitChunks,
        cacheGroups: {
          ...existingCacheGroups,
          react: {
            name: "react-vendor",
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 40,
            chunks: "all",
            reuseExistingChunk: true,
          },
          radix: {
            name: "radix-vendor",
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            priority: 35,
            chunks: "all",
            reuseExistingChunk: true,
          },
          prisma: {
            name: "prisma",
            test: /[\\/]node_modules[\\/]@prisma[\\/]/,
            priority: 30,
            chunks: "all",
            reuseExistingChunk: true,
          },
          lucide: {
            name: "lucide",
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            priority: 25,
            chunks: "all",
            reuseExistingChunk: true,
          },
          utils: {
            name: "utils-vendor",
            test: /[\\/]node_modules[\\/](date-fns|clsx|class-variance-authority|tailwind-merge)[\\/]/,
            priority: 20,
            chunks: "all",
            reuseExistingChunk: true,
          },
          editor: {
            name: "editor-vendor",
            test: /[\\/]node_modules[\\/](@tiptap|react-markdown|remark|rehype)[\\/]/,
            priority: 15,
            chunks: "all",
            reuseExistingChunk: true,
          },
        },
      }
    }

    return config
  },
}

export default withBundleAnalyzer(nextConfig)
