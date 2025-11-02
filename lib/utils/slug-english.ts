/**
 * 智能英文 Slug 生成器 - 使用预定义的中英文映射
 */

// 常用中文词汇的英文映射
const chineseToEnglishMap: Record<string, string> = {
  // 技术相关
  前端: "frontend",
  后端: "backend",
  全栈: "fullstack",
  开发: "development",
  编程: "programming",
  代码: "code",
  框架: "framework",
  库: "library",
  组件: "component",
  模块: "module",
  函数: "function",
  方法: "method",
  变量: "variable",
  类: "class",
  接口: "interface",
  类型: "type",
  数据: "data",
  数据库: "database",
  服务器: "server",
  客户端: "client",
  浏览器: "browser",
  应用: "application",
  网站: "website",
  网页: "webpage",
  页面: "page",
  路由: "routing",
  状态: "state",
  管理: "management",
  优化: "optimization",
  性能: "performance",
  安全: "security",
  测试: "testing",
  调试: "debugging",
  部署: "deployment",
  发布: "release",
  版本: "version",
  更新: "update",
  升级: "upgrade",
  配置: "configuration",
  设置: "settings",
  环境: "environment",
  工具: "tool",
  插件: "plugin",
  扩展: "extension",
  主题: "theme",
  样式: "style",
  布局: "layout",
  响应式: "responsive",
  移动端: "mobile",
  桌面端: "desktop",
  跨平台: "cross-platform",
  架构: "architecture",
  设计: "design",
  模式: "pattern",
  原则: "principle",
  最佳: "best",
  实践: "practice",
  教程: "tutorial",
  指南: "guide",
  文档: "documentation",
  示例: "example",
  演示: "demo",
  项目: "project",
  功能: "feature",
  特性: "features",
  新: "new",
  现代: "modern",
  高级: "advanced",
  基础: "basic",
  入门: "getting-started",
  深入: "deep-dive",
  详解: "detailed",
  完全: "complete",
  简单: "simple",
  复杂: "complex",
  快速: "fast",
  慢: "slow",
  大: "large",
  小: "small",
  多: "multiple",
  单: "single",
  全: "full",
  新手: "beginner",
  专家: "expert",
  团队: "team",
  个人: "personal",
  企业: "enterprise",
  商业: "business",
  开源: "open-source",
  免费: "free",
  付费: "paid",

  // 常用动词
  使用: "using",
  创建: "creating",
  构建: "building",
  实现: "implementing",
  开始: "starting",
  学习: "learning",
  理解: "understanding",
  掌握: "mastering",
  提升: "improving",
  解决: "solving",
  修复: "fixing",
  避免: "avoiding",
  选择: "choosing",
  比较: "comparing",
  分析: "analyzing",
  评估: "evaluating",
  介绍: "introduction",
  探索: "exploring",
  发现: "discovering",
  研究: "researching",
  实验: "experimenting",
  实战: "practical",
  运用: "applying",
  集成: "integrating",
  迁移: "migrating",
  转换: "converting",
  重构: "refactoring",
  自动化: "automating",
  监控: "monitoring",
  追踪: "tracking",
  日志: "logging",
  错误: "error",
  异常: "exception",
  处理: "handling",
  验证: "validation",
  授权: "authorization",
  认证: "authentication",
  加密: "encryption",
  解密: "decryption",
  缓存: "caching",
  存储: "storage",
  备份: "backup",
  恢复: "recovery",
  同步: "sync",
  异步: "async",
  并发: "concurrent",
  并行: "parallel",
  队列: "queue",
  消息: "message",
  事件: "event",
  回调: "callback",
  承诺: "promise",
  流: "stream",
  管道: "pipeline",
  中间件: "middleware",
  钩子: "hooks",
  生命周期: "lifecycle",
  状态机: "state-machine",
  算法: "algorithm",
  数据结构: "data-structure",
  排序: "sorting",
  搜索: "searching",
  过滤: "filtering",
  分页: "pagination",
  分组: "grouping",
  聚合: "aggregation",
  统计: "statistics",
  图表: "charts",
  可视化: "visualization",
  动画: "animation",
  过渡: "transition",
  交互: "interaction",
  用户: "user",
  体验: "experience",
  界面: "interface",
  设计系统: "design-system",
  组件库: "component-library",
  脚手架: "scaffold",
  模板: "template",
  配置文件: "config-file",
  环境变量: "environment-variables",
  命令行: "command-line",
  终端: "terminal",
  编辑器: "editor",
  调试器: "debugger",
  编译器: "compiler",
  解释器: "interpreter",
  打包: "bundling",
  压缩: "compression",
  混淆: "obfuscation",
  源码: "source-code",
  字节码: "bytecode",
  机器码: "machine-code",
  虚拟机: "virtual-machine",
  容器: "container",
  镜像: "image",
  集群: "cluster",
  节点: "node",
  服务: "service",
  微服务: "microservices",
  无服务器: "serverless",
  云: "cloud",
  本地: "local",
  远程: "remote",
  分布式: "distributed",
  负载均衡: "load-balancing",
  高可用: "high-availability",
  容错: "fault-tolerance",
  降级: "degradation",
  熔断: "circuit-breaker",
  限流: "rate-limiting",
  重试: "retry",
  超时: "timeout",
  连接池: "connection-pool",
  线程池: "thread-pool",
  协程: "coroutine",
  进程: "process",
  线程: "thread",
  内存: "memory",
  垃圾回收: "garbage-collection",
  内存泄漏: "memory-leak",
  性能分析: "profiling",
  基准测试: "benchmarking",
  压力测试: "stress-testing",
  单元测试: "unit-testing",
  集成测试: "integration-testing",
  端到端: "end-to-end",
  自动化测试: "automated-testing",
  持续集成: "continuous-integration",
  持续部署: "continuous-deployment",
  持续交付: "continuous-delivery",
  版本控制: "version-control",
  分支: "branch",
  合并: "merge",
  提交: "commit",
  推送: "push",
  拉取: "pull",
  克隆: "clone",
  派生: "fork",
  标签: "tag",
  发行: "release",
  回滚: "rollback",
  撤销: "undo",
  重做: "redo",
  差异: "diff",
  补丁: "patch",
  冲突: "conflict",
  解决方案: "solution",
  问题: "problem",
  挑战: "challenge",
  机会: "opportunity",
  趋势: "trend",
  未来: "future",
  历史: "history",
  演进: "evolution",
  革命: "revolution",
  创新: "innovation",
  突破: "breakthrough",
  改进: "improvement",
  增强: "enhancement",
  兼容: "compatibility",
  回退: "revert",
  还原: "restore",
  导入: "import",
  导出: "export",
  序列化: "serialization",
  反序列化: "deserialization",
  编码: "encoding",
  解码: "decoding",
  解压: "decompression",
  哈希: "hashing",
  签名: "signature",
  鉴权: "authentication",
  令牌: "token",
  会话: "session",
  代理: "proxy",
  网关: "gateway",
  路由器: "router",
  交换机: "switch",
  防火墙: "firewall",
  负载均衡器: "load-balancer",
  反向代理: "reverse-proxy",
  正向代理: "forward-proxy",
  中间人: "man-in-the-middle",
  攻击: "attack",
  防御: "defense",
  漏洞: "vulnerability",
  热修复: "hotfix",
  紧急: "urgent",
  重要: "important",
  次要: "minor",
  主要: "major",
  关键: "critical",
  致命: "fatal",
  警告: "warning",
  信息: "info",
  跟踪: "trace",
  详细: "verbose",
  静默: "silent",
  交互式: "interactive",
  批处理: "batch",
  实时: "realtime",
  离线: "offline",
  在线: "online",
  阻塞: "blocking",
  非阻塞: "non-blocking",
  事件驱动: "event-driven",
  消息驱动: "message-driven",
  数据驱动: "data-driven",
  领域驱动: "domain-driven",
  测试驱动: "test-driven",
  行为驱动: "behavior-driven",
  敏捷: "agile",
  瀑布: "waterfall",
  迭代: "iteration",
  增量: "incremental",
  原型: "prototype",
  概念验证: "proof-of-concept",
  最小可行产品: "mvp",
  产品: "product",
  计划: "plan",
  任务: "task",
  里程碑: "milestone",
  截止日期: "deadline",
  交付: "delivery",
  上线: "launch",
  下线: "sunset",
  维护: "maintenance",
  支持: "support",
  手册: "manual",
  案例: "case",
  最佳实践: "best-practices",
  反模式: "anti-pattern",
  代码味道: "code-smell",
  技术债: "technical-debt",
  清理: "cleanup",
  可扩展性: "scalability",
  可维护性: "maintainability",
  可读性: "readability",
  可测试性: "testability",
  可用性: "usability",
  可访问性: "accessibility",
  国际化: "internationalization",
  本地化: "localization",
  暗黑模式: "dark-mode",
  亮色模式: "light-mode",
  自适应: "adaptive",
  渐进式: "progressive",
  原生: "native",
  混合: "hybrid",

  // 其他常用词
  和: "and",
  或: "or",
  与: "with",
  的: "of",
  在: "in",
  从: "from",
  到: "to",
  为: "for",
  关于: "about",
  如何: "how-to",
  什么: "what",
  为什么: "why",
  何时: "when",
  哪里: "where",
  谁: "who",
  哪个: "which",
  所有: "all",
  一些: "some",
  许多: "many",
  几个: "several",
  每个: "every",
  任何: "any",
  没有: "no",
  不: "not",
  是: "is",
  有: "has",
  能: "can",
  会: "will",
  应该: "should",
  必须: "must",
  可能: "may",
  需要: "need",
  想要: "want",
  结束: "end",
  继续: "continue",
  停止: "stop",
  暂停: "pause",
  重启: "restart",
  刷新: "refresh",
  删除: "delete",
  添加: "add",
  移除: "remove",
  修改: "modify",
  编辑: "edit",
  保存: "save",
  加载: "load",
  下载: "download",
  上传: "upload",
  分享: "share",
  复制: "copy",
  粘贴: "paste",
  剪切: "cut",
  查找: "find",
  替换: "replace",
  分割: "split",
  连接: "join",
  包含: "includes",
  排除: "excludes",
  匹配: "match",
  等于: "equals",
  大于: "greater",
  小于: "less",
  介于: "between",
  包括: "including",
  除了: "except",
  如果: "if",
  那么: "then",
  否则: "else",
  当: "when",
  直到: "until",
  只要: "while",
  因为: "because",
  所以: "therefore",
  但是: "but",
  然而: "however",
  虽然: "although",
  尽管: "despite",
  无论: "regardless",
  总是: "always",
  从不: "never",
  有时: "sometimes",
  经常: "often",
  很少: "rarely",
  通常: "usually",
  一般: "generally",
  特别: "especially",
  仅仅: "only",
  刚刚: "just",
  已经: "already",
  还: "still",
  正在: "currently",
  即将: "soon",
  最近: "recently",
  以前: "before",
  之后: "after",
  期间: "during",
  之间: "between",
  超过: "beyond",
  通过: "through",
  成为: "become",
  保持: "keep",
  改变: "change",
  移动: "move",
  创造: "create",
  销毁: "destroy",
  打开: "open",
  关闭: "close",
  显示: "show",
  隐藏: "hide",
  启用: "enable",
  禁用: "disable",
  激活: "activate",
  停用: "deactivate",
  安装: "install",
  卸载: "uninstall",
  初始化: "initialize",
  重置: "reset",
  打印: "print",
  预览: "preview",
  发送: "send",
  接收: "receive",
  请求: "request",
  响应: "response",
  成功: "success",
  失败: "failure",
  提示: "hint",
  帮助: "help",
  选项: "options",
  参数: "parameters",
  属性: "properties",
  监听器: "listener",
  处理器: "handler",
  控制器: "controller",
  视图: "view",
  模型: "model",
  仓库: "repository",
  工厂: "factory",
  单例: "singleton",
  观察者: "observer",
  策略: "strategy",
  适配器: "adapter",
  装饰器: "decorator",
  命令: "command",
  迭代器: "iterator",
  生成器: "generator",
}

