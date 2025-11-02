/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const nextConfig = {
  // 允许的开发环境跨域来源
  allowedDevOrigins: ["127.0.0.1:3000", "localhost:3000", "172.29.144.193:3000"],

  // Server Actions 配置
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // 增加到 50MB，支持批量图片上传
    },
  },

  // Node.js 优化配置
  serverRuntimeConfig: {
    // 增加 EventEmitter 最大监听器限制，防止内存泄漏警告
    maxListeners: 50,
  },

  images: {
    unoptimized: true,
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
      // 确保 splitChunks 配置存在
      config.optimization.splitChunks = config.optimization.splitChunks || {}
      config.optimization.splitChunks.cacheGroups =
        config.optimization.splitChunks.cacheGroups || {}

      config.optimization.splitChunks.cacheGroups.prisma = {
        name: "prisma",
        chunks: "all",
        test: /[\\/]node_modules[\\/]@prisma[\\/]/,
        priority: 30,
        reuseExistingChunk: true,
      }

      config.optimization.splitChunks.cacheGroups.lucide = {
        name: "lucide",
        chunks: "all",
        test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
        priority: 25,
        reuseExistingChunk: true,
      }
    }

    return config
  },
}

export default nextConfig
