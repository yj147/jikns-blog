/** @type {import("pliny/config").PlinyConfig } */
const siteMetadata = {
  title: 'jikns博客',
  author: 'jikns',
  headerTitle: '与你分享世界',
  description: '基于 Next.js 和 Tailwind CSS 构建的博客',
  language: 'zh-cn',
  theme: 'system', // 系统主题、深色或浅色
  siteUrl: 'https://jikns666.xyz',
  siteRepo: 'https://github.com/yj147/jikns-blog',
  siteLogo: `${process.env.BASE_PATH || ''}/static/images/logo.png`,
  socialBanner: `${process.env.BASE_PATH || ''}/static/images/twitter-card.png`,
  mastodon: 'https://mastodon.social/@yourusername',
  email: '1483864379@qq.com',
  github: 'https://github.com/yj147',
  x: 'https://twitter.com/yourusername',
  // twitter: 'https://twitter.com/yourusername' // Twitter 链接
  facebook: 'https://facebook.com/jikns',
  youtube: 'https://youtube.com',
  linkedin: 'https://www.linkedin.com/in/yourusername',
  threads: 'https://www.threads.net/@yourusername',
  instagram: 'https://www.instagram.com/yourusername',
  medium: 'https://medium.com/@yourusername',
  bluesky: 'https://bsky.app/profile/yourusername',
  locale: 'zh-CN',
  // 设置为 true 如果您希望导航栏固定在顶部
  stickyNav: false,
  analytics: {
    // 如果您想使用分析服务提供商，您需要将其添加到
    // `next.config.js` 文件中的内容安全策略中。
    // 支持 Plausible、Simple Analytics、Umami、Posthog 或 Google Analytics。
    umamiAnalytics: {
      // 我们使用环境变量来避免其他用户克隆我们的分析 ID
      umamiWebsiteId: process.env.NEXT_UMAMI_ID, // e.g. 123e4567-e89b-12d3-a456-426614174000
      // You may also need to overwrite the script if you're storing data in the US - ex:
      // src: 'https://us.umami.is/script.js'
      // Remember to add 'us.umami.is' in `next.config.js` as a permitted domain for the CSP
    },
    // plausibleAnalytics: {
    //   plausibleDataDomain: '', // e.g. tailwind-nextjs-starter-blog.vercel.app
    // If you are hosting your own Plausible.
    //   src: '', // e.g. https://plausible.my-domain.com/js/script.js
    // },
    // simpleAnalytics: {},
    // posthogAnalytics: {
    //   posthogProjectApiKey: '', // e.g. 123e4567-e89b-12d3-a456-426614174000
    // },
    // googleAnalytics: {
    //   googleAnalyticsId: '', // e.g. G-XXXXXXX
    // },
  },
  newsletter: {
    // supports mailchimp, buttondown, convertkit, klaviyo, revue, emailoctopus, beehive
    // Please add your .env file and modify it according to your selection
    provider: '', // 已移除newsletter功能
  },
  comments: {
    // 评论系统提供商：custom（自定义）、giscus、utterances、disqus
    provider: 'custom', // 使用自定义评论系统

    // 自定义评论系统配置
    customConfig: {
      // 是否启用评论功能
      enabled: true,
      // 是否需要审核（垃圾评论会自动标记为需要审核）
      moderation: true,
      // 最大评论长度
      maxLength: 2000,
      // 是否允许匿名评论
      allowAnonymous: true,
    },

    // 备用 Giscus 配置（如果需要切换回 Giscus）
    giscusConfig: {
      // 访问下面的链接，并按照"配置"部分的步骤操作
      // https://giscus.app/
      repo: process.env.NEXT_PUBLIC_GISCUS_REPO,
      repositoryId: process.env.NEXT_PUBLIC_GISCUS_REPOSITORY_ID,
      category: process.env.NEXT_PUBLIC_GISCUS_CATEGORY,
      categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID,
      mapping: 'pathname', // 支持的选项：pathname、url、title
      reactions: '1', // 表情反应：1 = 启用 / 0 = 禁用
      // 定期向父窗口发送讨论元数据：1 = 启用 / 0 = 禁用
      metadata: '0',
      // 主题示例：light、dark、dark_dimmed、dark_high_contrast
      // transparent_dark、preferred_color_scheme、custom
      theme: 'light',
      // 深色模式下的主题
      darkTheme: 'transparent_dark',
      // 如果上面的主题选项设置为 'custom'
      // 请在下面提供您的自定义主题 CSS 文件链接。
      // 示例：https://giscus.app/themes/custom_example.css
      themeURL: '',
      // 这对应于 giscus 配置中的 `data-lang="zh"`
      lang: 'zh',
    },
  },
  search: {
    provider: 'kbar', // kbar 或 algolia
    kbarConfig: {
      searchDocumentsPath: `${process.env.BASE_PATH || ''}/search.json`, // 加载搜索文档的路径
      // 自定义搜索结果处理函数，用于中文化
      onSearchDocumentsLoad: (json) => {
        const formatDate = (dateStr) => {
          const date = new Date(dateStr)
          return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        }

        return json.map((post) => ({
          id: post.path,
          name: post.title,
          keywords: post.summary || '',
          section: '内容', // 将 "Content" 替换为 "内容"
          subtitle: formatDate(post.date),
          perform: () => (window.location.href = `/${post.path}`),
        }))
      },
    },
    // provider: 'algolia',
    // algoliaConfig: {
    //   // Algolia 提供的应用程序 ID
    //   appId: 'R2IYF7ETH7',
    //   // 公共 API 密钥：提交它是安全的
    //   apiKey: '599cec31baffa4868cae4e79f180729b',
    //   indexName: 'docsearch',
    // },
  },
}

module.exports = siteMetadata