/**
 * 将中文文本转换为英文 slug
 */
function chineseToEnglish(text: string): string {
  let result = text.toLowerCase()

  // 替换常用词汇
  for (const [chinese, english] of Object.entries(chineseToEnglishMap)) {
    const regex = new RegExp(chinese, "g")
    result = result.replace(regex, ` ${english} `)
  }

  // 清理多余空格
  result = result.replace(/\s+/g, " ").trim()

  return result
}

/**
 * 检测文本是否包含中文字符
 */
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

/**
 * 生成英文 slug
 */
function generateEnglishSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      // 移除特殊字符，保留字母、数字、空格和连字符
      .replace(/[^\w\s-]/g, "")
      // 将多个空格替换为单个连字符
      .replace(/\s+/g, "-")
      // 将多个连字符替换为单个连字符
      .replace(/-+/g, "-")
      // 移除开头和结尾的连字符
      .replace(/^-+|-+$/g, "")
  )
}

/**
 * 智能生成 slug - 自动将中文转换成英文
 * @param text 原始文本（可以是中文、英文或混合）
 * @param maxLength 最大长度（默认 60）
 * @returns 英文 slug
 */
export function createSmartSlug(text: string, maxLength: number = 60): string {
  let processedText = text

  // 如果包含中文，进行转换
  if (containsChinese(text)) {
    processedText = chineseToEnglish(text)
  }

  // 生成 slug
  let slug = generateEnglishSlug(processedText)

  // 如果 slug 为空（可能所有中文都没有匹配到），使用拼音方案作为后备
  if (!slug || slug.length === 0) {
    // 使用简单的时间戳作为后备方案
    slug = `post-${Date.now()}`
  }

  // 限制长度（在单词边界处截断）
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength)
    // 在最后一个完整单词处截断
    const lastDash = slug.lastIndexOf("-")
    if (lastDash > 0) {
      slug = slug.substring(0, lastDash)
    }
  }

  return slug
}

/**
 * 创建唯一的智能 slug（带去重逻辑）
 */
export async function createUniqueSmartSlug(
  text: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxLength: number = 60
): Promise<string> {
  const baseSlug = createSmartSlug(text, maxLength)

  if (!baseSlug) {
    throw new Error("无法生成有效的 slug")
  }

  let slug = baseSlug
  let counter = 1

  // 检查是否存在，如果存在则添加数字后缀
  while (await checkExists(slug)) {
    counter++
    const suffix = `-${counter}`
    const maxBaseLength = maxLength - suffix.length

    if (baseSlug.length > maxBaseLength) {
      slug = baseSlug.substring(0, maxBaseLength) + suffix
    } else {
      slug = baseSlug + suffix
    }
  }

  return slug
}

/**
 * 批量生成唯一的智能 slug
 */
export function createUniqueSmartSlugs(
  texts: string[],
  checkExists: (slug: string) => Promise<boolean>,
  maxLength: number = 60
): Promise<string[]> {
  return Promise.all(texts.map((text) => createUniqueSmartSlug(text, checkExists, maxLength)))
}
